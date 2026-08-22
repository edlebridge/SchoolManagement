/*
# EduBridge Academic Domain Schema

1. Purpose
   All school-scoped academic data. Every table carries `school_id` and is protected
   by `is_school_member()` so tenant isolation is guaranteed at the database level.

2. New Tables
   - `academic_years` / `terms` — calendar structure per school.
   - `classes` — grade levels / streams within a term (e.g. "Grade 4A").
   - `subjects` — school subject catalog.
   - `class_subjects` — many-to-many between classes and subjects, with the assigned teacher.
   - `students` — student profiles (admission number, demographics, medical, enrollment status).
   - `student_parents` — many-to-many linking students to parents (one parent → many
     students, one student → many parents).
   - `attendance` — per-student daily attendance records (present/absent/late/excused).
   - `homework` — assignments with due date, attachments, class scope.
   - `exams` — exam definitions scoped to a subject + class + term.
   - `exam_marks` — per-student marks for an exam, with grade + teacher comment.
   - `report_cards` — generated digital report cards per student per term (printable).
   - `announcements` — school-wide / class / emergency / scheduled announcements.
   - `calendar_events` — school events, exams, meetings, holidays, sports.
   - `messages` — internal messaging (threaded) between any two app users in a school.
   - `notifications` — push/in-app notification log per user.

3. Security
   - RLS enabled on every table.
   - SELECT/INSERT/UPDATE/DELETE scoped to `is_school_member(school_id)` for tenant
     users, plus `is_super_admin()` for platform-wide access.
   - `messages`: a participant can only see threads where they are sender or recipient.
   - `notifications`: a user can only see notifications addressed to them.

4. Important notes
   - All `school_id` columns are NOT NULL on school-scoped tables.
   - Grading uses a stored `grade` text + numeric `marks` for flexibility across
     different grading systems per school/region.
*/

-- =========================================================
-- academic_years & terms
-- =========================================================

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.academic_years enable row level security;

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.terms enable row level security;

-- =========================================================
-- classes & subjects
-- =========================================================

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid references public.terms(id) on delete cascade,
  name text not null,
  grade_level text,
  stream text,
  class_teacher_id uuid references public.app_users(id) on delete set null,
  capacity int default 40,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid references public.app_users(id) on delete set null,
  unique (class_id, subject_id),
  created_at timestamptz not null default now()
);

alter table public.class_subjects enable row level security;

-- =========================================================
-- students & parents
-- =========================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_number text not null,
  full_name text not null,
  photo_url text,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  class_id uuid references public.classes(id) on delete set null,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  enrollment_status text not null default 'active' check (enrollment_status in ('active','transferred','graduated','suspended','inactive')),
  admitted_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_students_class on public.students(class_id);

alter table public.students enable row level security;

create table if not exists public.student_parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_user_id uuid not null references public.app_users(user_id) on delete cascade,
  relationship text default 'guardian' check (relationship in ('father','mother','guardian','other')),
  unique (student_id, parent_user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_student_parents_parent on public.student_parents(parent_user_id);
create index if not exists idx_student_parents_student on public.student_parents(student_id);

alter table public.student_parents enable row level security;

-- =========================================================
-- attendance
-- =========================================================

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  date date not null,
  status text not null check (status in ('present','absent','late','excused')),
  notes text,
  marked_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_school_date on public.attendance(school_id, date);
create index if not exists idx_attendance_student on public.attendance(student_id);

alter table public.attendance enable row level security;

-- =========================================================
-- homework
-- =========================================================

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid not null references public.app_users(user_id) on delete cascade,
  title text not null,
  description text,
  attachments jsonb default '[]'::jsonb,
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_homework_school on public.homework(school_id);
create index if not exists idx_homework_class on public.homework(class_id);

alter table public.homework enable row level security;

-- =========================================================
-- exams & marks
-- =========================================================

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  name text not null,
  exam_type text default 'midterm' check (exam_type in ('midterm','endterm','quiz','assessment','final')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

alter table public.exams enable row level security;

create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  marks numeric(6,2),
  total_marks numeric(6,2) default 100,
  grade text,
  teacher_comment text,
  entered_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create index if not exists idx_exam_marks_exam on public.exam_marks(exam_id);
create index if not exists idx_exam_marks_student on public.exam_marks(student_id);

alter table public.exam_marks enable row level security;

-- =========================================================
-- report cards
-- =========================================================

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  title text not null,
  summary text,
  overall_grade text,
  overall_marks numeric(6,2),
  class_position int,
  teacher_remarks text,
  principal_remarks text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_cards_student on public.report_cards(student_id);

alter table public.report_cards enable row level security;

-- =========================================================
-- announcements
-- =========================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references public.app_users(user_id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'school' check (audience in ('school','class','staff','emergency')),
  class_id uuid references public.classes(id) on delete cascade,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_school on public.announcements(school_id);

alter table public.announcements enable row level security;

-- =========================================================
-- calendar events
-- =========================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'event' check (event_type in ('event','exam','meeting','holiday','sports','deadline')),
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  class_id uuid references public.classes(id) on delete cascade,
  created_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_school on public.calendar_events(school_id);
create index if not exists idx_calendar_events_start on public.calendar_events(start_at);

alter table public.calendar_events enable row level security;

-- =========================================================
-- messages (threaded internal messaging)
-- =========================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  sender_id uuid not null references public.app_users(user_id) on delete cascade,
  recipient_id uuid not null references public.app_users(user_id) on delete cascade,
  subject text,
  body text not null,
  attachments jsonb default '[]'::jsonb,
  read_at timestamptz,
  parent_message_id uuid references public.messages(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on public.messages(recipient_id, read_at);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_school on public.messages(school_id);

alter table public.messages enable row level security;

-- =========================================================
-- notifications (in-app / push log)
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid not null references public.app_users(user_id) on delete cascade,
  type text not null check (type in ('attendance','homework','announcement','message','exam_result','calendar','invitation','system')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

-- =========================================================
-- RLS policies for all academic tables
-- =========================================================

-- academic_years
drop policy if exists "academic_years_select_member" on public.academic_years;
create policy "academic_years_select_member"
on public.academic_years for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "academic_years_write_member" on public.academic_years;
create policy "academic_years_write_member"
on public.academic_years for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "academic_years_update_member" on public.academic_years;
create policy "academic_years_update_member"
on public.academic_years for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "academic_years_delete_member" on public.academic_years;
create policy "academic_years_delete_member"
on public.academic_years for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- terms
drop policy if exists "terms_select_member" on public.terms;
create policy "terms_select_member"
on public.terms for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "terms_write_member" on public.terms;
create policy "terms_write_member"
on public.terms for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "terms_update_member" on public.terms;
create policy "terms_update_member"
on public.terms for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "terms_delete_member" on public.terms;
create policy "terms_delete_member"
on public.terms for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- classes
drop policy if exists "classes_select_member" on public.classes;
create policy "classes_select_member"
on public.classes for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "classes_write_member" on public.classes;
create policy "classes_write_member"
on public.classes for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "classes_update_member" on public.classes;
create policy "classes_update_member"
on public.classes for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "classes_delete_member" on public.classes;
create policy "classes_delete_member"
on public.classes for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- subjects
drop policy if exists "subjects_select_member" on public.subjects;
create policy "subjects_select_member"
on public.subjects for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "subjects_write_member" on public.subjects;
create policy "subjects_write_member"
on public.subjects for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "subjects_update_member" on public.subjects;
create policy "subjects_update_member"
on public.subjects for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "subjects_delete_member" on public.subjects;
create policy "subjects_delete_member"
on public.subjects for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- class_subjects
drop policy if exists "class_subjects_select_member" on public.class_subjects;
create policy "class_subjects_select_member"
on public.class_subjects for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "class_subjects_write_member" on public.class_subjects;
create policy "class_subjects_write_member"
on public.class_subjects for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "class_subjects_update_member" on public.class_subjects;
create policy "class_subjects_update_member"
on public.class_subjects for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "class_subjects_delete_member" on public.class_subjects;
create policy "class_subjects_delete_member"
on public.class_subjects for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- students
drop policy if exists "students_select_member" on public.students;
create policy "students_select_member"
on public.students for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "students_write_member" on public.students;
create policy "students_write_member"
on public.students for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "students_update_member" on public.students;
create policy "students_update_member"
on public.students for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "students_delete_member" on public.students;
create policy "students_delete_member"
on public.students for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- student_parents
drop policy if exists "student_parents_select_member" on public.student_parents;
create policy "student_parents_select_member"
on public.student_parents for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "student_parents_write_member" on public.student_parents;
create policy "student_parents_write_member"
on public.student_parents for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "student_parents_update_member" on public.student_parents;
create policy "student_parents_update_member"
on public.student_parents for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "student_parents_delete_member" on public.student_parents;
create policy "student_parents_delete_member"
on public.student_parents for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- attendance
drop policy if exists "attendance_select_member" on public.attendance;
create policy "attendance_select_member"
on public.attendance for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "attendance_write_member" on public.attendance;
create policy "attendance_write_member"
on public.attendance for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "attendance_update_member" on public.attendance;
create policy "attendance_update_member"
on public.attendance for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "attendance_delete_member" on public.attendance;
create policy "attendance_delete_member"
on public.attendance for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- homework
drop policy if exists "homework_select_member" on public.homework;
create policy "homework_select_member"
on public.homework for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "homework_write_member" on public.homework;
create policy "homework_write_member"
on public.homework for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "homework_update_member" on public.homework;
create policy "homework_update_member"
on public.homework for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "homework_delete_member" on public.homework;
create policy "homework_delete_member"
on public.homework for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- exams
drop policy if exists "exams_select_member" on public.exams;
create policy "exams_select_member"
on public.exams for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exams_write_member" on public.exams;
create policy "exams_write_member"
on public.exams for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exams_update_member" on public.exams;
create policy "exams_update_member"
on public.exams for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exams_delete_member" on public.exams;
create policy "exams_delete_member"
on public.exams for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- exam_marks
drop policy if exists "exam_marks_select_member" on public.exam_marks;
create policy "exam_marks_select_member"
on public.exam_marks for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exam_marks_write_member" on public.exam_marks;
create policy "exam_marks_write_member"
on public.exam_marks for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exam_marks_update_member" on public.exam_marks;
create policy "exam_marks_update_member"
on public.exam_marks for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "exam_marks_delete_member" on public.exam_marks;
create policy "exam_marks_delete_member"
on public.exam_marks for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- report_cards
drop policy if exists "report_cards_select_member" on public.report_cards;
create policy "report_cards_select_member"
on public.report_cards for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "report_cards_write_member" on public.report_cards;
create policy "report_cards_write_member"
on public.report_cards for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "report_cards_update_member" on public.report_cards;
create policy "report_cards_update_member"
on public.report_cards for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "report_cards_delete_member" on public.report_cards;
create policy "report_cards_delete_member"
on public.report_cards for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- announcements
drop policy if exists "announcements_select_member" on public.announcements;
create policy "announcements_select_member"
on public.announcements for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "announcements_write_member" on public.announcements;
create policy "announcements_write_member"
on public.announcements for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "announcements_update_member" on public.announcements;
create policy "announcements_update_member"
on public.announcements for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "announcements_delete_member" on public.announcements;
create policy "announcements_delete_member"
on public.announcements for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- calendar_events
drop policy if exists "calendar_events_select_member" on public.calendar_events;
create policy "calendar_events_select_member"
on public.calendar_events for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "calendar_events_write_member" on public.calendar_events;
create policy "calendar_events_write_member"
on public.calendar_events for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "calendar_events_update_member" on public.calendar_events;
create policy "calendar_events_update_member"
on public.calendar_events for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "calendar_events_delete_member" on public.calendar_events;
create policy "calendar_events_delete_member"
on public.calendar_events for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- messages: participant-scoped
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
on public.messages for select to authenticated
using (
  public.is_super_admin()
  or (
    public.is_school_member(school_id)
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  )
);

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member"
on public.messages for insert to authenticated
with check (
  public.is_super_admin()
  or (public.is_school_member(school_id) and sender_id = auth.uid())
);

drop policy if exists "messages_update_member" on public.messages;
create policy "messages_update_member"
on public.messages for update to authenticated
using (
  public.is_super_admin()
  or (public.is_school_member(school_id) and (sender_id = auth.uid() or recipient_id = auth.uid()))
)
with check (
  public.is_super_admin()
  or (public.is_school_member(school_id) and (sender_id = auth.uid() or recipient_id = auth.uid()))
);

drop policy if exists "messages_delete_member" on public.messages;
create policy "messages_delete_member"
on public.messages for delete to authenticated
using (
  public.is_super_admin()
  or (public.is_school_member(school_id) and sender_id = auth.uid())
);

-- notifications: user-scoped
drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self"
on public.notifications for select to authenticated
using (public.is_super_admin() or user_id = auth.uid());

drop policy if exists "notifications_insert_member" on public.notifications;
create policy "notifications_insert_member"
on public.notifications for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self"
on public.notifications for update to authenticated
using (public.is_super_admin() or user_id = auth.uid())
with check (public.is_super_admin() or user_id = auth.uid());

drop policy if exists "notifications_delete_self" on public.notifications;
create policy "notifications_delete_self"
on public.notifications for delete to authenticated
using (public.is_super_admin() or user_id = auth.uid());