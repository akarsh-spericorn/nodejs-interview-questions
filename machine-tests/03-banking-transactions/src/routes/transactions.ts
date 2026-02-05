import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { TransferRequest, DepositRequest, WithdrawalRequest } from '../types';

const router = Router();

// Get transaction history
router.get('/', (req: Request, res: Response) => {
  const { accountId } = req.query;
  
  let query = 'SELECT * FROM transactions';
  let params: any[] = [];
  
  if (accountId) {
    query += ' WHERE from_account = ? OR to_account = ?';
    params = [accountId, accountId];
  }
  
  query += ' ORDER BY created_at DESC';
  
  // BUG #11: No authentication - can view any account's transactions
  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

// Deposit money
router.post('/deposit', (req: Request, res: Response) => {
  const { accountId, amount } = req.body as DepositRequest;
  
  // BUG #12: No validation - amount can be negative
  // BUG #13: No validation - amount can have excessive decimals
  
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
  
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  
  // BUG #14: No check for frozen/closed account status
  
  const transactionId = uuidv4();
  
  // Update balance
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, accountId);
  
  // Record transaction
  db.prepare(`
    INSERT INTO transactions (id, from_account, to_account, type, amount, description, status, created_at)
    VALUES (?, NULL, ?, 'deposit', ?, 'Cash deposit', 'completed', ?)
  `).run(transactionId, accountId, amount, new Date().toISOString());
  
  res.json({ transactionId, message: 'Deposit successful' });
});

// Withdraw money
router.post('/withdraw', (req: Request, res: Response) => {
  const { accountId, amount, pin } = req.body as WithdrawalRequest;
  
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
  
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  
  // BUG #15: PIN comparison vulnerable to timing attack
  // BUG #16: No rate limiting - brute force PIN attack possible
  if (account.pin !== pin) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }
  
  // BUG #17: Floating point comparison - can cause issues
  if (account.balance < amount) {
    res.status(400).json({ error: 'Insufficient funds' });
    return;
  }
  
  // BUG #18: Race condition - balance checked then updated separately
  
  const transactionId = uuidv4();
  
  db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, accountId);
  
  db.prepare(`
    INSERT INTO transactions (id, from_account, to_account, type, amount, description, status, created_at)
    VALUES (?, ?, NULL, 'withdrawal', ?, 'ATM withdrawal', 'completed', ?)
  `).run(transactionId, accountId, amount, new Date().toISOString());
  
  // BUG #19: Returning new balance exposes financial info
  const newBalance = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(accountId) as any;
  
  res.json({ 
    transactionId, 
    message: 'Withdrawal successful',
    remainingBalance: newBalance.balance  // Sensitive info!
  });
});

// Transfer money
router.post('/transfer', (req: Request, res: Response) => {
  const { fromAccountId, toAccountId, amount, pin, description } = req.body as TransferRequest;
  
  // BUG #20: No validation that fromAccountId !== toAccountId
  
  const fromAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(fromAccountId) as any;
  const toAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(toAccountId) as any;
  
  if (!fromAccount) {
    res.status(404).json({ error: 'Source account not found' });
    return;
  }
  
  if (!toAccount) {
    res.status(404).json({ error: 'Destination account not found' });
    return;
  }
  
  if (fromAccount.pin !== pin) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }
  
  // BUG #21: No check for account status (frozen/closed)
  
  if (fromAccount.balance < amount) {
    res.status(400).json({ error: 'Insufficient funds' });
    return;
  }
  
  // BUG #22: Not using transaction - if second update fails, money disappears
  // BUG #23: No atomicity - balance can change between check and update
  
  const transactionId = uuidv4();
  
  // Deduct from source
  db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, fromAccountId);
  
  // Add to destination
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, toAccountId);
  
  // Record transaction
  db.prepare(`
    INSERT INTO transactions (id, from_account, to_account, type, amount, description, status, created_at)
    VALUES (?, ?, ?, 'transfer', ?, ?, 'completed', ?)
  `).run(transactionId, fromAccountId, toAccountId, amount, description || 'Transfer', new Date().toISOString());
  
  res.json({ transactionId, message: 'Transfer successful' });
});

// Reverse transaction (admin)
router.post('/:id/reverse', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #24: No authentication/authorization for admin action
  
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  
  if (!transaction) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  
  // BUG #25: Can reverse already reversed transactions
  // BUG #26: No audit logging
  
  if (transaction.type === 'transfer') {
    // Reverse: add back to from, subtract from to
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(transaction.amount, transaction.from_account);
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(transaction.amount, transaction.to_account);
  } else if (transaction.type === 'withdrawal') {
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(transaction.amount, transaction.from_account);
  } else if (transaction.type === 'deposit') {
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(transaction.amount, transaction.to_account);
  }
  
  db.prepare("UPDATE transactions SET status = 'reversed' WHERE id = ?").run(id);
  
  res.json({ message: 'Transaction reversed' });
});

export default router;
