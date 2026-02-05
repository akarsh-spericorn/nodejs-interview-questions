# Healthcare Appointment Scheduling API

## Overview
A medical appointment scheduling system that manages doctors, patients, and appointments with availability checking.

## Setup
```bash
npm install
npm run dev
```

Server runs on `http://localhost:3002`

## API Endpoints

### Doctors
- `GET /api/doctors` - List all doctors
- `GET /api/doctors/:id` - Get doctor details
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` - Get available slots

### Appointments
- `GET /api/appointments` - List appointments (filter by `date`, `doctorId`, `patientId`)
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments` - Create appointment
- `PATCH /api/appointments/:id/status` - Update status
- `PATCH /api/appointments/:id/reschedule` - Reschedule appointment
- `DELETE /api/appointments/:id` - Cancel appointment

## Sample Requests

### Get Available Slots
```
GET /api/doctors/1/slots?date=2024-03-15
```

### Create Appointment
```json
POST /api/appointments
{
  "doctorId": 1,
  "patientId": 1,
  "date": "2024-03-15",
  "startTime": "10:00",
  "duration": 30,
  "notes": "Annual checkup"
}
```

### Reschedule
```json
PATCH /api/appointments/:id/reschedule
{
  "date": "2024-03-16",
  "startTime": "14:00",
  "duration": 30
}
```

---

## Your Task

This healthcare scheduling system has multiple bugs. Find and fix them.

### Focus Areas
- Date/time handling
- Conflict detection
- Input validation
- Proper HTTP responses
- Business logic errors
- Data integrity

### Time Limit
45-60 minutes

### Deliverables
1. Fixed code
2. List of bugs with explanations
3. Suggested improvements

Good luck!
