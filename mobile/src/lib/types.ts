export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'parent';
export interface AppUser { id: string; user_id: string; school_id: string | null; role: UserRole; full_name: string; phone: string | null; avatar_url: string | null; active: boolean; }
export interface School { id: string; name: string; logo_url: string | null; }
export interface Student { id: string; school_id: string; admission_number: string; full_name: string; photo_url: string | null; gender: string | null; class_id: string | null; enrollment_status: string; }
export interface ClassRow { id: string; school_id: string; name: string; grade_level: string | null; stream: string | null; class_teacher_id: string | null; }
export interface Attendance { id: string; school_id: string; student_id: string; class_id: string | null; date: string; session: 'morning' | 'afternoon'; status: string; notes: string | null; marked_by: string | null; }
export interface Homework { id: string; school_id: string; class_id: string; subject_id: string | null; teacher_id: string; title: string; description: string | null; due_date: string; created_at: string; }
export interface Message { id: string; school_id: string; sender_id: string; recipient_id: string; body: string; conversation_id: string | null; read_at: string | null; created_at: string; }
