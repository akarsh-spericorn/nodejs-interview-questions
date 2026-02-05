import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all accounts
router.get('/', (req: Request, res: Response) => {
  const accounts = db.prepare('SELECT * FROM accounts').all();
  
  // BUG #1: Exposing sensitive data (PIN) in response
  res.json(accounts);
});

// Get account by ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #2: SQL injection possible through ID parameter
  const account = db.prepare(`SELECT * FROM accounts WHERE id = ${id}`).get();
  
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  
  // BUG #3: Still exposing PIN
  res.json(account);
});

// Get account balance
router.get('/:id/balance', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const account = db.prepare('SELECT id, balance FROM accounts WHERE id = ?').get(id) as any;
  
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  
  // BUG #4: No authentication - anyone can check any account's balance
  res.json({ balance: account.balance });
});

// Create account
router.post('/', (req: Request, res: Response) => {
  const { holderName, initialDeposit, pin } = req.body;
  
  // BUG #5: No validation of PIN strength (should be 4-6 digits)
  // BUG #6: No validation of holder name
  // BUG #7: PIN stored as plain text (should be hashed)
  
  const accountNumber = `ACC${Date.now()}`;
  
  const result = db.prepare(`
    INSERT INTO accounts (account_number, holder_name, balance, status, pin, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `).run(accountNumber, holderName, initialDeposit || 0, pin, new Date().toISOString());
  
  // BUG #8: Returning PIN in response
  res.json({
    id: result.lastInsertRowid,
    accountNumber,
    holderName,
    balance: initialDeposit || 0,
    pin  // Should never return PIN!
  });
});

// Update account status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // BUG #9: No authentication/authorization
  // BUG #10: No validation of status value
  
  db.prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: 'Status updated' });
});

export default router;
