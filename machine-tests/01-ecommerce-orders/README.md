# E-Commerce Order Management API

## Overview
This is an order management API for an e-commerce platform. It handles products and orders with inventory management.

## Setup
```bash
npm install
npm run dev
```

The server runs on `http://localhost:3001`

## API Endpoints

### Products
- `GET /api/products` - List all products (supports `search`, `minPrice`, `maxPrice` query params)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PATCH /api/products/:id/stock` - Update product stock

### Orders
- `GET /api/orders` - List all orders with items
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status
- `POST /api/orders/:id/cancel` - Cancel order

## Sample Requests

### Create Product
```json
POST /api/products
{
  "name": "Webcam",
  "price": 89.99,
  "stock": 75
}
```

### Create Order
```json
POST /api/orders
{
  "customerId": 123,
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

### Update Order Status
```json
PATCH /api/orders/:id/status
{
  "status": "shipped"
}
```

---

## Your Task

This codebase has several bugs and issues. Your job is to:

1. **Review the code** - Look for bugs, security issues, and bad practices
2. **Identify problems** - List each issue you find
3. **Fix the bugs** - Implement proper solutions
4. **Document changes** - Explain what you fixed and why

### Focus Areas
- Security vulnerabilities
- Error handling
- Data validation
- Database operations
- HTTP status codes
- Business logic

### Time Limit
45-60 minutes

### Deliverables
1. Fixed code
2. List of bugs found with explanations
3. Any additional improvements you'd suggest

Good luck!
