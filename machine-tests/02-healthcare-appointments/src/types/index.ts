export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  available_days: string; // JSON array of days
}

export interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface Appointment {
  id: string;
  doctor_id: number;
  patient_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes?: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

export interface CreateAppointmentRequest {
  doctorId: number;
  patientId: number;
  date: string;
  startTime: string;
  duration: number; // in minutes
  notes?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}
