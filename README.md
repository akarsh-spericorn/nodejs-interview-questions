# Interview Questions Repository

A comprehensive collection of interview questions for Node.js developers at various experience levels, along with database-specific questions for MongoDB and Sequelize.

## Structure

### Node.js Interview Questions

| File | Level | Questions | Description |
|------|-------|-----------|-------------|
| [nodejs-junior.md](./nodejs/nodejs-junior.md) | Junior | 50 | Fundamental concepts for 0-2 years experience |
| [nodejs-mid-level.md](./nodejs/nodejs-mid-level.md) | Mid-Level | 50 | Intermediate concepts for 2-4 years experience |
| [nodejs-senior.md](./nodejs/nodejs-senior.md) | Senior | 50 | Advanced concepts for 4-7 years experience |
| [nodejs-tech-lead.md](./nodejs/nodejs-tech-lead.md) | Tech Lead | 50 | Architecture & leadership for 7+ years experience |
| [nodejs-problem-solving.md](./nodejs/nodejs-problem-solving.md) | All Levels | 50 | Real-world problem-solving across domains |

### Database Interview Questions (Node.js Focus)

| File | Technology | Questions | Description |
|------|------------|-----------|-------------|
| [mongodb-nodejs.md](./databases/mongodb-nodejs.md) | MongoDB | 50 | MongoDB with Node.js (Mongoose) |
| [sequelize-nodejs.md](./databases/sequelize-nodejs.md) | Sequelize | 50 | Sequelize ORM for SQL databases |

### Machine Test Projects

Hands-on coding challenges with intentionally buggy Express.js + TypeScript applications.

| # | Project | Domain | Difficulty | Focus Areas |
|---|---------|--------|------------|-------------|
| 1 | [E-Commerce Orders](./machine-tests/01-ecommerce-orders/) | E-Commerce | Medium | SQL injection, transactions, race conditions |
| 2 | [Healthcare Appointments](./machine-tests/02-healthcare-appointments/) | Healthcare | Medium | Scheduling conflicts, date/time handling |
| 3 | [Banking Transactions](./machine-tests/03-banking-transactions/) | FinTech | Hard | Security, data integrity, atomicity |
| 4 | [Task Management](./machine-tests/04-task-management/) | Productivity | Easy-Medium | CRUD, pagination, route ordering |
| 5 | [Inventory Warehouse](./machine-tests/05-inventory-warehouse/) | Logistics | Medium-Hard | Stock accuracy, concurrent updates |

> **For Interviewers**: Each project contains a `SOLUTION.md` with all bugs listed. Remove before giving to candidates.

## How to Use

1. **For Interviewers**: Use questions matching the candidate's target level
2. **For Candidates**: Start with your current level and work up
3. **Complexity**: Questions within each file increase in complexity

## Topics Covered

### Node.js
- Core concepts (Event Loop, Streams, Buffers)
- Modules and Package Management
- Async Programming (Callbacks, Promises, Async/Await)
- Error Handling
- Security Best Practices
- Performance Optimization
- Testing and Debugging
- Microservices Architecture
- System Design

### Problem-Solving Domains
- E-Commerce (Cart, Pricing, Orders, Search)
- FinTech & Banking (Fraud Detection, Reconciliation, Payments)
- Healthcare (Scheduling, Prescriptions, Telehealth)
- Social Media (Feeds, Notifications, Moderation)
- Logistics & Delivery (Route Optimization, Tracking)
- IoT & Real-Time (Sensor Pipelines, Device Management)
- SaaS & Multi-Tenant (Billing, Feature Flags, Isolation)
- Media & Streaming (Video Processing, Live Streaming)

### MongoDB
- CRUD Operations
- Aggregation Pipeline
- Indexing Strategies
- Schema Design
- Mongoose ODM
- Performance Tuning
- Replication & Sharding

### Sequelize
- Model Definition
- Associations
- Migrations
- Transactions
- Query Optimization
- Hooks and Validations

## Contributing

Feel free to submit PRs to add more questions or improve existing answers.

## License

MIT
