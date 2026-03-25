# SecureLife Insurance App - PostgreSQL & Node Setup Guide

Setup SecureLife Insurance Web application on a Windows machine locally.

---

## Prerequisites

Before starting, ensure you have the following downloaded:

- **Node.js**: Download and install the LTS version from https://nodejs.org/
- **PostgreSQL**: Download the Windows installer from https://www.postgresql.org/download/windows/

---

## Step 1: Install and Configure PostgreSQL

1. Run the PostgreSQL installer you downloaded.
2. Follow the setup wizard. Ensure that:

   - PostgreSQL Server
   - pgAdmin 4 (visual management tool)  
      are selected.

3. **Crucial Step:** Set a password for the default database superuser (`postgres`).

   - Example: `YourSecurePassword`

4. Leave the default port as `5432`.
5. Finish the installation.

---

## Step 2: Create the Database

1. Open **pgAdmin 4** from the Start menu.
2. Enter the master password to connect.
3. Navigate:

```sh
Servers > PostgreSQL > Databases
```

Right-click Databases → Create → Database...

Enter database name:

```bash
insurance_db
```

Click Save.

---

## Step 3: Initialize the Database Schema

Select insurance_db in pgAdmin.

Click:

```bash
Tools > Query Tool
```

Open insurance-db\postgreSQL-db.sql, copy all content, and paste it.

Click Execute (▶) or press F5.

Ensure you see:

```bash
Query returned successfully
```

---

## Step 4: Open Project in VS Code

1. Open Visual Studio Code.
2. Click on **File → Open Folder**.
3. Select your project folder:

```sh
insurance-web-app
```

4. Ensure you can see both:
   - insurance-api (Backend)
   - insurance-frontend (Frontend)

---

## Step 5: Configure Environment Variables (.env)

To keep the application secure and organized, the project is split into two folders: insurance-api (Backend) and insurance-frontend (Frontend). You must configure the environment variables for both.

### 1. Backend Environment (insurance-api)

Navigate to your backend folder:

```dos
cd insurance-api
```

Create a file named .env and add your database credentials:

```sh
PORT=3000
JWT_SECRET=my-app-is-super-secret-123!
DB_USER=postgres
DB_HOST=localhost
DB_NAME=insurance_db
DB_PASSWORD=YourSecurePassword
DB_PORT=5432
```

---

### 2. Frontend Environment (insurance-frontend)

Open a new terminal and navigate to your frontend folder:

```dos
cd insurance-frontend
```

Create a file named .env and configure Vite to point to your local backend:

```sh
VITE_API_URL=http://localhost:3000/api
```

---

## Step 6: Install Dependencies

Ensure all node modules are properly installed for both parts of the application.

### 1. Install Backend Dependencies

In your backend terminal:

```dos
cd insurance-api
npm install
```

---

### 2. Install Frontend Dependencies

In your frontend terminal:

```dos
cd insurance-frontend
npm install
```

---

## Step 7: Run the Application

You will need two separate terminal windows open to run the full stack simultaneously.

### Terminal 1: Start the Backend API

Make sure you are in directory : yourProjectPath\insurance-web-app\insurance-api>

Run below command

```dos
npm run start-server
```

Expected output: PostgreSQL API Server running on http://localhost:3000

---

### Terminal 2: Start the Frontend

Make sure you are in directory : yourProjectPath\insurance-web-app\insurance-frontend>

Run below command

```dos
npm run dev
```

Expected output: A local server link, usually http://localhost:5173. CTRL + Click this link to open the app in your browser.

---

## Step 8: Test the App

### Admin Login

Email: admin@securelife.com  
Password: admin123

---

### Member Flow

- Click Register here
- Create a new account
- Log in and test policy creation
