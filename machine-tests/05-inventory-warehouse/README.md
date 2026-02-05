# Warehouse Inventory Management API

## Overview
A warehouse inventory management system that tracks products across multiple warehouse locations. Handles receiving, shipping, transfers, and stock adjustments.

## Setup
```bash
npm install
npm run dev
```

Server runs on `http://localhost:3005`

## API Endpoints

### Warehouses
- `GET /api/warehouses` - List all warehouses
- `GET /api/warehouses/:id` - Get warehouse with stock
- `GET /api/warehouses/:id/utilization` - Get capacity utilization
- `POST /api/warehouses` - Create warehouse
- `DELETE /api/warehouses/:id` - Delete warehouse

### Inventory
- `GET /api/inventory/stock` - Get stock levels (filter by `warehouseId`, `productId`, `lowStock`)
- `GET /api/inventory/stock/:warehouseId/:productId` - Get specific stock
- `POST /api/inventory/receive` - Receive stock (inbound)
- `POST /api/inventory/ship` - Ship stock (outbound)
- `POST /api/inventory/transfer` - Transfer between warehouses
- `POST /api/inventory/adjust` - Adjust stock count
- `GET /api/inventory/movements` - Get movement history
- `GET /api/inventory/alerts/low-stock` - Get low stock alerts

## Sample Requests

### Receive Stock
```json
POST /api/inventory/receive
{
  "warehouseId": 1,
  "productId": 1,
  "quantity": 50,
  "reference": "PO-12345"
}
```

### Ship Stock
```json
POST /api/inventory/ship
{
  "warehouseId": 1,
  "productId": 1,
  "quantity": 10,
  "reference": "ORDER-789"
}
```

### Transfer Stock
```json
POST /api/inventory/transfer
{
  "fromWarehouseId": 1,
  "toWarehouseId": 2,
  "productId": 1,
  "quantity": 25
}
```

### Adjust Stock
```json
POST /api/inventory/adjust
{
  "warehouseId": 1,
  "productId": 1,
  "quantity": 95,
  "reason": "Physical count correction"
}
```

---

## Your Task

This inventory system has multiple bugs affecting stock accuracy and business logic. Find and fix them.

### Focus Areas
- Stock calculation accuracy
- Concurrent update handling
- Data validation
- Query logic
- Data integrity

### Time Limit
50 minutes

### Deliverables
1. Fixed code
2. List of bugs with explanations
3. Suggested improvements for production use

Good luck!
