import express from 'express';
import taskRoutes from './routes/tasks';
import projectRoutes from './routes/projects';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Task Management API running on port ${PORT}`);
});

export default app;
