export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface CreateTaskRequest {
  projectId: number;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  assignedTo?: number;
}
