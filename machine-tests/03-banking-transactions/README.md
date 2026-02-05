# Banking Transaction API

## Overview
A banking API for account management and money transfers. This system handles deposits, withdrawals, and transfers between accounts.

**Important**: This is a financial system. Security and data integrity are critical.

## Setup
```bash
npm install
npm run dev
```

Server runs on `http://localhost:3003`

## API Endpoints

### Accounts
- `GET /api/accounts` - List all accounts
- `GET /api/accounts/:id` - Get account details
- `GET /api/accounts/:id/balance` - Get balance
- `POST /api/accounts` - Create account
- `PATCH /api/accounts/:id/status` - Update account status

### Transactions
- `GET /api/transactions` - List transactions (filter by `accountId`)
- `POST /api/transactions/deposit` - Deposit money
- `POST /api/transactions/withdraw` - Withdraw money
- `POST /api/transactions/transfer` - Transfer between accounts
- `POST /api/transactions/:id/reverse` - Reverse transaction (admin)

## Sample Requests

### Create Account
```json
POST /api/accounts
{
  "holderName": "John Doe",
  "initialDeposit": 1000,
  "pin": "1234"
}
```

### Deposit
```json
POST /api/transactions/deposit
{
  "accountId": 1,
  "amount": 500
}
```

### Withdraw
```json
POST /api/transactions/withdraw
{
  "accountId": 1,
  "amount": 200,
  "pin": "1234"
}
```

### Transfer
```json
POST /api/transactions/transfer
{
  "fromAccountId": 1,
  "toAccountId": 2,
  "amount": 100,
  "pin": "1234",
  "description": "Payment"
}
```

---

## Your Task

This banking system has **serious security vulnerabilities** and bugs. Find and fix them.

### Critical Focus Areas
- **Security** - Authentication, authorization, data exposure
- **Data Integrity** - Transaction atomicity, race conditions
- **Validation** - Input validation, edge cases
- **Financial Logic** - Balance integrity, transaction correctness

### Time Limit
60 minutes (extended due to difficulty)

### Deliverables
1. Fixed code with security improvements
2. List of all vulnerabilities found
3. Explanation of why each fix is important

**This is a senior-level challenge. Think like an attacker.**

Good luck!
