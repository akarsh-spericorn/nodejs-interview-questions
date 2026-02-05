import express from 'express';
import doctorRoutes from './routes/doctors';
import appointmentRoutes from './routes/appointments';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// BUG #17: No error handling middleware

app.listen(PORT, () => {
  console.log(`Healthcare API running on port ${PORT}`);
});

export default app;
