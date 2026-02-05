# SOLUTION - Banking Transactions (Interviewer Only)

## Bug List (30 Total - Hard Challenge)

### Accounts Route (`src/routes/accounts.ts`)

| # | Bug | Severity | Category |
|---|-----|----------|----------|
| 1 | **PIN Exposure** - Returns PIN in list response | Critical | Security |
| 2 | **SQL Injection** - ID parameter directly concatenated | Critical | Security |
| 3 | **PIN in Response** - Single account returns PIN | Critical | Security |
| 4 | **No Auth on Balance** - Anyone can check any balance | High | Security |
| 5 | **Weak PIN Allowed** - No PIN strength validation | High | Security |
| 6 | **No Name Validation** - Empty/null names allowed | Medium | Validation |
| 7 | **Plain Text PIN** - PIN not hashed | Critical | Security |
| 8 | **PIN in Create Response** - Returns PIN after creation | Critical | Security |
| 9 | **No Auth on Status** - Anyone can freeze accounts | Critical | Security |
| 10 | **Status Not Validated** - Any string accepted | Medium | Validation |

### Transactions Route (`src/routes/transactions.ts`)

| # | Bug | Severity | Category |
|---|-----|----------|----------|
| 11 | **No Auth on History** - View any account's transactions | Critical | Security |
| 12 | **Negative Amount** - Can deposit negative (steal money) | Critical | Logic |
| 13 | **Precision Issues** - Excessive decimal places | Medium | Validation |
| 14 | **Frozen Account Deposit** - Can deposit to frozen account | Medium | Logic |
| 15 | **Timing Attack** - PIN comparison leaks info | High | Security |
| 16 | **No Rate Limit** - Brute force PIN possible | Critical | Security |
| 17 | **Float Comparison** - Balance check can fail | Medium | Logic |
| 18 | **Race Condition (Withdraw)** - Check-then-update not atomic | Critical | Integrity |
| 19 | **Balance Exposure** - Returns remaining balance | Medium | Security |
| 20 | **Self Transfer** - Can transfer to same account | Low | Logic |
| 21 | **Frozen Account Transfer** - No status check | High | Logic |
| 22 | **No Transaction** - Transfer not atomic | Critical | Integrity |
| 23 | **Race Condition (Transfer)** - Double-spend possible | Critical | Integrity |
| 24 | **No Auth on Reverse** - Anyone can reverse transactions | Critical | Security |
| 25 | **Double Reverse** - Can reverse already reversed tx | High | Logic |
| 26 | **No Audit Log** - No trail for reversals | High | Compliance |

### Main App (`src/index.ts`)

| # | Bug | Severity | Category |
|---|-----|----------|----------|
| 27 | **No HTTPS** - Financial data over plain HTTP | Critical | Security |
| 28 | **No Rate Limiting** - DoS and brute force possible | High | Security |
| 29 | **No Audit Logging** - No request trail | High | Compliance |
| 30 | **No Error Handler** - Stack traces exposed | Medium | Security |

---

## Critical Fixes Required

### Bug #2 & #22: SQL Injection & Transaction
```typescript
// BEFORE - SQL Injection
const account = db.prepare(`SELECT * FROM accounts WHERE id = ${id}`).get();

// AFTER - Parameterized
const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);

// AFTER - Atomic Transfer with Transaction
const transfer = db.transaction((from, to, amount) => {
  const fromAcc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(from);
  if (fromAcc.balance < amount) throw new Error('Insufficient funds');
  
  const result = db.prepare(
    'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?'
  ).run(amount, from, amount);
  
  if (result.changes === 0) throw new Error('Balance changed');
  
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, to);
  
  return db.prepare('INSERT INTO transactions...').run(...);
});

try {
  transfer(fromAccountId, toAccountId, amount);
} catch (e) {
  res.status(400).json({ error: e.message });
}
```

### Bug #7: PIN Hashing
```typescript
import crypto from 'crypto';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin + 'salt').digest('hex');
}

function verifyPin(pin: string, hash: string): boolean {
  // Use timing-safe comparison
  const inputHash = hashPin(pin);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}
```

### Bug #12: Amount Validation
```typescript
if (!amount || typeof amount !== 'number' || amount <= 0) {
  res.status(400).json({ error: 'Invalid amount' });
  return;
}

// Round to 2 decimal places
const sanitizedAmount = Math.round(amount * 100) / 100;

if (sanitizedAmount <= 0 || sanitizedAmount > 1000000) {
  res.status(400).json({ error: 'Amount out of range' });
  return;
}
```

### Bug #15 & #16: Timing Attack & Rate Limiting
```typescript
// Timing-safe comparison
import crypto from 'crypto';

function verifyPin(inputPin: string, storedHash: string): boolean {
  const inputHash = hashPin(inputPin);
  return crypto.timingSafeEqual(
    Buffer.from(inputHash, 'utf8'), 
    Buffer.from(storedHash, 'utf8')
  );
}

// Rate limiting (add to middleware)
import rateLimit from 'express-rate-limit';

const pinAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many PIN attempts, account locked'
});

app.use('/api/transactions/withdraw', pinAttemptLimiter);
app.use('/api/transactions/transfer', pinAttemptLimiter);
```

---

## Scoring Rubric

| Score | Bugs Found | Fix Quality |
|-------|------------|-------------|
| 1-3 | 1-8 bugs | Basic understanding |
| 4-5 | 9-15 bugs | Good security awareness |
| 6-7 | 16-22 bugs | Strong security knowledge |
| 8-9 | 23-27 bugs | Excellent, production-ready |
| 10 | 28-30 bugs | Expert level, full solutions |

## Must-Find Bugs (Automatic Fail if Missed)
- SQL Injection (#2)
- PIN Exposure (#1, #3, #8)
- Race Condition / No Transaction (#22, #23)
- Negative Amount (#12)

## Senior-Level Expectations
- Identifies timing attack vulnerability
- Suggests proper PIN hashing (bcrypt/argon2)
- Mentions need for HTTPS
- Suggests rate limiting
- Uses transactions for financial ops
