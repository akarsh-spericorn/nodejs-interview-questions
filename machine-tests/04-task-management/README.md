# Task Management API

## Overview
A simple task management system with projects and tasks. Users can create projects, add tasks, and track progress.

## Setup
```bash
npm install
npm run dev
```

Server runs on `http://localhost:3004`

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/:id/tasks` - Get project tasks
- `GET /api/projects/:id/stats` - Get project statistics
- `POST /api/projects` - Create project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List tasks (filter by `projectId`, `status`, `priority`, `assignedTo`)
- `GET /api/tasks/:id` - Get task details
- `GET /api/tasks/overdue` - Get overdue tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update status
- `PATCH /api/tasks/:id/assign` - Assign to user
- `DELETE /api/tasks/:id` - Delete task

## Sample Requests

### Create Project
```json
POST /api/projects
{
  "name": "New Project",
  "description": "Project description"
}
```

### Create Task
```json
POST /api/tasks
{
  "projectId": 1,
  "title": "New Task",
  "description": "Task details",
  "priority": "high",
  "dueDate": "2024-03-20",
  "assignedTo": 1
}
```

### Update Task Status
```json
PATCH /api/tasks/1/status
{
  "status": "in_progress"
}
```

---

## Your Task

This task management system has bugs. Find and fix them.

### Focus Areas
- Pagination logic
- CRUD operations
- Input validation
- HTTP status codes
- Route ordering
- Data integrity

### Time Limit
45 minutes

Good luck!
