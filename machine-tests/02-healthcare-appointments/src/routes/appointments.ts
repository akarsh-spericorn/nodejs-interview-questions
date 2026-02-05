import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { CreateAppointmentRequest } from '../types';

const router = Router();

// Get all appointments
router.get('/', (req: Request, res: Response) => {
  const { date, doctorId, patientId } = req.query;
  
  let query = 'SELECT * FROM appointments WHERE 1=1';
  const params: any[] = [];
  
  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }
  
  if (doctorId) {
    query += ' AND doctor_id = ?';
    params.push(doctorId);
  }
  
  if (patientId) {
    query += ' AND patient_id = ?';
    params.push(patientId);
  }
  
  const appointments = db.prepare(query).all(...params);
  res.json(appointments);
});

// Get single appointment
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  
  // BUG #5: Returns 200 with undefined instead of 404
  res.json(appointment);
});

// Create appointment
router.post('/', (req: Request, res: Response) => {
  const { doctorId, patientId, date, startTime, duration, notes } = req.body as CreateAppointmentRequest;
  
  // BUG #6: No validation of required fields
  // BUG #7: No validation of date format (should be YYYY-MM-DD)
  // BUG #8: No validation of time format (should be HH:MM)
  
  // Check if doctor exists
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  
  // Check if patient exists
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }
  
  // Calculate end time
  // BUG #9: End time calculation is wrong for edge cases (e.g., 23:30 + 60min)
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  
  // BUG #10: No check for past dates - can book appointments in the past
  
  // Check for conflicts
  const conflict = db.prepare(`
    SELECT * FROM appointments 
    WHERE doctor_id = ? 
    AND date = ? 
    AND status != 'cancelled'
    AND (
      (start_time <= ? AND end_time > ?) OR
      (start_time < ? AND end_time >= ?) OR
      (start_time >= ? AND end_time <= ?)
    )
  `).get(doctorId, date, startTime, startTime, endTime, endTime, startTime, endTime);
  
  // BUG #11: Conflict check missing - patient double booking not checked
  
  if (conflict) {
    res.status(409).json({ error: 'Time slot not available' });
    return;
  }
  
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO appointments (id, doctor_id, patient_id, date, start_time, end_time, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)
  `).run(id, doctorId, patientId, date, startTime, endTime, notes || null);
  
  // BUG #12: Should return 201, not 200
  res.json({
    id,
    doctorId,
    patientId,
    date,
    startTime,
    endTime,
    status: 'scheduled',
    notes
  });
});

// Update appointment status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // BUG #13: No validation of status value
  
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: 'Status updated' });
});

// Reschedule appointment
router.patch('/:id/reschedule', (req: Request, res: Response) => {
  const { id } = req.params;
  const { date, startTime, duration } = req.body;
  
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  
  // BUG #14: Can reschedule cancelled/completed appointments
  // BUG #15: No conflict check when rescheduling
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  
  db.prepare(`
    UPDATE appointments SET date = ?, start_time = ?, end_time = ? WHERE id = ?
  `).run(date, startTime, endTime, id);
  
  res.json({ message: 'Appointment rescheduled' });
});

// Cancel appointment
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  
  // BUG #16: Deletes instead of soft-cancelling - loses history
  db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  
  res.json({ message: 'Appointment deleted' });
});

export default router;
