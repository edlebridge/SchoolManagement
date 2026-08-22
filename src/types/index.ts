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
  created_at: string;
  updated_at: string;
  // Extended profile fields
  address?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  national_id?: string | null;
  medical_history?: string | null;
  qualification?: string | null;
  department?: string | null;
  employment_date?: string | null;
  employment_status?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  id_card_url?: string | null;
  certificates?: any[];
}

export interface School {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  principal_name: string | null;
  admin_name: string | null;
  admin_email: string | null;
  admin_phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  full_name: string;
  photo_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  enrollment_status: string;
  admitted_at: string | null;
  created_at: string;
  updated_at: string;
  address?: string | null;
  nationality?: string | null;
  phone_number?: string | null;
}

export interface ClassRow {
  id: string;
  school_id: string;
  term_id: string | null;
  name: string;
  grade_level: string | null;
  stream: string | null;
  class_teacher_id: string | null;
  capacity: number | null;
  created_at: string;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export interface ClassSubject {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  created_at: string;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  archived: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface ExamSession {
  id: string;
  school_id: string;
  academic_year_id: string | null;
  term_id: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  school_id: string;
  term_id: string | null;
  exam_session_id: string | null;
  name: string;
  exam_type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  class_id: string | null;
  subject_id: string | null;
  exam_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  room: string | null;
  teacher_id: string | null;
  total_marks: number;
  created_at: string;
}

export interface ExamMark {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  class_id: string | null;
  marks: number | null;
  total_marks: number;
  grade: string | null;
  teacher_comment: string | null;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface Message {
  id: string;
  school_id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  attachments: any[];
  read_at: string | null;
  parent_message_id: string | null;
  conversation_id: string | null;
  message_type: string;
  attachment_url: string | null;
  attachment_name: string | null;
  is_typing: string | null;
  created_at: string;
}

export interface Homework {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  title: string;
  description: string | null;
  attachments: any[];
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface StudentParent {
  id: string;
  school_id: string;
  student_id: string;
  parent_user_id: string;
  relationship: string;
  is_primary_guardian: boolean;
  created_at: string;
  updated_at: string;
}
