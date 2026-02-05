import { Router, Request, Response } from 'express';
import db from '../database';

const router = Router();

// Get all doctors
router.get('/', (req: Request, res: Response) => {
  const doctors = db.prepare('SELECT * FROM doctors').all();
  
  // BUG #1: Not parsing JSON available_days - returns string instead of array
  res.json(doctors);
});

// Get doctor by ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
  
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  
  res.json(doctor);
});

// Get doctor's available slots for a date
router.get('/:id/slots', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date } = req.query;
  
  // BUG #2: No validation of date parameter
  
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as any;
  
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  
  // BUG #3: Day checking logic is wrong - doesn't match date format
  const dayOfWeek = new Date(date as string).getDay();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[dayOfWeek];
  
  const availableDays = JSON.parse(doctor.available_days);
  
  if (!availableDays.includes(dayName)) {
    res.json({ slots: [], message: 'Doctor not available on this day' });
    return;
  }
  
  // Get existing appointments for this date
  const appointments = db.prepare(
    'SELECT start_time, end_time FROM appointments WHERE doctor_id = ? AND date = ? AND status != ?'
  ).all(id, date, 'cancelled') as any[];
  
  // Generate time slots (9 AM to 5 PM, 30-min slots)
  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endHour = min === 30 ? hour + 1 : hour;
      const endMin = min === 30 ? 0 : 30;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
      
      // BUG #4: Overlap check is incorrect - doesn't handle partial overlaps
      const isBooked = appointments.some(apt => apt.start_time === startTime);
      
      slots.push({
        startTime,
        endTime,
        available: !isBooked
      });
    }
  }
  
  res.json({ slots });
});

export default router;
