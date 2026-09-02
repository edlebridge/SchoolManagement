export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'parent';

export interface AppUser {
  id: string;
  user_id: string;
  school_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  address?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  qualification?: string | null;
  department?: string | null;
  employment_date?: string | null;
  employment_status?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at?: string;
}

export interface School {
  id: string;
  name: string;
  logo_url: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  full_name: string;
  photo_url: string | null;
  gender: string | null;
  class_id: string | null;
  enrollment_status: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  phone_number?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  medical_notes?: string | null;
  admitted_at?: string | null;
  created_at?: string;
}

export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  grade_level: string | null;
  stream: string | null;
  class_teacher_id: string | null;
  capacity?: number | null;
  term_id?: string | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

export interface ClassSubject {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  archived: boolean;
}

export interface Term {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface ExamSession {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Exam {
  id: string;
  school_id: string;
  term_id: string | null;
  exam_session_id: string;
  name: string;
  exam_type: string;
  start_date: string;
  end_date: string;
  status: string;
  class_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  room: string | null;
  teacher_id: string | null;
  total_marks: number;
}

export interface ExamMark {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  marks: number;
  total_marks: number;
  grade: string;
  teacher_comment: string | null;
  entered_by: string;
  created_at: string;
  position?: number | null;
  remarks?: string | null;
}

export interface Attendance {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  session: 'morning' | 'afternoon';
  status: string;
  notes: string | null;
  marked_by: string | null;
}

export interface Homework {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  school_id: string;
  sender_id: string;
  recipient_id: string;
  subject?: string | null;
  body: string;
  read_at: string | null;
  conversation_id: string | null;
  message_type: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
}

export interface StudentParent {
  id: string;
  school_id: string;
  student_id: string;
  parent_user_id: string;
  relationship: string;
  is_primary_guardian: boolean;
}

export type AttendanceRequestType = 'absence' | 'late' | 'early_collection';
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'acknowledged';

export interface ParentAttendanceRequest {
  id: string;
  school_id: string;
  parent_user_id: string;
  student_id: string;
  class_id: string | null;
  request_type: AttendanceRequestType;
  status: AttendanceRequestStatus;
  reason: string | null;
  custom_reason: string | null;
  from_date: string | null;
  to_date: string | null;
  date: string | null;
  expected_arrival_time: string | null;
  leaving_time: string | null;
  collected_by: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AppNotification {
  id: string;
  school_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
