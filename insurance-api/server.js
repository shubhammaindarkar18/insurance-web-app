/*
 * ===================================================================
 * Node.js REST API Server (PostgreSQL Version)
 * File: server.js
 * ===================================================================
 */

require('dotenv').config(); // MUST BE AT THE VERY TOP

const express = require('express');
const { Pool, types } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

types.setTypeParser(1700, function(val) {
    return parseFloat(val);
});

// --- Configuration ---
const app = express();

// Use Render's dynamic port in production, or 3000 locally
const port = process.env.PORT || 3000; 
const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors()); 
app.use(express.json()); 

// --- Database Configuration ---
/* * Render provides a single "DATABASE_URL" string. 
 * We check for that first. If it doesn't exist (like on your local machine), 
 * we fall back to the individual variables.
 */
const poolConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required by Render Postgres
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      };

const pool = new Pool(poolConfig);

// --- Middleware ---

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verify Error:", err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user; // Adds { id, email, role } to the request object
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// --- Auth API Endpoints ---

/*
 * [AUTH] Register a new user
 * POST /api/register
 */
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Generate new User ID (POLICY_USER_00001)
        const seqRes = await client.query("SELECT 'POLICY_USER_' || LPAD(nextval('user_id_seq')::text, 5, '0') AS new_id");
        const newUserId = seqRes.rows[0].new_id;

        // Hash the password
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const sql = `INSERT INTO USERS (user_id, email, password_hash, role)
                     VALUES ($1, $2, $3, 'MEMBER')`;
        
        await client.query(sql, [newUserId, email, passwordHash]);
        await client.query('COMMIT');

        console.log(`Registered new user: ${newUserId} (${email})`);
        res.status(201).json({ userId: newUserId, email: email });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') { // Unique constraint violation in PG
            return res.status(409).json({ error: 'This email is already registered.' });
        }
        console.error("Error registering user:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/*
 * [AUTH] Log in a user
 * POST /api/login
 */
app.post('/api/login', async (req, res) => {
    const { email: loginIdentifier, password } = req.body;
    
    if (!loginIdentifier || !password) {
        return res.status(400).json({ error: 'Email/User ID and password are required' });
    }

    try {
        const sql = `SELECT user_id, email, password_hash, role 
                     FROM USERS 
                     WHERE email = $1 OR user_id = $1`;
                     
        const result = await pool.query(sql, [loginIdentifier]);

        if (result.rows.length === 0) {
            console.log("Login attempt failed (user not found) for:", loginIdentifier);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            const tokenPayload = {
                id: user.user_id,
                email: user.email,
                role: user.role
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

            console.log(`User logged in: ${user.user_id}`);
            res.json({ token, user: tokenPayload });
        } else {
            console.log("Password compare failed for user:", loginIdentifier);
            res.status(401).json({ error: 'Invalid credentials' });
        }

    } catch (err) {
        console.error("Error logging in:", err);
        res.status(500).json({ error: err.message });
    }
});


// --- Application API Endpoints ---

/*
 * [STEP 1] Create a new policy draft
 * POST /api/policy
 */
app.post('/api/policy', verifyToken, async (req, res) => {
    const { proposer, dependents, kyc } = req.body;
    const userId = req.user.id;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const policySql = `INSERT INTO POLICIES (user_id, status)
                           VALUES ($1, 'Draft')
                           RETURNING policy_id`;

        const policyRes = await client.query(policySql, [userId]);
        const newPolicyId = policyRes.rows[0].policy_id;

        const allMembers = [proposer, ...dependents];
        for (const m of allMembers) {
            const memberSql = `INSERT INTO POLICY_MEMBERS (policy_id, client_side_id, name, dob, age, relationship, kyc_status)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)`;
            await client.query(memberSql, [newPolicyId, m.id, m.name, m.dob, m.age, m.relationship, kyc[m.id]]);
        }
        
        await client.query('COMMIT');
        console.log(`Created policy ${newPolicyId} for user ${userId}`);
        res.status(201).json({ policyId: newPolicyId, message: "Policy draft created" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error creating policy:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


/*
 * [STEP 2] Add plan details to the policy
 * PUT /api/policy/:policyId/plan
 */
app.put('/api/policy/:policyId/plan', verifyToken, async (req, res) => {
    const { policyId } = req.params;
    const { product, insurer, premium, basePremium, taxes } = req.body;
    
    try {
        const sql = `UPDATE POLICIES 
                     SET product_name = $1, insurer_name = $2, premium = $3,
                         base_premium = $4, taxes = $5, last_updated = CURRENT_TIMESTAMP
                     WHERE policy_id = $6 AND user_id = $7`;
                     
        await pool.query(sql, [product, insurer, premium, basePremium, taxes, policyId, req.user.id]);
        
        console.log(`Updated plan for policy: ${policyId}`);
        res.json({ message: "Plan updated successfully" });
    } catch (err) {
        console.error("Error updating plan:", err);
        res.status(500).json({ error: err.message });
    }
});


/*
 * [STEP 4 / PENDED] Update KYC status for a member
 * PUT /api/kyc/:clientSideId
 *
 * v11 FIX: This API no longer auto-activates the policy.
 * It ONLY updates the member status to "Confirmed".
 */
app.put('/api/kyc/:clientSideId', verifyToken, async (req, res) => {
    const { clientSideId } = req.params;

    try {
        // 1. Update the specific member's KYC status
        const updateSql = `UPDATE POLICY_MEMBERS
                           SET kyc_status = 'Confirmed'
                           WHERE client_side_id = $1`;
                           
        await pool.query(updateSql, [clientSideId]);

        // 2. Find the current policy status (Draft or Pended)
        const statusRes = await pool.query(`
            SELECT p.status
            FROM POLICIES p
            JOIN POLICY_MEMBERS m ON p.policy_id = m.policy_id
            WHERE m.client_side_id = $1`, [clientSideId]);
        
        console.log(`Updated KYC for member: ${clientSideId}.`);
        res.json({ 
            message: 'KYC Confirmed', 
            kycStatus: 'Confirmed', 
            policyStatus: statusRes.rows[0]?.status || 'Draft'
        });

    } catch (err) {
        console.error("Error updating KYC:", err);
        res.status(500).json({ error: err.message });
    }
});


/*
 * [STEP 5] Activate the policy (purchase)
 * POST /api/policy/:policyId/purchase
 *
 * v11: This is now the ONLY endpoint that generates a
 * policy number and activates a policy.
 */
app.post('/api/policy/:policyId/purchase', verifyToken, async (req, res) => {
    const { policyId } = req.params;
    const { allKycDone, policyStartDate } = req.body; 

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Generate new Policy Number (POLICY_NO_00001)
        const seqRes = await client.query("SELECT 'POLICY_NO_' || LPAD(nextval('policy_no_seq')::text, 5, '0') AS new_no");
        const newPolicyNumber = seqRes.rows[0].new_no;

        // 2. Determine status based on KYC
        const policyStatus = allKycDone ? 'Active' : 'Pended';

        // 3. Update Policy
        const sql = `UPDATE POLICIES
                     SET status = $1, policy_number = $2, policy_start_date = $3
                     WHERE policy_id = $4 AND user_id = $5`;
                     
        await client.query(sql, [policyStatus, newPolicyNumber, policyStartDate, policyId, req.user.id]);
        
        await client.query('COMMIT');
        console.log(`Purchased policy: ${policyId} with number ${newPolicyNumber}. Status: ${policyStatus}`);
        res.json({ policyNumber: newPolicyNumber, policyStatus: policyStatus });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error activating policy:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


/*
 * [PENDED DASHBOARD] Activate a PENDED policy (the "I'm done" button)
 * PUT /api/policy/:policyId/activate-kyc
 */
app.put('/api/policy/:policyId/activate-kyc', verifyToken, async (req, res) => {
    const { policyId } = req.params;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const policySql = `UPDATE POLICIES
                           SET status = 'Active', last_updated = CURRENT_TIMESTAMP
                           WHERE policy_id = $1 AND user_id = $2 AND status = 'Pended'`;
        
        const resPolicy = await client.query(policySql, [policyId, userId]);

        if (resPolicy.rowCount === 0) {
            throw new Error('Pended policy not found for this user.');
        }

        const memberSql = `UPDATE POLICY_MEMBERS
                           SET kyc_status = 'Confirmed'
                           WHERE policy_id = $1 AND kyc_status != 'Exempt'`;
        
        await client.query(memberSql, [policyId]);
        await client.query('COMMIT');
        
        console.log(`Policy ${policyId} activated via KYC update.`);
        res.json({ message: 'Policy activated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error activating KYC:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});


/*
 * [DASHBOARD] Get all data for a user (active policy and claims)
 * GET /api/dashboard
 */
app.get('/api/dashboard', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const policyRes = await pool.query(`
            SELECT * FROM POLICIES 
            WHERE user_id = $1 
            ORDER BY last_updated DESC LIMIT 1`, [userId]);
        
        if (policyRes.rows.length === 0) return res.json({ policy: null, claims: [] });

        const policy = policyRes.rows[0];
        const membersRes = await pool.query(`SELECT * FROM POLICY_MEMBERS WHERE policy_id = $1`, [policy.policy_id]);
        const claimsRes = await pool.query(`SELECT * FROM CLAIMS WHERE policy_id = $1 ORDER BY submitted_at DESC`, [policy.policy_id]);
        
        // Map to uppercase for compatibility with existing frontend
        const mappedPolicy = Object.keys(policy).reduce((acc, key) => { acc[key.toUpperCase()] = policy[key]; return acc; }, {});
        mappedPolicy.members = membersRes.rows.map(row => Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase()] = row[key]; return acc; }, {}));
        const mappedClaims = claimsRes.rows.map(row => Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase()] = row[key]; return acc; }, {}));

        console.log(`Fetched dashboard for user: ${userId}`);
        res.json({ policy: mappedPolicy, claims: mappedClaims });
    } catch (err) {
        console.error("Error fetching dashboard:", err);
        res.status(500).json({ error: err.message });
    }
});


/*
 * [CLAIM] Submit a new claim
 * POST /api/claims
 */
app.post('/api/claims', verifyToken, async (req, res) => {
    const { policyId, member, details, claimId } = req.body;

    try {
        const sql = `INSERT INTO CLAIMS (claim_id, policy_id, member_name, details, status, submitted_at)
                     VALUES ($1, $2, $3, $4, 'Submitted', CURRENT_TIMESTAMP)`;
        
        await pool.query(sql, [claimId, policyId, member, details]);
        
        console.log(`Submitted claim: ${claimId}`);
        res.status(201).json({ message: "Claim submitted" });
    } catch (err) {
        console.error("Error submitting claim:", err);
        res.status(500).json({ error: err.message });
    }
});


// --- Admin API Endpoints ---

/*
 * [ADMIN] Get all registered members
 * GET /api/admin/members
 */
app.get('/api/admin/members', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT user_id, email, role, created_at FROM USERS ORDER BY created_at DESC`);
        res.json(result.rows.map(row => Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase()] = row[key]; return acc; }, {})));
    } catch (err) {
        console.error("Admin: Error fetching members:", err);
        res.status(500).json({ error: err.message });
    }
});

/*
 * [ADMIN] Get all claims
 * GET /api/admin/claims
 */
app.get('/api/admin/claims', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, p.policy_number 
            FROM CLAIMS c 
            LEFT JOIN POLICIES p ON c.policy_id = p.policy_id 
            ORDER BY c.submitted_at DESC`);
        res.json(result.rows.map(row => Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase()] = row[key]; return acc; }, {})));
    } catch (err) {
        console.error("Admin: Error fetching claims:", err);
        res.status(500).json({ error: err.message });
    }
});

/*
 * [ADMIN] Pay/Reject a claim
 * PUT /api/admin/claims/:claimDbId
 */
app.put('/api/admin/claims/:claimDbId', verifyToken, isAdmin, async (req, res) => {
    const { claimDbId } = req.params;
    const { status } = req.body; // "Paid" or "Rejected"

    if (!status || (status !== 'Paid' && status !== 'Rejected')) {
        return res.status(400).json({ error: 'Invalid status. Must be "Paid" or "Rejected".' });
    }

    try {
        const result = await pool.query(`UPDATE CLAIMS SET status = $1 WHERE claim_db_id = $2`, [status, claimDbId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Claim not found.' });
        }

        console.log(`Admin updated claim ${claimDbId} to ${status}`);
        res.json({ message: 'Claim status updated' });
    } catch (err) {
        console.error("Admin: Error updating claim:", err);
        res.status(500).json({ error: err.message });
    }
});

/*
 * [ADMIN] Get all policies (for lapsing/reinstating)
 * GET /api/admin/policies
 */
app.get('/api/admin/policies', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM POLICIES ORDER BY last_updated DESC`);
        res.json(result.rows.map(row => Object.keys(row).reduce((acc, key) => { acc[key.toUpperCase()] = row[key]; return acc; }, {})));
    } catch (err) {
        console.error("Admin: Error fetching policies:", err);
        res.status(500).json({ error: err.message });
    }
});

/*
 * [ADMIN] Lapse/Reinstate a policy
 * PUT /api/admin/policy/:policyId
 */
app.put('/api/admin/policy/:policyId', verifyToken, isAdmin, async (req, res) => {
    const { policyId } = req.params;
    const { status } = req.body; // "Active" or "Lapsed"

    if (!status || (status !== 'Active' && status !== 'Lapsed')) {
        return res.status(400).json({ error: 'Invalid status. Must be "Active" or "Lapsed".' });
    }

    try {
        const result = await pool.query(`UPDATE POLICIES SET status = $1 WHERE policy_id = $2`, [status, policyId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Policy not found.' });
        }

        console.log(`Admin updated policy ${policyId} to ${status}`);
        res.json({ message: 'Policy status updated' });
    } catch (err) {
        console.error("Admin: Error updating policy:", err);
        res.status(500).json({ error: err.message });
    }
});


// --- Startup ---
app.listen(port, () => {
    console.log(`PostgreSQL API Server running on http://localhost:${port}`);
});