# Node.js Express Machine Test Questions

> **Purpose**: Technical interview machine tests for Node.js developers
> **Format**: Each folder contains a buggy Express.js + TypeScript application
> **Time**: 45-60 minutes per challenge

---

## Overview

These are **intentionally buggy** applications for candidate evaluation. Each project has multiple issues including:
- Security vulnerabilities
- Performance problems
- Logic errors
- Missing error handling
- TypeScript/type safety issues
- API design problems

---

## Projects

| # | Domain | Folder | Difficulty | Key Focus Areas |
|---|--------|--------|------------|-----------------|
| 1 | E-Commerce | `01-ecommerce-orders` | Medium | Order processing, inventory, race conditions |
| 2 | Healthcare | `02-healthcare-appointments` | Medium | Scheduling conflicts, validation, async |
| 3 | Banking | `03-banking-transactions` | Hard | Security, transactions, balance integrity |
| 4 | Task Management | `04-task-management` | Easy-Medium | CRUD operations, filtering, pagination |
| 5 | Inventory | `05-inventory-warehouse` | Medium-Hard | Stock management, concurrent updates |

---

## How to Use (For Interviewers)

### Setup
```bash
cd machine-tests/<project-folder>
npm install
npm run dev
```

### Evaluation Criteria

1. **Bug Identification** (30%)
   - Can the candidate identify issues?
   - Do they understand the root cause?

2. **Bug Fixes** (40%)
   - Are fixes correct and complete?
   - Do fixes follow best practices?

3. **Code Quality** (20%)
   - TypeScript usage
   - Error handling
   - Code organization

4. **Communication** (10%)
   - Can they explain the issues?
   - Do they document their changes?

### Scoring Guide

| Score | Description |
|-------|-------------|
| 1-3 | Found <30% of bugs, fixes are incomplete |
| 4-5 | Found 30-50% of bugs, some fixes work |
| 6-7 | Found 50-70% of bugs, most fixes are correct |
| 8-9 | Found >70% of bugs, fixes are high quality |
| 10 | Found all bugs, excellent fixes, suggested improvements |

---

## Instructions for Candidates

Each project folder contains:
- `README.md` - Project description and your tasks
- `src/` - Source code with intentional bugs
- `package.json` - Dependencies

### Your Task
1. Review the codebase
2. Identify bugs and issues
3. Fix the problems
4. Document what you found and fixed

### Rules
- You may use internet for syntax/documentation
- You may NOT copy entire solutions
- Focus on quality over quantity
- Explain your reasoning

---

## Project Details

### 01-ecommerce-orders
An order management API for an e-commerce platform. Handles order creation, status updates, and inventory checks.

**Expected bugs to find**: 5-7

---

### 02-healthcare-appointments
A medical appointment scheduling system. Manages doctor availability and patient bookings.

**Expected bugs to find**: 5-7

---

### 03-banking-transactions
A banking API for account management and money transfers. Critical focus on security and data integrity.

**Expected bugs to find**: 6-8

---

### 04-task-management
A todo/task management API with projects and task assignments.

**Expected bugs to find**: 4-6

---

### 05-inventory-warehouse
A warehouse inventory management system tracking stock levels across locations.

**Expected bugs to find**: 5-7

---

## Files Structure

Each project follows this structure:
```
project-folder/
├── README.md           # Candidate instructions
├── SOLUTION.md         # (Interviewer only) List of bugs
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # App entry point
│   ├── database.ts     # Database setup
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── types/          # TypeScript types
```

---

## Notes for Interviewers

- **SOLUTION.md** in each folder lists all intentional bugs
- Remove SOLUTION.md before giving to candidates
- Adjust time based on candidate experience level
- Consider having candidates explain their findings verbally
