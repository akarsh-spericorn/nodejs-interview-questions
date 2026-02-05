# SOLUTION - Inventory Warehouse (Interviewer Only)

## Bug List (26 Total)

### Inventory Route (`src/routes/inventory.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | **Low Stock Filter Inverted** - Uses > instead of < | Critical | Line 30 |
| 2 | **No 404 Response** - Returns undefined | Medium | Line 49 |
| 3 | **No Required Validation** - Missing field checks | High | Line 54-55 |
| 4 | **No Positive Quantity Check** - Negative receive possible | High | Line 55 |
| 5 | **No Product Exists Check** - Can receive non-existent product | Medium | Line 62 |
| 6 | **No Capacity Check** - Warehouse can exceed capacity | Medium | Line 64 |
| 7 | **Wrong Error Message** - "Out of stock" vs "Not found" | Low | Line 101 |
| 8 | **Comparison Off By One** - Uses <= instead of < | High | Line 106 |
| 9 | **Race Condition (Ship)** - Check-then-update not atomic | Critical | Line 109 |
| 10 | **Same Warehouse Transfer** - Can transfer to self | Low | Line 125 |
| 11 | **No Dest Warehouse Check** - Destination may not exist | High | Line 139 |
| 12 | **No Transaction** - Partial transfer possible | Critical | Line 140 |
| 13 | **Creates Invalid Stock** - Stock for non-existent warehouse | High | Line 158 |
| 14 | **No Reason Validation** - Adjustment reason required | Medium | Line 174 |
| 15 | **Quantity Meaning Unclear** - Is it new value or delta? | Medium | Line 175 |
| 16 | **Negative Stock Possible** - No floor check on adjustment | High | Line 184 |
| 17 | **Missing Response Data** - Should return old/new values | Low | Line 196 |
| 18 | **Date Filter Wrong** - Uses > instead of >=, timezone issues | Medium | Line 218-222 |
| 19 | **No Pagination** - Large result sets returned | Performance | Line 229 |
| 20 | **Low Stock Alert Inverted** - Same as bug #1 | Critical | Line 238 |

### Warehouses Route (`src/routes/warehouses.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 21 | **N+1 Query** - Should use JOIN | Performance | Line 23 |
| 22 | **Utilization Oversimplified** - Doesn't account for product volume | Design | Line 42 |
| 23 | **No Required Validation** - Name, location, capacity not checked | High | Line 53 |
| 24 | **No Positive Capacity Check** - Can be 0 or negative | High | Line 54 |
| 25 | **Delete With Stock** - Orphans stock records | Critical | Line 62 |
| 26 | **Delete No Check** - Returns success for non-existent | Medium | Line 63 |

---

## Critical Fixes

### Bug #1 & #20: Low Stock Filter
```typescript
// BEFORE - Returns items ABOVE reorder level (wrong!)
WHERE s.quantity > p.reorder_level

// AFTER - Returns items BELOW reorder level
WHERE s.quantity < p.reorder_level
```

### Bug #8: Comparison Fix
```typescript
// BEFORE - Fails when stock exactly equals quantity
if (stock.quantity <= quantity) {
  // This rejects valid shipments!
}

// AFTER - Only fail if truly insufficient
if (stock.quantity < quantity) {
  res.status(400).json({ error: 'Insufficient stock' });
  return;
}
```

### Bug #9 & #12: Atomic Operations with Transactions
```typescript
// AFTER - Use transaction for transfer
const transferStock = db.transaction((from, to, productId, qty) => {
  // Check source stock
  const source = db.prepare(
    'SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?'
  ).get(from, productId);
  
  if (!source || source.quantity < qty) {
    throw new Error('Insufficient stock');
  }
  
  // Atomic update with guard
  const result = db.prepare(`
    UPDATE stock SET quantity = quantity - ? 
    WHERE warehouse_id = ? AND product_id = ? AND quantity >= ?
  `).run(qty, from, productId, qty);
  
  if (result.changes === 0) {
    throw new Error('Stock changed during operation');
  }
  
  // Update or insert destination
  db.prepare(`
    INSERT INTO stock (warehouse_id, product_id, quantity, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(warehouse_id, product_id) 
    DO UPDATE SET quantity = quantity + ?, last_updated = ?
  `).run(to, productId, qty, now, qty, now);
  
  // Record movement
  db.prepare('INSERT INTO stock_movements...').run(...);
});

try {
  transferStock(fromWarehouseId, toWarehouseId, productId, quantity);
  res.json({ message: 'Transfer completed' });
} catch (e) {
  res.status(400).json({ error: e.message });
}
```

### Bug #25: Prevent Delete With Stock
```typescript
// Check for existing stock
const hasStock = db.prepare(
  'SELECT COUNT(*) as count FROM stock WHERE warehouse_id = ? AND quantity > 0'
).get(id);

if (hasStock.count > 0) {
  res.status(400).json({ 
    error: 'Cannot delete warehouse with existing stock. Transfer or adjust first.' 
  });
  return;
}
```

### Bug #18: Date Filtering
```typescript
// BEFORE - Wrong operators
if (startDate) {
  query += ' AND m.created_at > ?';
  params.push(startDate);
}

// AFTER - Inclusive and handle dates properly
if (startDate) {
  query += ' AND DATE(m.created_at) >= DATE(?)';
  params.push(startDate);
}

if (endDate) {
  query += ' AND DATE(m.created_at) <= DATE(?)';
  params.push(endDate);
}
```

---

## Scoring Rubric

| Score | Bugs Found |
|-------|------------|
| 1-3 | 1-6 bugs |
| 4-5 | 7-12 bugs |
| 6-7 | 13-18 bugs |
| 8-9 | 19-23 bugs |
| 10 | 24-26 bugs |

## Key Insights to Look For
- Spots the inverted comparison (#1, #8, #20)
- Understands transaction necessity (#9, #12)
- Recognizes data integrity issues (#13, #25)
- Considers production concerns (pagination, validation)

## Red Flags
- Doesn't notice inverted low stock logic
- Doesn't understand race conditions
- Doesn't consider referential integrity
