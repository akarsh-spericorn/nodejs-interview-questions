import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all projects
router.get('/', (req: Request, res: Response) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// Get project by ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  
  res.json(project);
});

// Get project with tasks
router.get('/:id/tasks', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #18: No check if project exists first
  
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(id);
  
  res.json(tasks);
});

// Get project statistics
router.get('/:id/stats', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #19: Inefficient - should use single query with GROUP BY
  const todo = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'todo'").get(id) as any;
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'in_progress'").get(id) as any;
  const review = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'review'").get(id) as any;
  const done = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'done'").get(id) as any;
  
  res.json({
    todo: todo.count,
    inProgress: inProgress.count,
    review: review.count,
    done: done.count,
    total: todo.count + inProgress.count + review.count + done.count
  });
});

// Create project
router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body;
  
  // BUG #20: No validation - name can be empty
  
  const result = db.prepare(`
    INSERT INTO projects (name, description, created_at) VALUES (?, ?, ?)
  `).run(name, description || null, new Date().toISOString());
  
  res.json({ id: result.lastInsertRowid, message: 'Project created' });
});

// Delete project
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // BUG #21: Doesn't delete associated tasks - orphaned records
  // BUG #22: No check if project exists
  
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  
  res.json({ message: 'Project deleted' });
});

export default router;
