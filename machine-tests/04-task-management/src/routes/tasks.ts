import { Router, Request, Response } from 'express';
import db from '../database';
import { CreateTaskRequest } from '../types';

const router = Router();

// Get all tasks with filtering
router.get('/', (req: Request, res: Response) => {
  const { projectId, status, priority, assignedTo, page, limit } = req.query;
  
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];
  
  if (projectId) {
    query += ' AND project_id = ?';
    params.push(projectId);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  
  if (assignedTo) {
    query += ' AND assigned_to = ?';
    params.push(assignedTo);
  }
  
  // BUG #1: Pagination calculation is wrong
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const offset = pageNum * limitNum;  // Should be (pageNum - 1) * limitNum
  
  query += ` LIMIT ${limitNum} OFFSET ${offset}`;
  
  // BUG #2: No total count returned for pagination
  const tasks = db.prepare(query).all(...params);
  
  res.json(tasks);
});

// Get single task
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  
  // BUG #3: Returns 200 with undefined instead of 404
  res.json(task);
});

// Create task
router.post('/', (req: Request, res: Response) => {
  const { projectId, title, description, priority, dueDate, assignedTo } = req.body as CreateTaskRequest;
  
  // BUG #4: No validation of required fields (projectId, title)
  // BUG #5: No check if project exists
  // BUG #6: No check if assigned user exists
  
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?)
  `).run(projectId, title, description || null, priority || 'medium', dueDate || null, assignedTo || null, now, now);
  
  // BUG #7: Should return 201, not 200
  res.json({ id: result.lastInsertRowid, message: 'Task created' });
});

// Update task
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, status, priority, dueDate, assignedTo } = req.body;
  
  // BUG #8: PUT should replace entire resource, this is partial update (should be PATCH)
  // BUG #9: No check if task exists before updating
  // BUG #10: updated_at not being updated
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (priority) { updates.push('priority = ?'); params.push(priority); }
  if (dueDate !== undefined) { updates.push('due_date = ?'); params.push(dueDate); }
  if (assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(assignedTo); }
  
  // BUG #11: If no fields provided, query becomes invalid
  if (updates.length === 0) {
    res.json({ message: 'Nothing to update' });
    return;
  }
  
  params.push(id);
  
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  res.json({ message: 'Task updated' });
});

// Update task status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // BUG #12: No validation of status value
  // BUG #13: No check if task exists
  
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: 'Status updated' });
});

// Assign task to user
router.patch('/:id/assign', (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  // BUG #14: No check if user exists
  
  db.prepare('UPDATE tasks SET assigned_to = ? WHERE id = ?').run(userId, id);
  
  res.json({ message: 'Task assigned' });
});

// Delete task
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #15: No check if task exists - returns success even if not found
  
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  
  // BUG #16: Should return 204 No Content, not 200 with body
  res.json({ message: 'Task deleted' });
});

// Get overdue tasks
router.get('/overdue', (req: Request, res: Response) => {
  // BUG #17: This route is never reached because /:id matches first
  const today = new Date().toISOString().split('T')[0];
  
  const tasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE due_date < ? AND status != 'done'
    ORDER BY due_date ASC
  `).all(today);
  
  res.json(tasks);
});

export default router;
