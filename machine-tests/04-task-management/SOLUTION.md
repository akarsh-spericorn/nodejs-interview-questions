# SOLUTION - Task Management (Interviewer Only)

## Bug List (22 Total)

### Tasks Route (`src/routes/tasks.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | **Pagination Offset Wrong** - Uses `page * limit` instead of `(page-1) * limit` | High | Line 35 |
| 2 | **No Total Count** - Pagination missing total for UI | Medium | Line 39 |
| 3 | **No 404 Response** - Returns undefined instead of 404 | Medium | Line 48 |
| 4 | **No Required Validation** - projectId, title not validated | High | Line 54 |
| 5 | **No Project Check** - Doesn't verify project exists | Medium | Line 55 |
| 6 | **No User Check** - Doesn't verify assigned user exists | Medium | Line 56 |
| 7 | **Wrong Status Code** - Should return 201 for created | Low | Line 63 |
| 8 | **PUT vs PATCH** - PUT does partial update (should be PATCH) | Medium | Line 68 |
| 9 | **No Existence Check** - Update without checking if exists | Medium | Line 69 |
| 10 | **updated_at Not Set** - Timestamp not updated on edit | Medium | Line 70 |
| 11 | **Empty Update** - Returns success even with no changes | Low | Line 82 |
| 12 | **No Status Validation** - Any string accepted | High | Line 93 |
| 13 | **No Task Check** - Status update without existence check | Medium | Line 94 |
| 14 | **No User Validation** - Assign to non-existent user | Medium | Line 103 |
| 15 | **Delete Without Check** - Returns success for non-existent | Medium | Line 112 |
| 16 | **Wrong Delete Status** - Should be 204 No Content | Low | Line 116 |
| 17 | **Route Order** - `/overdue` unreachable (after `/:id`) | Critical | Line 120 |

### Projects Route (`src/routes/projects.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 18 | **No Project Check** - Returns empty array for non-existent project | Low | Line 31 |
| 19 | **Inefficient Stats** - 4 queries instead of 1 with GROUP BY | Performance | Line 38-42 |
| 20 | **No Name Validation** - Empty project names allowed | Medium | Line 55 |
| 21 | **Orphaned Tasks** - Tasks not deleted with project | High | Line 64 |
| 22 | **Delete Without Check** - Returns success for non-existent | Medium | Line 65 |

---

## Key Fixes

### Bug #1: Pagination
```typescript
// BEFORE - Wrong calculation
const offset = pageNum * limitNum;

// AFTER - Correct offset
const offset = (pageNum - 1) * limitNum;
```

### Bug #2: Total Count
```typescript
// Add count query
const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
const countResult = db.prepare(countQuery).get(...params);

res.json({
  tasks,
  pagination: {
    page: pageNum,
    limit: limitNum,
    total: countResult.total,
    totalPages: Math.ceil(countResult.total / limitNum)
  }
});
```

### Bug #17: Route Order
```typescript
// BEFORE - /:id matches 'overdue'
router.get('/:id', ...);
router.get('/overdue', ...);  // Never reached!

// AFTER - Specific routes first
router.get('/overdue', ...);  // Specific route first
router.get('/:id', ...);
```

### Bug #19: Efficient Stats Query
```typescript
// BEFORE - 4 separate queries
const todo = db.prepare("...status = 'todo'").get(id);
const inProgress = db.prepare("...status = 'in_progress'").get(id);
// ... etc

// AFTER - Single query with GROUP BY
const stats = db.prepare(`
  SELECT status, COUNT(*) as count 
  FROM tasks 
  WHERE project_id = ?
  GROUP BY status
`).all(id);

const result = { todo: 0, in_progress: 0, review: 0, done: 0, total: 0 };
stats.forEach(s => {
  result[s.status] = s.count;
  result.total += s.count;
});
```

### Bug #21: Cascade Delete
```typescript
// AFTER - Delete tasks first
db.prepare('DELETE FROM tasks WHERE project_id = ?').run(id);
db.prepare('DELETE FROM projects WHERE id = ?').run(id);

// Or better: Use transaction
const deleteProject = db.transaction((projectId) => {
  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
});
```

---

## Scoring Rubric

| Score | Bugs Found |
|-------|------------|
| 1-3 | 1-5 bugs |
| 4-5 | 6-10 bugs |
| 6-7 | 11-15 bugs |
| 8-9 | 16-19 bugs |
| 10 | 20-22 bugs |

## Key Insights to Look For
- Understands route ordering matters
- Knows pagination offset formula
- Recognizes N+1/inefficient queries
- Understands cascade delete necessity
