// src/app.js
import { apiFetch, auth } from './api.js';


// --- Global State ---
let dependentCounter = 1; // ADD THIS LINE

let appState = {
    proposer: null,
    dependents: [],
    plan: {
        product: '',
        insurer: '',
        policyStartDate: '',
        basePremium: 0,
        taxes: 0,
        totalPremium: 0,
    },
    kyc: {},
    policyId: null,
    policyNumber: null,
    policyStatus: 'Draft'
};

// --- Custom Fetch Wrapper for UI ---
// This automatically passes your loading spinners and logout handler to the core apiFetch
async function fetchWithUI(endpoint, options = {}) {
    return await apiFetch(endpoint, options, showLoading, hideLoading, handleLogout);
}

// --- Utility Functions ---
function navigate(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    const logoutButton = document.getElementById('logoutButton');
    if (pageId === 'login-page' || pageId === 'register-page') {
        logoutButton.classList.add('hidden');
    } else {
        logoutButton.classList.remove('hidden');
    }

    document.getElementById('loginErrorMessage').classList.add('hidden');
    const successMsg = document.getElementById('registrationSuccessMessage');
    if (successMsg) {
        successMsg.classList.add('hidden');
        document.getElementById('registrationForm').style.display = 'block';
    }
}

function calculateAge(dobInputId, ageHiddenInputId) {
    const dob = document.getElementById(dobInputId).value;
    if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        document.getElementById(ageHiddenInputId).value = age;
    }
}

function showMessage(title, body) {
    document.getElementById('messageTitle').textContent = title;
    document.getElementById('messageBody').textContent = body;
    document.getElementById('messageModal').style.display = 'block';
}

function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

// --- KYC Modal ---
function openKycModal(clientSideId, name) {
    document.getElementById('kycMemberName').textContent = name;
    document.getElementById('poiFile').value = '';
    document.getElementById('poaFile').value = '';
    
    const kycSubmitButton = document.getElementById('kycSubmitButton');
    kycSubmitButton.onclick = () => submitSingleKycUpload(clientSideId);
    
    document.getElementById('kycModal').style.display = 'block';
}

function closeKycModal() {
    document.getElementById('kycModal').style.display = 'none';
}

// --- Auth & Navigation ---
async function handleLogin(event) {
    event.preventDefault();
    document.getElementById('loginErrorMessage').classList.add('hidden');
    
    const loginIdentifier = document.getElementById('loginEmail').value; 
    const password = document.getElementById('loginPassword').value;
    
    try {
        const data = await fetchWithUI('/login', {
            method: 'POST',
            body: { email: loginIdentifier, password: password } 
        });
        
        auth.token = data.token;
        auth.user = data.user;
        
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        
        if (auth.user.role === 'ADMIN') {
            await loadAdminDashboard();
        } else {
            await loadMemberDashboard();
        }
        
    } catch (err) {
        if (err.message.includes('Invalid credentials')) {
            document.getElementById('loginErrorMessage').classList.remove('hidden');
        } else {
            showMessage('Login Error', err.message);
        }
    }
}

async function handleRegistration(event) {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        await fetchWithUI('/register', {
            method: 'POST',
            body: { email, password }
        });
        
        document.getElementById('registrationForm').style.display = 'none';
        document.getElementById('registrationSuccessMessage').classList.remove('hidden');
        
    } catch (err) {
        showMessage('Registration Error', err.message);
    }
}

function handleLogout() {
    dependentCounter = 1; // ADD THIS LINE
    auth.token = null;
    auth.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    
    appState = {
        proposer: null, dependents: [],
        plan: { product: '', insurer: '', policyStartDate: '', basePremium: 0, taxes: 0, totalPremium: 0 },
        kyc: {}, policyId: null, policyNumber: null, policyStatus: 'Draft'
    };

    document.getElementById('dependentsContainer').innerHTML = '';
    document.getElementById('personalDetailsForm').reset();
    document.getElementById('planDetailsForm').reset();
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';

    navigate('login-page');
}

function checkSession() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('authUser');
    
    if (token && user) {
        auth.token = token;
        auth.user = JSON.parse(user);
        
        if (auth.user.role === 'ADMIN') {
            loadAdminDashboard();
        } else {
            loadMemberDashboard();
        }
    } else {
        navigate('login-page');
    }
}

function startNewApplication() {
    appState = {
        proposer: null, dependents: [],
        plan: { product: '', insurer: '', policyStartDate: '', basePremium: 0, taxes: 0, totalPremium: 0 },
        kyc: {}, policyId: null, policyNumber: null, policyStatus: 'Draft'
    };
    document.getElementById('dependentsContainer').innerHTML = '';
    document.getElementById('personalDetailsForm').reset();
    document.getElementById('planDetailsForm').reset();
    
    document.getElementById('policyStartDate').value = new Date().toISOString().split('T')[0];
    
    navigate('personal-details-page');
}

// --- Step 1: Personal Details ---
function addDependent() {
    const container = document.getElementById('dependentsContainer');
    const dependentId = `dep-${dependentCounter++}`;
    
    const dependentHtml = `
        <div id="${dependentId}" data-testid="dependent-row-${dependentId}" class="p-4 border border-gray-300 rounded-lg">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="md:col-span-2">
                    <label for="${dependentId}-name" class="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" id="${dependentId}-name" name="${dependentId}-name" data-testid="dependent-name-input" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required>
                </div>
                <div>
                    <label for="${dependentId}-dob" class="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <input type="date" id="${dependentId}-dob" name="${dependentId}-dob" data-testid="dependent-dob-input" placeholder="YYYY-MM-DD" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required onchange="calculateAge('${dependentId}-dob', '${dependentId}-age')">
                    <input type="hidden" id="${dependentId}-age" name="${dependentId}-age" data-testid="dependent-age-hidden">
                </div>
                <div>
                    <label for="${dependentId}-relationship" class="block text-sm font-medium text-gray-700">Relationship</label>
                    <select id="${dependentId}-relationship" name="${dependentId}-relationship" data-testid="dependent-relationship-select" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required>
                        <option value="">Select...</option>
                        <option value="Wife">Wife</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                    </select>
                </div>
            </div>
            <div class="text-right mt-2">
                <button type="button" id="btn-remove-${dependentId}" data-testid="remove-dependent-button" onclick="removeDependent('${dependentId}')" class="px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600">
                    Remove
                </button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', dependentHtml);
}

function removeDependent(dependentId) {
    // 1. Remove the dependent row from the screen
    document.getElementById(dependentId).remove();
    
    // 2. Check how many dependents are left
    const container = document.getElementById('dependentsContainer');
    if (container.children.length === 0) {
        // 3. If the container is completely empty, reset the counter!
        dependentCounter = 1; 
    }
}
async function submitPersonalDetails(event) {
    event.preventDefault();
    
    appState.proposer = {
        id: 'proposer',
        name: document.getElementById('proposerName').value,
        dob: document.getElementById('proposerDob').value,
        age: parseInt(document.getElementById('proposerAge').value),
        relationship: document.getElementById('proposerRelationship').value 
    };

    appState.dependents = [];
    const dependentElements = document.querySelectorAll('#dependentsContainer > div');
    dependentElements.forEach(dep => {
        const id = dep.id;
        appState.dependents.push({
            id: id,
            name: document.getElementById(`${id}-name`).value,
            dob: document.getElementById(`${id}-dob`).value,
            age: parseInt(document.getElementById(`${id}-age`).value),
            relationship: document.getElementById(`${id}-relationship`).value
        });
    });

    appState.kyc = {};
    const allMembers = [appState.proposer, ...appState.dependents];
    allMembers.forEach(m => {
        appState.kyc[m.id] = (m.age >= 10) ? 'Outstanding' : 'Exempt';
    });
    
    try {
        const dataToSave = {
            proposer: appState.proposer,
            dependents: appState.dependents,
            kyc: appState.kyc,
        };

        const result = await fetchWithUI('/policy', {
            method: 'POST',
            body: dataToSave
        });

        appState.policyId = result.policyId; 
        console.log('Policy draft created with ID:', appState.policyId);
        
        document.getElementById('policyStartDate').value = new Date().toISOString().split('T')[0];
        
        navigate('plan-details-page');
        
    } catch (err) {
        showMessage('Error', `Failed to save details: ${err.message}`);
    }
}

// --- Step 2: Plan Details ---
function submitPlanDetails(event) {
    event.preventDefault();
    
    appState.plan.product = document.getElementById('product-select').value;
    appState.plan.insurer = document.getElementById('insurer-select').value;
    appState.plan.policyStartDate = document.getElementById('policyStartDate').value;

    let basePremium = 1000 + (appState.dependents.length * 500);
    if (appState.plan.product.includes('Gold')) basePremium *= 1.5;
    if (appState.plan.product.includes('Basic')) basePremium *= 0.8;
    if (appState.plan.insurer.includes('Pioneer')) basePremium *= 1.1;
    
    appState.plan.basePremium = parseFloat(basePremium.toFixed(2));
    appState.plan.taxes = parseFloat((basePremium * 0.18).toFixed(2));
    appState.plan.totalPremium = parseFloat((basePremium + appState.plan.taxes).toFixed(2));
    
    document.getElementById('summaryProduct').textContent = appState.plan.product;
    document.getElementById('summaryInsurer').textContent = appState.plan.insurer;
    document.getElementById('summaryStartDate').textContent = new Date(appState.plan.policyStartDate).toLocaleDateString();
    document.getElementById('summaryProposerName').textContent = appState.proposer.name;
    document.getElementById('summaryDependentCount').textContent = appState.dependents.length;
    document.getElementById('summaryBasePremium').textContent = `$${appState.plan.basePremium.toFixed(2)}`;
    document.getElementById('summaryTaxes').textContent = `$${appState.plan.taxes.toFixed(2)}`;
    document.getElementById('summaryTotalPremium').textContent = `$${appState.plan.totalPremium.toFixed(2)}`;
    
    navigate('quote-summary-page');
}

// --- Step 3: Quote Summary ---
async function submitQuote() {
    try {
        await fetchWithUI(`/policy/${appState.policyId}/plan`, {
            method: 'PUT',
            body: {
                product: appState.plan.product,
                insurer: appState.plan.insurer,
                premium: appState.plan.totalPremium,
                basePremium: appState.plan.basePremium,
                taxes: appState.plan.taxes,
            }
        });

        renderKycList('kycListContainer', [appState.proposer, ...appState.dependents], appState.kyc);
        checkKycCompletion();
        navigate('buy-page');

    } catch (err) {
         showMessage('Error', `Failed to update plan: ${err.message}`);
    }
}

// --- Step 4: Buy & KYC ---
function renderKycList(containerId, members, kycStatusMap) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 
    
    members.forEach(member => {
        const memberId = member.id || member.CLIENT_SIDE_ID;
        const memberName = member.name || member.NAME;
        const relationship = member.relationship || member.RELATIONSHIP;
        const status = kycStatusMap[memberId] || member.KYC_STATUS;
        
        let statusClass, statusText, buttonHtml;
        
        switch (status) {
            case 'Confirmed':
                statusClass = 'text-green-600 bg-green-100';
                statusText = 'Confirmed';
                buttonHtml = `<span class="text-sm font-medium text-green-700">KYC Complete</span>`;
                break;
            case 'Exempt':
                statusClass = 'text-gray-600 bg-gray-100';
                statusText = 'Exempt';
                buttonHtml = `<span class="text-sm font-medium text-gray-700">(Under 10 years)</span>`;
                break;
            default: // 'Outstanding'
                statusClass = 'text-yellow-600 bg-yellow-100';
                statusText = 'Outstanding';
                // Added id and data-testid specific to the memberId
                buttonHtml = `<button id="btn-upload-kyc-${memberId}" data-testid="upload-kyc-button-${memberId}" onclick="openKycModal('${memberId}', '${memberName}')" class="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600">Upload</button>`;
        }
        
        const kycItemHtml = `
            <div class="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg">
                <div>
                    <p class="font-semibold text-gray-800">${memberName}</p>
                    <p class="text-sm text-gray-500">${relationship}</p>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                    ${buttonHtml}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', kycItemHtml);
    });
}

function checkKycCompletion() {
    const allKycDone = Object.values(appState.kyc).every(status => status === 'Confirmed' || status === 'Exempt');
    const buyButton = document.getElementById('buyNowButton');
    
    if (buyButton) {
        buyButton.disabled = false;
        if (allKycDone) {
            buyButton.textContent = 'Buy Now (Policy Active)';
        } else {
            buyButton.textContent = 'Buy Now (Policy Pended)';
        }
    }
    return allKycDone;
}

async function submitSingleKycUpload(clientSideId) {
    const poi = document.getElementById('poiFile').files[0];
    const poa = document.getElementById('poaFile').files[0];
    
    if (!poi || !poa) {
        showMessage('Missing Files', 'Please upload both Proof of Identity and Proof of Address.');
        return;
    }
    
    closeKycModal();

    try {
        const result = await fetchWithUI(`/kyc/${clientSideId}`, {
            method: 'PUT',
            body: { kycStatus: 'Confirmed' }
        });

        appState.kyc[clientSideId] = result.kycStatus;

        const currentPage = document.querySelector('.page.active').id;
        let membersList, containerId;
        
        if (currentPage === 'buy-page') {
            membersList = [appState.proposer, ...appState.dependents];
            containerId = 'kycListContainer';
        } else if (currentPage === 'dashboard-page') {
            membersList = appState.policy.members;
            containerId = 'pendedKycListContainer'; 
            const memberToUpdate = membersList.find(m => m.CLIENT_SIDE_ID === clientSideId);
            if (memberToUpdate) memberToUpdate.KYC_STATUS = result.kycStatus;
        }

        if (containerId) {
            renderKycList(containerId, membersList, appState.kyc);
        }
        
        checkKycCompletion();

    } catch (err) {
        showMessage('Upload Failed', `An error occurred: ${err.message}`);
    }
}

// --- Step 5: Purchase ---
async function submitPurchase() {
    const allKycDone = Object.values(appState.kyc).every(status => status === 'Confirmed' || status === 'Exempt');
    
    try {
        const result = await fetchWithUI(`/policy/${appState.policyId}/purchase`, {
            method: 'POST',
            body: { 
                allKycDone,
                policyStartDate: appState.plan.policyStartDate 
            }
        });

        appState.policyNumber = result.policyNumber;
        appState.policyStatus = result.policyStatus;
        
        document.getElementById('policyNumberDisplay').textContent = appState.policyNumber;
        const statusSpan = document.getElementById('finalPolicyStatus');
        statusSpan.textContent = appState.policyStatus;
        
        if (appState.policyStatus === 'Pended') {
            statusSpan.className = 'font-semibold text-yellow-600';
            document.getElementById('pendedMessage').classList.remove('hidden');
        } else {
            statusSpan.className = 'font-semibold text-green-600';
            document.getElementById('pendedMessage').classList.add('hidden');
        }
        
        navigate('confirmation-page');
        
    } catch (err) {
        showMessage('Purchase Failed', `An error occurred: ${err.message}`);
    }
}

function goToDashboard() {
    if (auth.user.role === 'ADMIN') {
        loadAdminDashboard();
    } else {
        loadMemberDashboard();
    }
}

// --- Member Dashboard ---
async function loadMemberDashboard() {
    try {
        const data = await apiFetch('/dashboard');
        const { policy, claims } = data;
        appState.policy = policy;

        const dashboardContainer = document.getElementById('dashboard-page');
        
        if (!policy) {
            dashboardContainer.innerHTML = `
                <h2 class="text-2xl font-semibold mb-4" data-testid="dashboard-welcome-header">Welcome, ${auth.user.email}</h2>
                <p class="text-gray-600 mb-6" data-testid="dashboard-no-policy-text">You do not have any active policies.</p>
                <button id="btn-start-new-app" data-testid="start-new-app-button" onclick="startNewApplication()" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    Start a New Application
                </button>
            `;
        }
        else if (policy.STATUS === 'Draft') {
            appState.policyId = policy.POLICY_ID;
            appState.policyStatus = policy.STATUS;
            appState.proposer = policy.members.find(m => m.RELATIONSHIP === 'Applicant');
            appState.dependents = policy.members.filter(m => m.RELATIONSHIP !== 'Applicant');
            appState.kyc = {};
            policy.members.forEach(m => {
                appState.kyc[m.CLIENT_SIDE_ID] = m.KYC_STATUS;
            });
            
            if (policy.PRODUCT_NAME) {
                appState.plan.product = policy.PRODUCT_NAME;
                appState.plan.insurer = policy.INSURER_NAME;
                appState.plan.totalPremium = policy.PREMIUM;
                appState.plan.basePremium = policy.BASE_PREMIUM;
                appState.plan.taxes = policy.TAXES;
                if (policy.POLICY_START_DATE) {
                    appState.plan.policyStartDate = new Date(policy.POLICY_START_DATE).toISOString().split('T')[0];
                }
            }

            dashboardContainer.innerHTML = `
                <h2 class="text-2xl font-semibold mb-4" data-testid="dashboard-welcome-header">Welcome, ${auth.user.email}</h2>
                <div class="p-6 mb-6 bg-blue-100 border border-blue-300 rounded-lg" data-testid="draft-policy-container">
                    <h3 class="text-xl font-semibold text-blue-800">You have an application in progress.</h3>
                    <p class="text-blue-700 mt-2 mb-4">Your application status is: <strong data-testid="draft-status-text">Draft</strong>.</p>
                    <button id="btn-resume-app" data-testid="resume-app-button" onclick="resumeApplication()" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        Resume Application
                    </button>
                </div>
            `;
        }
        else if (policy.STATUS === 'Pended') {
            appState.kyc = {};
            policy.members.forEach(m => {
                appState.kyc[m.CLIENT_SIDE_ID] = m.KYC_STATUS;
            });
            
            dashboardContainer.innerHTML = `
                <h2 class="text-2xl font-semibold mb-2" data-testid="dashboard-welcome-header">My Dashboard</h2>
                <p class="text-gray-600 mb-6">Welcome, ${auth.user.email}!</p>
                
                <div class="p-6 mb-6 bg-yellow-100 border border-yellow-300 rounded-lg" data-testid="pended-policy-container">
                    <h3 class="text-xl font-semibold text-yellow-800">Your Policy is Pended</h3>
                    <p class="text-yellow-700 mt-2 mb-4">Your policy (<span class="font-medium" data-testid="pended-policy-number">${policy.POLICY_NUMBER}</span>) is pending until all KYC documents are confirmed.</p>
                    <button id="btn-activate-pended" data-testid="activate-pended-button" onclick="activatePendedPolicy(${policy.POLICY_ID})" class="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                        I've Uploaded All Documents, Activate Now
                    </button>
                </div>

                <div class="mb-8">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Individual KYC Status</h3>
                    <div id="pendedKycListContainer" data-testid="pended-kyc-list-container" class="space-y-3">
                        </div>
                </div>
            `;
            renderKycList('pendedKycListContainer', policy.members, appState.kyc);
            
        } 
        else {
            dashboardContainer.innerHTML = `
                <h2 class="text-2xl font-semibold mb-6" data-testid="dashboard-welcome-header">My Dashboard</h2>
                <p class="text-gray-600 mb-6">Welcome, ${auth.user.email}!</p>
                
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8" data-testid="active-policy-container">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-xl font-semibold text-gray-800" data-testid="active-policy-product">${policy.PRODUCT_NAME}</h3>
                            <p class="text-gray-600">Policy: <span class="font-medium text-blue-600" data-testid="active-policy-number">${policy.POLICY_NUMBER}</span></p>
                        </div>
                        <span data-testid="active-policy-status" class="px-3 py-1 text-sm font-semibold rounded-full ${policy.STATUS === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${policy.STATUS}
                        </span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div><span class="text-sm text-gray-500">Insurer</span><p class="font-medium" data-testid="active-policy-insurer">${policy.INSURER_NAME}</p></div>
                        <div><span class="text-sm text-gray-500">Total Premium</span><p class="font-medium" data-testid="active-policy-premium">$${policy.PREMIUM.toFixed(2)}</p></div>
                        <div><span class="text-sm text-gray-500">Start Date</span><p class="font-medium" data-testid="active-policy-start-date">${new Date(policy.POLICY_START_DATE).toLocaleDateString()}</p></div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">Covered Members</h3>
                        <div class="space-y-3" data-testid="covered-members-list">
                            ${policy.members.map(m => `
                                <div class="flex justify-between items-center p-3 bg-white border rounded-lg" data-testid="member-row-${m.NAME.replace(/\s+/g, '-')}">
                                    <p class="font-medium text-gray-700">${m.NAME}</p>
                                    <span class="text-sm text-gray-500">${m.RELATIONSHIP}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-gray-800">My Claims</h3>
                            <button id="btn-file-claim" data-testid="file-new-claim-button" onclick="renderClaimForm()" class="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600 ${policy.STATUS !== 'Active' ? 'hidden' : ''}">
                                File New Claim
                            </button>
                        </div>
                        <div id="claimsContainer" data-testid="claims-container" class="space-y-3">
                            ${claims.length === 0 ? '<p class="text-sm text-gray-500" data-testid="no-claims-text">No claims filed yet.</p>' : 
                              claims.map(c => `
                                <div class="p-3 bg-white border rounded-lg" data-testid="claim-row-${c.CLAIM_ID}">
                                    <div class="flex justify-between items-center">
                                        <p class="font-medium text-gray-700">${c.CLAIM_ID} - ${c.MEMBER_NAME}</p>
                                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${getClaimStatusClass(c.STATUS)}" data-testid="claim-status-${c.CLAIM_ID}">
                                            ${c.STATUS}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-600 mt-2">${c.DETAILS}</p>
                                </div>
                              `).join('')
                            }
                        </div>
                    </div>
                </div>
            `;
        }
        
        navigate('dashboard-page');
        
    } catch (err) {
        showMessage('Error', `Failed to load dashboard: ${err.message}`);
        handleLogout();
    }
}

function resumeApplication() {
    document.getElementById('proposerName').value = appState.proposer.NAME;
    document.getElementById('proposerDob').value = new Date(appState.proposer.DOB).toISOString().split('T')[0];
    document.getElementById('proposerAge').value = appState.proposer.AGE;
    document.getElementById('proposerRelationship').value = appState.proposer.RELATIONSHIP;
    
    const container = document.getElementById('dependentsContainer');
    container.innerHTML = '';
    appState.dependents.forEach(dep => {
        const dependentId = dep.CLIENT_SIDE_ID;
        const dependentHtml = `
            <div id="${dependentId}" class="p-4 border border-gray-300 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-2">
                        <label for="${dependentId}-name" class="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" id="${dependentId}-name" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required value="${dep.NAME}">
                    </div>
                    <div>
                        <label for="${dependentId}-dob" class="block text-sm font-medium text-gray-700">Date of Birth</label>
                        <input type="date" id="${dependentId}-dob" placeholder="YYYY-MM-DD" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required onchange="calculateAge('${dependentId}-dob', '${dependentId}-age')" value="${new Date(dep.DOB).toISOString().split('T')[0]}">
                        <input type="hidden" id="${dependentId}-age" value="${dep.AGE}">
                    </div>
                    <div>
                        <label for="${dependentId}-relationship" class="block text-sm font-medium text-gray-700">Relationship</label>
                        <select id="${dependentId}-relationship" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required>
                            <option value="Wife" ${dep.RELATIONSHIP === 'Wife' ? 'selected' : ''}>Wife</option>
                            <option value="Son" ${dep.RELATIONSHIP === 'Son' ? 'selected' : ''}>Son</option>
                            <option value="Daughter" ${dep.RELATIONSHIP === 'Daughter' ? 'selected' : ''}>Daughter</option>
                            <option value="Father" ${dep.RELATIONSHIP === 'Father' ? 'selected' : ''}>Father</option>
                            <option value="Mother" ${dep.RELATIONSHIP === 'Mother' ? 'selected' : ''}>Mother</option>
                        </select>
                    </div>
                </div>
                <div class="text-right mt-2">
                    <button type="button" onclick="removeDependent('${dependentId}')" class="px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600">
                        Remove
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', dependentHtml);
    });
    
    // ADD THIS NEW BLOCK: 
    // Sync the counter so new dependents continue the sequence
    if (appState.dependents.length > 0) {
        const maxId = Math.max(...appState.dependents.map(d => parseInt(d.CLIENT_SIDE_ID.replace('dep-', '')) || 0));
        dependentCounter = maxId + 1;
    }

    if (!appState.plan.product) {
        navigate('plan-details-page');
    } else {
        document.getElementById('product-select').value = appState.plan.product;
        document.getElementById('insurer-select').value = appState.plan.insurer;
        document.getElementById('policyStartDate').value = (appState.plan.policyStartDate || new Date()).toISOString().split('T')[0];
        
        document.getElementById('summaryProduct').textContent = appState.plan.product;
        document.getElementById('summaryInsurer').textContent = appState.plan.insurer;
        document.getElementById('summaryStartDate').textContent = new Date(document.getElementById('policyStartDate').value).toLocaleDateString();
        document.getElementById('summaryProposerName').textContent = appState.proposer.NAME;
        document.getElementById('summaryDependentCount').textContent = appState.dependents.length;
        document.getElementById('summaryBasePremium').textContent = `$${appState.plan.basePremium.toFixed(2)}`;
        document.getElementById('summaryTaxes').textContent = `$${appState.plan.taxes.toFixed(2)}`;
        document.getElementById('summaryTotalPremium').textContent = `$${appState.plan.totalPremium.toFixed(2)}`;
        
        navigate('quote-summary-page');
    }
}

function getClaimStatusClass(status) {
    switch(status) {
        case 'Submitted': return 'bg-yellow-100 text-yellow-700';
        case 'Approved': return 'bg-blue-100 text-blue-700';
        case 'Paid': return 'bg-green-100 text-green-700';
        case 'Rejected': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

async function activatePendedPolicy(policyId) {
    if (!confirm('Are you sure you have uploaded all required KYC documents?')) {
        return;
    }
    
    try {
        await fetchWithUI(`/policy/${policyId}/activate-kyc`, {
            method: 'PUT'
        });
        
        showMessage('Success', 'Your policy is now Active!');
        loadMemberDashboard(); 
        
    } catch (err) {
        showMessage('Activation Failed', err.message);
    }
}

function renderClaimForm() {
    const container = document.getElementById('claimsContainer');
    const membersOptions = appState.policy.members.map(m => `<option value="${m.NAME}">${m.NAME}</option>`).join('');
    
    container.innerHTML = `
        <div class="p-4 bg-gray-50 border rounded-lg" data-testid="new-claim-form-container">
            <h4 class="font-semibold mb-4">New Claim Details</h4>
            <form id="claimForm" data-testid="new-claim-form" onsubmit="submitClaim(event)">
                <div class="mb-4">
                    <label for="claimMember" class="block text-sm font-medium text-gray-700">For Member</label>
                    <select id="claimMember" name="claimMember" data-testid="claim-member-select" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        ${membersOptions}
                    </select>
                </div>
                <div class="mb-4">
                    <label for="claimDetails" class="block text-sm font-medium text-gray-700">Claim Details</label>
                    <textarea id="claimDetails" name="claimDetails" data-testid="claim-details-textarea" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required></textarea>
                </div>
                <div class="flex justify-end space-x-2">
                    <button type="button" id="btn-cancel-claim" data-testid="cancel-claim-button" onclick="loadMemberDashboard()" class="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300">
                        Cancel
                    </button>
                    <button type="submit" id="btn-submit-claim" data-testid="submit-claim-button" class="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600">
                        Submit Claim
                    </button>
                </div>
            </form>
        </div>
        ${container.innerHTML}
    `;
}

async function submitClaim(event) {
    event.preventDefault();
    
    const claimData = {
        policyId: appState.policy.POLICY_ID,
        member: document.getElementById('claimMember').value,
        details: document.getElementById('claimDetails').value,
        claimId: `CLM-${Date.now()}` 
    };

    try {
        await fetchWithUI('/claims', {
            method: 'POST',
            body: claimData
        });
        
        showMessage('Success', 'Your claim has been submitted.');
        loadMemberDashboard(); 
        
    } catch (err) {
        showMessage('Claim Failed', err.message);
    }
}

// --- Admin Dashboard ---
async function loadAdminDashboard() {
    try {
        const [members, claims, policies] = await Promise.all([
            fetchWithUI('/admin/members'),
            fetchWithUI('/admin/claims'),
            fetchWithUI('/admin/policies')
        ]);

        const container = document.getElementById('admin-dashboard-page');
        container.innerHTML = `
            <h2 class="text-2xl font-semibold mb-6">Admin Dashboard</h2>
            <p class="text-gray-600 mb-6">Welcome, ${auth.user.email}!</p>
            
            <div class="mb-6 border-b border-gray-200">
                <nav class="flex space-x-8" aria-label="Tabs">
                    <button id="tab-claims" onclick="showAdminTab('claims')" class="px-1 py-4 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
                        Manage Claims (${claims.length})
                    </button>
                    <button id="tab-policies" onclick="showAdminTab('policies')" class="px-1 py-4 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Manage Policies (${policies.length})
                    </button>
                    <button id="tab-members" onclick="showAdminTab('members')" class="px-1 py-4 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        View Members (${members.length})
                    </button>
                </nav>
            </div>

            <div id="panel-claims" class="admin-panel">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">All Claims</h3>
                <div class="space-y-4">
                    ${claims.map(c => renderAdminClaim(c)).join('')}
                </div>
            </div>

            <div id="panel-policies" class="admin-panel hidden">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">All Policies</h3>
                <div class="space-y-4">
                    ${policies.map(p => renderAdminPolicy(p)).join('')}
                </div>
            </div>

            <div id="panel-members" class="admin-panel hidden">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">All Members</h3>
                <div class="space-y-4">
                    ${members.map(m => `
                        <div class="p-4 bg-white border rounded-lg flex justify-between items-center">
                            <div>
                                <p class="font-medium">${m.EMAIL}</p>
                                <p class="text-sm text-gray-500">${m.USER_ID} | Joined: ${new Date(m.CREATED_AT).toLocaleDateString()}</p>
                            </div>
                            <span class="text-sm font-semibold ${m.ROLE === 'ADMIN' ? 'text-blue-600' : 'text-gray-600'}">${m.ROLE}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        navigate('admin-dashboard-page');
    } catch (err) {
        showMessage('Error', `Failed to load admin dashboard: ${err.message}`);
    }
}

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('#admin-dashboard-page nav button').forEach(b => {
        b.classList.remove('border-blue-500', 'text-blue-600');
        b.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    });
    
    document.getElementById(`panel-${tabName}`).classList.remove('hidden');
    const tabButton = document.getElementById(`tab-${tabName}`);
    tabButton.classList.add('border-blue-500', 'text-blue-600');
    tabButton.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
}

function renderAdminClaim(claim) {
    const isPending = claim.STATUS === 'Submitted' || claim.STATUS === 'Approved';
    
    return `
        <div id="claim-${claim.CLAIM_DB_ID}" class="p-4 bg-white border rounded-lg">
            <div class="flex flex-wrap justify-between items-start">
                <div>
                    <p class="font-semibold">${claim.CLAIM_ID} - ${claim.MEMBER_NAME}</p>
                    <p class="text-sm text-gray-500">Policy: ${claim.POLICY_NUMBER || 'N/A'} | Submitted: ${new Date(claim.SUBMITTED_AT).toLocaleString()}</p>
                    <p class="text-gray-700 mt-2">${claim.DETAILS}</p>
                </div>
                <div class="flex flex-col items-end space-y-2 mt-2 md:mt-0">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${getClaimStatusClass(claim.STATUS)}">
                        ${claim.STATUS}
                    </span>
                    ${isPending ? `
                    <div class="flex space-x-2">
                        <button onclick="updateClaimStatus(${claim.CLAIM_DB_ID}, 'Paid')" class="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600">
                            Pay
                        </button>
                        <button onclick="updateClaimStatus(${claim.CLAIM_DB_ID}, 'Rejected')" class="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600">
                            Reject
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderAdminPolicy(policy) {
    const isActive = policy.STATUS === 'Active' || policy.STATUS === 'Pended';
    
    return `
        <div id="policy-${policy.POLICY_ID}" class="p-4 bg-white border rounded-lg">
            <div class="flex flex-wrap justify-between items-start">
                <div>
                    <p class="font-semibold">${policy.POLICY_NUMBER || 'Draft'} - ${policy.PRODUCT_NAME || 'N/A'}</p>
                    <p class="text-sm text-gray-500">User: ${policy.USER_ID}</p>
                </div>
                <div class="flex flex-col items-end space-y-2 mt-2 md:mt-0">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${policy.STATUS === 'Active' ? 'bg-green-100 text-green-700' : (policy.STATUS === 'Pended' ? 'bg-yellow-100 text-yellow-700' : (policy.STATUS === 'Draft' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'))}">
                        ${policy.STATUS}
                    </span>
                    <div class="flex space-x-2">
                        ${isActive ? `
                        <button onclick="updatePolicyStatus(${policy.POLICY_ID}, 'Lapsed')" class="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600">
                            Lapse
                        </button>
                        ` : (policy.STATUS === 'Lapsed' ? `
                        <button onclick="updatePolicyStatus(${policy.POLICY_ID}, 'Active')" class="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-md hover:bg-green-600">
                            Reinstate
                        </button>
                        ` : '')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function updateClaimStatus(claimDbId, status) {
    if (!confirm(`Are you sure you want to mark this claim as "${status}"?`)) return;
    
    try {
        await fetchWithUI(`/admin/claims/${claimDbId}`, {
            method: 'PUT',
            body: { status }
        });
        
        const updatedClaims = await fetchWithUI('/admin/claims');
        const updatedClaim = updatedClaims.find(c => c.CLAIM_DB_ID === claimDbId);
        if (updatedClaim) {
            document.getElementById(`claim-${claimDbId}`).outerHTML = renderAdminClaim(updatedClaim);
        }
        
    } catch (err) {
        showMessage('Update Failed', err.message);
    }
}

async function updatePolicyStatus(policyId, status) {
    if (!confirm(`Are you sure you want to mark this policy as "${status}"?`)) return;
    
    try {
        await fetchWithUI(`/admin/policy/${policyId}`, {
            method: 'PUT',
            body: { status }
        });
        
        const updatedPolicies = await fetchWithUI('/admin/policies');
        const updatedPolicy = updatedPolicies.find(p => p.POLICY_ID === policyId);
        if (updatedPolicy) {
            document.getElementById(`policy-${policyId}`).outerHTML = renderAdminPolicy(updatedPolicy);
        }
        
    } catch (err) {
        showMessage('Update Failed', err.message);
    }
}

// --- GLOBAL BINDINGS ---
// Bind everything to the window object so inline HTML onclick handlers still work
window.navigate = navigate;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleRegistration = handleRegistration;
window.startNewApplication = startNewApplication;
window.calculateAge = calculateAge;
window.addDependent = addDependent;
window.removeDependent = removeDependent;
window.submitPersonalDetails = submitPersonalDetails;
window.submitPlanDetails = submitPlanDetails;
window.submitQuote = submitQuote;
window.submitPurchase = submitPurchase;
window.openKycModal = openKycModal;
window.closeKycModal = closeKycModal;
window.submitSingleKycUpload = submitSingleKycUpload;
window.closeMessageModal = closeMessageModal;
window.goToDashboard = goToDashboard;
window.resumeApplication = resumeApplication;
window.activatePendedPolicy = activatePendedPolicy;
window.renderClaimForm = renderClaimForm;
window.submitClaim = submitClaim;
window.showAdminTab = showAdminTab;
window.updateClaimStatus = updateClaimStatus;
window.updatePolicyStatus = updatePolicyStatus;
window.loadMemberDashboard = loadMemberDashboard;

// Initialize on Load
document.addEventListener('DOMContentLoaded', checkSession);