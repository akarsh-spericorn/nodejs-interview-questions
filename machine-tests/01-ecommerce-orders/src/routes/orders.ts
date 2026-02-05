import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { CreateOrderRequest, Order, OrderItem, Product, UpdateOrderStatusRequest } from '../types';

const router = Router();

// Get all orders
router.get('/', (req: Request, res: Response) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  
  // BUG #6: N+1 query problem - fetching items in loop
  const ordersWithItems = orders.map((order: any) => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return { ...order, items };
  });
  
  res.json(ordersWithItems);
});

// Get single order
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  
  if (!order) {
    // BUG #7: Sending error but not returning - code continues
    res.status(404).json({ error: 'Order not found' });
  }
  
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  
  res.json({ ...order, items });
});

// Create order
router.post('/', (req: Request, res: Response) => {
  const { customerId, items } = req.body as CreateOrderRequest;
  
  // BUG #8: No validation on request body
  // BUG #9: No check if items array is empty
  
  const orderId = uuidv4();
  let total = 0;
  const orderItems: OrderItem[] = [];
  
  // Process each item
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId) as Product;
    
    // BUG #10: Missing null check - will crash if product doesn't exist
    
    // BUG #11: Race condition - checking stock then updating separately
    if (product.stock < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for product ${product.name}` });
      return;
    }
    
    // Deduct stock
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.productId);
    
    orderItems.push({
      productId: item.productId,
      quantity: item.quantity,
      price: product.price
    });
    
    total += product.price * item.quantity;
  }
  
  // BUG #12: No transaction - if order insert fails, stock is already deducted
  
  // Insert order
  db.prepare(
    'INSERT INTO orders (id, customer_id, status, total, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(orderId, customerId, 'pending', total, new Date().toISOString());
  
  // Insert order items
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
  );
  
  for (const item of orderItems) {
    insertItem.run(orderId, item.productId, item.quantity, item.price);
  }
  
  // BUG #13: Wrong status code - should be 201 for created
  res.json({
    id: orderId,
    customerId,
    items: orderItems,
    total,
    status: 'pending'
  });
});

// Update order status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as UpdateOrderStatusRequest;
  
  // BUG #14: No validation of status value - can set to any string
  // BUG #15: No check for valid status transitions (e.g., delivered -> pending)
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: 'Status updated', status });
});

// Cancel order
router.post('/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  // BUG #16: Can cancel already delivered/cancelled orders
  
  // Restore stock
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
  
  for (const item of items) {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
  }
  
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);
  
  res.json({ message: 'Order cancelled' });
});

export default router;
