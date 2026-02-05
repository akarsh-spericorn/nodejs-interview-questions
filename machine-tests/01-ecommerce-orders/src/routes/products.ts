import { Router, Request, Response } from 'express';
import db from '../database';
import { Product } from '../types';

const router = Router();

// BUG #1: SQL Injection vulnerability in search
router.get('/', (req: Request, res: Response) => {
  const { search, minPrice, maxPrice } = req.query;
  
  let query = 'SELECT * FROM products WHERE 1=1';
  
  if (search) {
    // VULNERABLE: Direct string concatenation
    query += ` AND name LIKE '%${search}%'`;
  }
  
  if (minPrice) {
    query += ` AND price >= ${minPrice}`;
  }
  
  if (maxPrice) {
    query += ` AND price <= ${maxPrice}`;
  }
  
  const products = db.prepare(query).all();
  res.json(products);
});

// Get single product
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  
  // BUG #2: Wrong status code - should be 404, not 200 with null
  if (!product) {
    res.json(null);
    return;
  }
  
  res.json(product);
});

// BUG #3: No input validation on create
router.post('/', (req: Request, res: Response) => {
  const { name, price, stock } = req.body;
  
  // Missing validation - price could be negative, name could be empty
  const result = db.prepare(
    'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)'
  ).run(name, price, stock);
  
  res.json({ id: result.lastInsertRowid, name, price, stock });
});

// Update stock
router.patch('/:id/stock', (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  // BUG #4: No check if product exists before update
  // BUG #5: Stock can go negative - no validation
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, id);
  
  res.json({ message: 'Stock updated' });
});

export default router;
