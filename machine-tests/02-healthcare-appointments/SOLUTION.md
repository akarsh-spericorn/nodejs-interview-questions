# SOLUTION - Healthcare Appointments (Interviewer Only)

## Bug List

### Doctors Route (`src/routes/doctors.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 1 | **JSON Not Parsed** - `available_days` returned as string, not array | Medium | Line 9 |
| 2 | **No Date Validation** - Date parameter not validated | High | Line 27 |
| 3 | **Day Check Logic** - Date parsing may fail for invalid dates | Medium | Line 38-40 |
| 4 | **Overlap Check Wrong** - Only checks exact start time match, not overlaps | Critical | Line 59 |

### Appointments Route (`src/routes/appointments.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 5 | **No 404 for Missing** - Returns undefined instead of 404 | Medium | Line 40 |
| 6 | **No Required Field Validation** - Missing doctorId, patientId, etc. | High | Line 47 |
| 7 | **No Date Format Validation** - Invalid dates accepted | High | Line 47 |
| 8 | **No Time Format Validation** - Invalid times accepted | High | Line 47 |
| 9 | **End Time Calculation** - Can exceed 24:00 (e.g., 24:30) | Medium | Line 64-68 |
| 10 | **Past Date Booking** - Can book appointments in the past | High | Line 70 |
| 11 | **Patient Double-Booking** - Same patient can book overlapping appointments | High | Line 83 |
| 12 | **Wrong Status Code** - Should return 201 for created resource | Low | Line 95 |
| 13 | **No Status Validation** - Any string accepted as status | High | Line 111 |
| 14 | **Invalid Reschedule** - Can reschedule cancelled/completed appointments | Medium | Line 127 |
| 15 | **No Conflict Check on Reschedule** - Can reschedule into occupied slot | Critical | Line 128 |
| 16 | **Hard Delete** - Should soft-delete (set status=cancelled), loses history | High | Line 149 |

### Main App (`src/index.ts`)

| # | Bug | Severity | Location |
|---|-----|----------|----------|
| 17 | **No Error Handler** - Unhandled errors crash server | High | Missing |

---

## Expected Fixes

### Bug #4: Slot Overlap Check
```typescript
// BEFORE - Only checks exact match
const isBooked = appointments.some(apt => apt.start_time === startTime);

// AFTER - Check actual overlap
const isBooked = appointments.some(apt => {
  const aptStart = apt.start_time;
  const aptEnd = apt.end_time;
  // New slot overlaps if: starts before apt ends AND ends after apt starts
  return startTime < aptEnd && endTime > aptStart;
});
```

### Bug #10: Past Date Check
```typescript
const appointmentDate = new Date(date);
const today = new Date();
today.setHours(0, 0, 0, 0);

if (appointmentDate < today) {
  res.status(400).json({ error: 'Cannot book appointments in the past' });
  return;
}
```

### Bug #11: Patient Double-Booking
```typescript
// Check patient doesn't have conflicting appointment
const patientConflict = db.prepare(`
  SELECT * FROM appointments 
  WHERE patient_id = ? 
  AND date = ? 
  AND status != 'cancelled'
  AND (
    (start_time <= ? AND end_time > ?) OR
    (start_time < ? AND end_time >= ?)
  )
`).get(patientId, date, startTime, startTime, endTime, endTime);

if (patientConflict) {
  res.status(409).json({ error: 'Patient already has an appointment at this time' });
  return;
}
```

### Bug #16: Soft Delete
```typescript
// BEFORE - Hard delete
db.prepare('DELETE FROM appointments WHERE id = ?').run(id);

// AFTER - Soft delete
db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
```

---

## Scoring Rubric

| Score | Bugs Found |
|-------|------------|
| 1-3 | 1-4 bugs |
| 4-5 | 5-8 bugs |
| 6-7 | 9-12 bugs |
| 8-9 | 13-15 bugs |
| 10 | All 17 bugs |

## Red Flags
- Doesn't understand overlap logic
- Doesn't consider patient conflicts
- Doesn't validate dates
- Allows booking in the past
