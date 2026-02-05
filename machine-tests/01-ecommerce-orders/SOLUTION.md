# SOLUTION - E-Commerce Orders (Interviewer Only)

## Bug List

### Products Route (`src/routes/products.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | **SQL Injection** - Direct string concatenation in search query | Critical | Line 12-14 |
| 2 | **Wrong Status Code** - Returns 200 with null instead of 404 for missing product | Medium | Line 27-30 |
| 3 | **No Input Validation** - Price can be negative, name can be empty on create | High | Line 35-41 |
| 4 | **No Existence Check** - Stock update doesn't verify product exists | Medium | Line 47-48 |
| 5 | **No Stock Validation** - Stock can become negative | High | Line 47-48 |

### Orders Route (`src/routes/orders.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 6 | **N+1 Query Problem** - Fetching items in a loop | Performance | Line 11-14 |
| 7 | **Missing Return** - Error sent but execution continues | Critical | Line 24-25 |
| 8 | **No Request Validation** - Body not validated | High | Line 33 |
| 9 | **Empty Items Array** - No check for empty items | Medium | Line 33 |
| 10 | **Null Dereference** - No check if product exists before accessing properties | Critical | Line 43 |
| 11 | **Race Condition** - Stock check and update are not atomic | High | Line 46-52 |
| 12 | **No Transaction** - Stock deducted before order creation, not atomic | Critical | Line 55 |
| 13 | **Wrong Status Code** - Should return 201 for created resource | Low | Line 67 |
| 14 | **No Status Validation** - Any string accepted as status | High | Line 79 |
| 15 | **Invalid State Transitions** - Can go from delivered to pending | Medium | Line 79 |
| 16 | **Cancel Logic Error** - Can cancel delivered/cancelled orders | High | Line 99 |

### Main App (`src/index.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 17 | **No Error Handler** - Unhandled errors crash server | High | Missing |
| 18 | **No Request Logging** - No visibility into requests | Low | Missing |

---

## Expected Fixes

### Bug #1: SQL Injection
```typescript
// BEFORE (vulnerable)
query += ` AND name LIKE '%${search}%'`;

// AFTER (parameterized)
const params: any[] = [];
if (search) {
  query += ' AND name LIKE ?';
  params.push(`%${search}%`);
}
const products = db.prepare(query).all(...params);
```

### Bug #7: Missing Return
```typescript
// BEFORE
if (!order) {
  res.status(404).json({ error: 'Order not found' });
}
// Code continues...

// AFTER
if (!order) {
  res.status(404).json({ error: 'Order not found' });
  return; // Add return!
}
```

### Bug #11 & #12: Race Condition & Transaction
```typescript
// AFTER - Use transaction
const createOrder = db.transaction(() => {
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    if (product.stock < item.quantity) throw new Error(`Insufficient stock`);
    
    // Atomic update with check
    const result = db.prepare(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?'
    ).run(item.quantity, item.productId, item.quantity);
    
    if (result.changes === 0) throw new Error('Stock changed');
  }
  // Insert order and items...
});

try {
  createOrder();
} catch (e) {
  res.status(400).json({ error: e.message });
}
```

### Bug #14: Status Validation
```typescript
const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
if (!validStatuses.includes(status)) {
  res.status(400).json({ error: 'Invalid status' });
  return;
}
```

### Bug #15: State Transition Validation
```typescript
const validTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

if (!validTransitions[order.status]?.includes(status)) {
  res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
  return;
}
```

---

## Scoring Rubric

| Score | Bugs Found | Fix Quality |
|-------|------------|-------------|
| 1-3 | 1-4 bugs | Poor fixes or incomplete |
| 4-5 | 5-8 bugs | Basic fixes |
| 6-7 | 9-12 bugs | Good fixes with validation |
| 8-9 | 13-15 bugs | Excellent fixes, added tests |
| 10 | All 18 bugs | Production-ready, suggested improvements |

## Red Flags (Automatic Concerns)
- Doesn't find SQL injection
- Doesn't understand transaction importance
- Fixes break other functionality
- No understanding of race conditions
