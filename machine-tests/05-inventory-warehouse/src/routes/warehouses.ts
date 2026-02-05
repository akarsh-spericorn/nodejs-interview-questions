import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all warehouses
router.get('/', (req: Request, res: Response) => {
  const warehouses = db.prepare('SELECT * FROM warehouses').all();
  res.json(warehouses);
});

// Get warehouse by ID with stock summary
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  
  if (!warehouse) {
    res.status(404).json({ error: 'Warehouse not found' });
    return;
  }
  
  // Get stock summary
  // BUG #21: N+1 query issue - should join
  const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ?').all(id);
  
  res.json({ ...warehouse, stock });
});

// Get warehouse utilization
router.get('/:id/utilization', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id) as any;
  
  if (!warehouse) {
    res.status(404).json({ error: 'Warehouse not found' });
    return;
  }
  
  // BUG #22: Utilization calculation doesn't account for product sizes/volumes
  const totalStock = db.prepare(`
    SELECT SUM(quantity) as total FROM stock WHERE warehouse_id = ?
  `).get(id) as any;
  
  const utilization = (totalStock.total || 0) / warehouse.capacity * 100;
  
  res.json({
    warehouseId: id,
    capacity: warehouse.capacity,
    currentStock: totalStock.total || 0,
    utilizationPercent: utilization,
    available: warehouse.capacity - (totalStock.total || 0)
  });
});

// Create warehouse
router.post('/', (req: Request, res: Response) => {
  const { name, location, capacity } = req.body;
  
  // BUG #23: No validation of required fields
  // BUG #24: No validation that capacity is positive
  
  const result = db.prepare(`
    INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)
  `).run(name, location, capacity);
  
  res.json({ id: result.lastInsertRowid, message: 'Warehouse created' });
});

// Delete warehouse
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #25: No check if warehouse has stock - would orphan records
  // BUG #26: No check if warehouse exists
  
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(id);
  
  res.json({ message: 'Warehouse deleted' });
});

export default router;
