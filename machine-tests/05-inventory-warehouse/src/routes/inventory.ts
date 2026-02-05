import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { TransferRequest, StockAdjustmentRequest } from '../types';

const router = Router();

// Get stock levels across all warehouses
router.get('/stock', (req: Request, res: Response) => {
  const { warehouseId, productId, lowStock } = req.query;
  
  let query = `
    SELECT s.*, w.name as warehouse_name, p.name as product_name, p.sku, p.reorder_level
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (warehouseId) {
    query += ' AND s.warehouse_id = ?';
    params.push(warehouseId);
  }
  
  if (productId) {
    query += ' AND s.product_id = ?';
    params.push(productId);
  }
  
  // BUG #1: Low stock filter logic is inverted
  if (lowStock === 'true') {
    query += ' AND s.quantity > p.reorder_level';  // Should be <, not >
  }
  
  const stock = db.prepare(query).all(...params);
  res.json(stock);
});

// Get single stock record
router.get('/stock/:warehouseId/:productId', (req: Request, res: Response) => {
  const { warehouseId, productId } = req.params;
  
  const stock = db.prepare(`
    SELECT s.*, w.name as warehouse_name, p.name as product_name
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
    WHERE s.warehouse_id = ? AND s.product_id = ?
  `).get(warehouseId, productId);
  
  // BUG #2: Returns undefined instead of 404
  res.json(stock);
});

// Receive stock (inbound)
router.post('/receive', (req: Request, res: Response) => {
  const { warehouseId, productId, quantity, reference } = req.body;
  
  // BUG #3: No validation of required fields
  // BUG #4: No validation that quantity is positive
  
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouseId);
  if (!warehouse) {
    res.status(404).json({ error: 'Warehouse not found' });
    return;
  }
  
  // BUG #5: No check if product exists
  
  // BUG #6: No capacity check for warehouse
  
  // Check if stock record exists
  const existingStock = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(warehouseId, productId) as any;
  
  const now = new Date().toISOString();
  
  if (existingStock) {
    db.prepare(`
      UPDATE stock SET quantity = quantity + ?, last_updated = ?
      WHERE warehouse_id = ? AND product_id = ?
    `).run(quantity, now, warehouseId, productId);
  } else {
    db.prepare(`
      INSERT INTO stock (warehouse_id, product_id, quantity, last_updated)
      VALUES (?, ?, ?, ?)
    `).run(warehouseId, productId, quantity, now);
  }
  
  // Record movement
  const movementId = uuidv4();
  db.prepare(`
    INSERT INTO stock_movements (id, type, from_warehouse, to_warehouse, product_id, quantity, reference, created_at)
    VALUES (?, 'inbound', NULL, ?, ?, ?, ?, ?)
  `).run(movementId, warehouseId, productId, quantity, reference || null, now);
  
  res.json({ movementId, message: 'Stock received' });
});

// Ship stock (outbound)
router.post('/ship', (req: Request, res: Response) => {
  const { warehouseId, productId, quantity, reference } = req.body;
  
  const stock = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(warehouseId, productId) as any;
  
  // BUG #7: Wrong error - says 'out of stock' when record doesn't exist
  if (!stock) {
    res.status(400).json({ error: 'Product out of stock' });
    return;
  }
  
  // BUG #8: Comparison allows negative stock
  if (stock.quantity <= quantity) {  // Should be <, not <=
    res.status(400).json({ error: 'Insufficient stock' });
    return;
  }
  
  // BUG #9: Race condition - check then update not atomic
  
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE stock SET quantity = quantity - ?, last_updated = ?
    WHERE warehouse_id = ? AND product_id = ?
  `).run(quantity, now, warehouseId, productId);
  
  const movementId = uuidv4();
  db.prepare(`
    INSERT INTO stock_movements (id, type, from_warehouse, to_warehouse, product_id, quantity, reference, created_at)
    VALUES (?, 'outbound', ?, NULL, ?, ?, ?, ?)
  `).run(movementId, warehouseId, productId, quantity, reference || null, now);
  
  res.json({ movementId, message: 'Stock shipped' });
});

// Transfer stock between warehouses
router.post('/transfer', (req: Request, res: Response) => {
  const { fromWarehouseId, toWarehouseId, productId, quantity } = req.body as TransferRequest;
  
  // BUG #10: No check that from !== to warehouse
  
  const sourceStock = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(fromWarehouseId, productId) as any;
  
  if (!sourceStock) {
    res.status(404).json({ error: 'Product not found in source warehouse' });
    return;
  }
  
  if (sourceStock.quantity < quantity) {
    res.status(400).json({ error: 'Insufficient stock' });
    return;
  }
  
  // BUG #11: No validation destination warehouse exists
  // BUG #12: Not using transaction - partial failure possible
  
  const now = new Date().toISOString();
  
  // Deduct from source
  db.prepare(`
    UPDATE stock SET quantity = quantity - ?, last_updated = ?
    WHERE warehouse_id = ? AND product_id = ?
  `).run(quantity, now, fromWarehouseId, productId);
  
  // Add to destination
  const destStock = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(toWarehouseId, productId);
  
  if (destStock) {
    db.prepare(`
      UPDATE stock SET quantity = quantity + ?, last_updated = ?
      WHERE warehouse_id = ? AND product_id = ?
    `).run(quantity, now, toWarehouseId, productId);
  } else {
    // BUG #13: Creates stock record even if destination warehouse doesn't exist
    db.prepare(`
      INSERT INTO stock (warehouse_id, product_id, quantity, last_updated)
      VALUES (?, ?, ?, ?)
    `).run(toWarehouseId, productId, quantity, now);
  }
  
  const movementId = uuidv4();
  db.prepare(`
    INSERT INTO stock_movements (id, type, from_warehouse, to_warehouse, product_id, quantity, reference, created_at)
    VALUES (?, 'transfer', ?, ?, ?, ?, NULL, ?)
  `).run(movementId, fromWarehouseId, toWarehouseId, productId, quantity, now);
  
  res.json({ movementId, message: 'Transfer completed' });
});

// Adjust stock (count correction)
router.post('/adjust', (req: Request, res: Response) => {
  const { warehouseId, productId, quantity, reason } = req.body as StockAdjustmentRequest;
  
  // BUG #14: No validation - reason is required for audit
  // BUG #15: quantity can be any value (should be the NEW quantity or delta with sign)
  
  const stock = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(warehouseId, productId) as any;
  
  if (!stock) {
    res.status(404).json({ error: 'Stock record not found' });
    return;
  }
  
  // BUG #16: Adjustment can make quantity negative
  
  const now = new Date().toISOString();
  const oldQuantity = stock.quantity;
  const difference = quantity - oldQuantity;
  
  db.prepare(`
    UPDATE stock SET quantity = ?, last_updated = ?
    WHERE warehouse_id = ? AND product_id = ?
  `).run(quantity, now, warehouseId, productId);
  
  const movementId = uuidv4();
  db.prepare(`
    INSERT INTO stock_movements (id, type, from_warehouse, to_warehouse, product_id, quantity, reference, created_at)
    VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?)
  `).run(movementId, warehouseId, warehouseId, productId, difference, reason, now);
  
  // BUG #17: Should return the adjustment difference, not just message
  res.json({ movementId, message: 'Stock adjusted' });
});

// Get stock movements history
router.get('/movements', (req: Request, res: Response) => {
  const { productId, warehouseId, type, startDate, endDate } = req.query;
  
  let query = `
    SELECT m.*, p.name as product_name, p.sku,
           fw.name as from_warehouse_name, tw.name as to_warehouse_name
    FROM stock_movements m
    JOIN products p ON m.product_id = p.id
    LEFT JOIN warehouses fw ON m.from_warehouse = fw.id
    LEFT JOIN warehouses tw ON m.to_warehouse = tw.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (productId) {
    query += ' AND m.product_id = ?';
    params.push(productId);
  }
  
  if (warehouseId) {
    query += ' AND (m.from_warehouse = ? OR m.to_warehouse = ?)';
    params.push(warehouseId, warehouseId);
  }
  
  if (type) {
    query += ' AND m.type = ?';
    params.push(type);
  }
  
  // BUG #18: Date filtering doesn't work - wrong column comparison
  if (startDate) {
    query += ' AND m.created_at > ?';  // Should be >= and handle timezone
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND m.created_at < ?';  // Should be <= 
    params.push(endDate);
  }
  
  query += ' ORDER BY m.created_at DESC';
  
  // BUG #19: No pagination on potentially large result set
  
  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

// Get low stock alerts
router.get('/alerts/low-stock', (req: Request, res: Response) => {
  // BUG #20: Same bug as #1 - wrong comparison
  const lowStockItems = db.prepare(`
    SELECT s.*, w.name as warehouse_name, p.name as product_name, p.sku, p.reorder_level
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
    WHERE s.quantity > p.reorder_level
    ORDER BY s.quantity ASC
  `).all();
  
  res.json(lowStockItems);
});

export default router;
