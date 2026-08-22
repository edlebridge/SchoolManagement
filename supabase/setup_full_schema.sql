-- =========================================================
-- EduBridge Full Database Schema Setup
-- =========================================================
-- Run this entire script in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
--
-- This creates all tables, RLS policies, functions, views,
-- and the super admin account on your Supabase project.
-- It is safe to run multiple times (idempotent).
-- =========================================================

-- =========================================================
-- PART 1: Core Tenant & Identity Schema
-- =========================================================

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  email text,
  phone text,
  principal_name text,
  admin_name text,
  admin_email text,
  admin_phone text,
  status text not null default 'pending' check (status in ('pending','active','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role text not null check (role in ('super_admin','school_admin','teacher','parent')),
  full_name text not null,
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.app_users enable row level security;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter','growth','enterprise')),
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','suspended')),
  seats int not null default 0,
  student_limit int,
  billing_cycle text default 'annual' check (billing_cycle in ('monthly','annual')),
  amount numeric(10,2) default 0,
  currency text default 'KES',
  trial_ends_at timestamptz,
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

alter table public.subscriptions enable row level security;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('school_admin','teacher','parent')),
  email text,
  phone text,
  full_name text,
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  channel text default 'email' check (channel in ('email','sms')),
  metadata jsonb default '{}'::jsonb,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_school_status on public.invitations(school_id, status);

alter table public.invitations enable row level security;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_school on public.audit_logs(school_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

-- =========================================================
-- Helper functions for RBAC + multi-tenancy
-- =========================================================

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

create or replace function public.user_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select school_id from public.app_users where user_id = auth.uid();
$$;

create or replace function public.is_school_member(expected_school_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1 from public.app_users
      where user_id = auth.uid() and school_id = expected_school_id
    );
$$;

-- =========================================================
-- RLS policies — Core tables
-- =========================================================

-- schools
drop policy if exists "schools_select_super_or_member" on public.schools;
create policy "schools_select_super_or_member"
on public.schools for select to authenticated
using (public.is_super_admin() or public.is_school_member(id));

drop policy if exists "schools_insert_super_admin" on public.schools;
create policy "schools_insert_super_admin"
on public.schools for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "schools_update_super_admin" on public.schools;
create policy "schools_update_super_admin"
on public.schools for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "schools_update_own_school_admin" on public.schools;
create policy "schools_update_own_school_admin"
on public.schools for update to authenticated
using (public.is_school_member(id) and not public.is_super_admin())
with check (public.is_school_member(id) and not public.is_super_admin());

drop policy if exists "schools_delete_super_admin" on public.schools;
create policy "schools_delete_super_admin"
on public.schools for delete to authenticated
using (public.is_super_admin());

-- app_users
drop policy if exists "app_users_select_self_or_admin" on public.app_users;
create policy "app_users_select_self_or_admin"
on public.app_users for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or (public.is_school_member(school_id) and role <> 'super_admin')
);

drop policy if exists "app_users_insert_self" on public.app_users;
create policy "app_users_insert_self"
on public.app_users for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "app_users_update_self" on public.app_users;
create policy "app_users_update_self"
on public.app_users for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "app_users_update_own_school_admin" on public.app_users;
create policy "app_users_update_own_school_admin"
on public.app_users for update to authenticated
using (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
)
with check (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
);

drop policy if exists "app_users_delete_super_admin" on public.app_users;
create policy "app_users_delete_super_admin"
on public.app_users for delete to authenticated
using (public.is_super_admin());

drop policy if exists "app_users_delete_own_school_admin" on public.app_users;
create policy "app_users_delete_own_school_admin"
on public.app_users for delete to authenticated
using (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
);

-- subscriptions
drop policy if exists "subscriptions_select_super_or_member" on public.subscriptions;
create policy "subscriptions_select_super_or_member"
on public.subscriptions for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "subscriptions_all_super_admin" on public.subscriptions;
create policy "subscriptions_all_super_admin"
on public.subscriptions for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

-- invitations
drop policy if exists "invitations_select_by_token_public" on public.invitations;
create policy "invitations_select_by_token_public"
on public.invitations for select to anon, authenticated
using (token is not null);

drop policy if exists "invitations_select_super_or_school_admin" on public.invitations;
create policy "invitations_select_super_or_school_admin"
on public.invitations for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_insert_super_or_school_admin" on public.invitations;
create policy "invitations_insert_super_or_school_admin"
on public.invitations for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_update_super_or_school_admin" on public.invitations;
create policy "invitations_update_super_or_school_admin"
on public.invitations for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_delete_super_or_school_admin" on public.invitations;
create policy "invitations_delete_super_or_school_admin"
on public.invitations for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- audit_logs
drop policy if exists "audit_logs_select_super_or_member" on public.audit_logs;
create policy "audit_logs_select_super_or_member"
on public.audit_logs for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
on public.audit_logs for insert to authenticated
with check (auth.uid() is not null);

-- =========================================================
-- PART 2: Academic Domain Schema
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
  relationship text default 'guardian' check (relationship in ('father','mother','guardian','aunt','uncle','other')),
  is_primary_guardian boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, parent_user_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_student_parents_parent on public.student_parents(parent_user_id);
create index if not exists idx_student_parents_student on public.student_parents(student_id);

alter table public.student_parents enable row level security;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  date date not null,
  status text not null check (status in ('present','absent','late','excused')),
  session text not null default 'morning' check (session in ('morning','afternoon')),
  notes text,
  marked_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, date, session)
);

create index if not exists idx_attendance_school_date on public.attendance(school_id, date);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_class_date_session on public.attendance(class_id, date, session);

alter table public.attendance enable row level security;

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

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  term_id uuid references public.terms(id) on delete set null,
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','scheduled','completed','published')),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exam_sessions enable row level security;

create index if not exists idx_exam_sessions_school on public.exam_sessions(school_id);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  exam_session_id uuid references public.exam_sessions(id) on delete set null,
  name text not null,
  exam_type text default 'midterm' check (exam_type in ('midterm','endterm','quiz','assessment','final')),
  status text not null default 'scheduled' check (status in ('draft','scheduled','completed','published')),
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  exam_date date,
  start_time time,
  end_time time,
  duration_minutes integer,
  room text,
  teacher_id uuid references public.app_users(id) on delete set null,
  total_marks numeric not null default 100,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_exams_session on public.exams(exam_session_id);
create index if not exists idx_exams_class_subject on public.exams(class_id, subject_id);
create index if not exists idx_exams_session_class_date on public.exams(exam_session_id, class_id, exam_date);

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
  position integer,
  remarks text,
  entered_by uuid references public.app_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

create index if not exists idx_exam_marks_exam on public.exam_marks(exam_id);
create index if not exists idx_exam_marks_student on public.exam_marks(student_id);
create index if not exists idx_exam_marks_exam_class on public.exam_marks(exam_id, class_id);

alter table public.exam_marks enable row level security;

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
  conversation_id text,
  message_type text not null default 'text' check (message_type in ('text','image','document','system')),
  attachment_url text,
  attachment_name text,
  is_typing timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on public.messages(recipient_id, read_at);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_messages_school on public.messages(school_id);
create index if not exists idx_messages_recipient_read on public.messages(recipient_id, read_at);
create index if not exists idx_messages_conversation on public.messages(conversation_id);

alter table public.messages enable row level security;

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
-- RLS policies — Exam Sessions
-- =========================================================

drop policy if exists "exam_sessions_select_member" on public.exam_sessions;
create policy "exam_sessions_select_member" on public.exam_sessions for select
  to authenticated using (is_super_admin() or is_school_member(school_id));
drop policy if exists "exam_sessions_insert_member" on public.exam_sessions;
create policy "exam_sessions_insert_member" on public.exam_sessions for insert
  to authenticated with check (is_super_admin() or is_school_member(school_id));
drop policy if exists "exam_sessions_update_member" on public.exam_sessions;
create policy "exam_sessions_update_member" on public.exam_sessions for update
  to authenticated using (is_super_admin() or is_school_member(school_id))
  with check (is_super_admin() or is_school_member(school_id));
drop policy if exists "exam_sessions_delete_member" on public.exam_sessions;
create policy "exam_sessions_delete_member" on public.exam_sessions for delete
  to authenticated using (is_super_admin() or is_school_member(school_id));

-- =========================================================
-- RLS policies — Academic tables
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

-- =========================================================
-- PART 3: Additional columns from later migrations
-- =========================================================

-- app_users expanded profile fields
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS medical_history text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS qualification text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS employment_date date;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS id_card_url text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS certificates jsonb DEFAULT '[]'::jsonb;

-- students expanded fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number text;

-- academic_years archive
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- exam_marks position and remarks
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS remarks text;

-- =========================================================
-- PART 4: Triggers and functions
-- =========================================================

-- Auth token defaults trigger
CREATE OR REPLACE FUNCTION public.ensure_auth_token_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_token_defaults ON auth.users;
CREATE TRIGGER trg_auth_users_token_defaults
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_auth_token_defaults();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_parents_touch ON student_parents;
CREATE TRIGGER trg_student_parents_touch
  BEFORE UPDATE ON student_parents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_exam_sessions_touch ON exam_sessions;
CREATE TRIGGER trg_exam_sessions_touch
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- PART 5: Platform settings table
-- =========================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_plan text NOT NULL DEFAULT 'starter',
  default_trial_days integer NOT NULL DEFAULT 14,
  default_currency text NOT NULL DEFAULT 'USD',
  default_student_limit integer NOT NULL DEFAULT 500,
  platform_fee_pct numeric NOT NULL DEFAULT 0,
  maintenance_mode boolean NOT NULL DEFAULT false,
  contact_email text,
  support_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_select_super_admin"
ON platform_settings FOR SELECT TO authenticated
USING (is_super_admin());

DROP POLICY IF EXISTS "platform_settings_insert_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_insert_super_admin"
ON platform_settings FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "platform_settings_update_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_update_super_admin"
ON platform_settings FOR UPDATE TO authenticated
USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO platform_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);

-- =========================================================
-- PART 6: Parent children function and view
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_my_children()
RETURNS TABLE (
  id uuid,
  full_name text,
  school_id uuid,
  class_id uuid,
  admission_number text,
  enrollment_status text,
  gender text,
  date_of_birth date,
  phone_number text,
  relationship text,
  is_primary_guardian boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.full_name,
    s.school_id,
    s.class_id,
    s.admission_number,
    s.enrollment_status,
    s.gender,
    s.date_of_birth,
    s.phone_number,
    sp.relationship,
    sp.is_primary_guardian
  FROM public.student_parents sp
  JOIN public.students s ON s.id = sp.student_id
  WHERE sp.parent_user_id = auth.uid()
    AND s.enrollment_status != 'deleted';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_children() TO authenticated;

CREATE OR REPLACE VIEW public.parent_children_view AS
SELECT
  sp.parent_user_id,
  sp.student_id,
  sp.school_id,
  sp.relationship,
  sp.is_primary_guardian,
  s.full_name AS student_name,
  s.class_id,
  s.admission_number,
  s.enrollment_status,
  s.gender,
  s.date_of_birth,
  s.phone_number,
  s.photo_url,
  au.full_name AS parent_name,
  au.role AS parent_role
FROM public.student_parents sp
JOIN public.students s ON s.id = sp.student_id
JOIN public.app_users au ON au.user_id = sp.parent_user_id
WHERE s.enrollment_status != 'deleted';

GRANT SELECT ON public.parent_children_view TO authenticated;

-- =========================================================
-- PART 7: Storage bucket policies
-- =========================================================

-- student-photos bucket policies
DROP POLICY IF EXISTS "auth_upload_student_photos" ON storage.objects;
CREATE POLICY "auth_upload_student_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos');
DROP POLICY IF EXISTS "auth_read_student_photos" ON storage.objects;
CREATE POLICY "auth_read_student_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');
DROP POLICY IF EXISTS "auth_update_student_photos" ON storage.objects;
CREATE POLICY "auth_update_student_photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'student-photos') WITH CHECK (bucket_id = 'student-photos');
DROP POLICY IF EXISTS "auth_delete_student_photos" ON storage.objects;
CREATE POLICY "auth_delete_student_photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'student-photos');

-- profile-photos bucket policies
DROP POLICY IF EXISTS "auth_upload_profile_photos" ON storage.objects;
CREATE POLICY "auth_upload_profile_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');
DROP POLICY IF EXISTS "auth_read_profile_photos" ON storage.objects;
CREATE POLICY "auth_read_profile_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');
DROP POLICY IF EXISTS "auth_update_profile_photos" ON storage.objects;
CREATE POLICY "auth_update_profile_photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos') WITH CHECK (bucket_id = 'profile-photos');
DROP POLICY IF EXISTS "auth_delete_profile_photos" ON storage.objects;
CREATE POLICY "auth_delete_profile_photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'profile-photos');

-- teacher-documents bucket policies
DROP POLICY IF EXISTS "auth_upload_teacher_docs" ON storage.objects;
CREATE POLICY "auth_upload_teacher_docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'teacher-documents');
DROP POLICY IF EXISTS "auth_read_teacher_docs" ON storage.objects;
CREATE POLICY "auth_read_teacher_docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'teacher-documents');
DROP POLICY IF EXISTS "auth_delete_teacher_docs" ON storage.objects;
CREATE POLICY "auth_delete_teacher_docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'teacher-documents');

-- =========================================================
-- PART 8: Seed Super Admin Account
-- =========================================================
-- Creates owner@edubridge.io with password EduBridge#2026
-- You can change the email/password after first login.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'owner@edubridge.io',
  crypt('EduBridge#2026', gen_salt('bf', 10)),
  now(),
  '{"role":"super_admin"}'::jsonb,
  '{"full_name":"Platform Owner"}'::jsonb,
  false,
  false,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'owner@edubridge.io'
);

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  id
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now(),
  gen_random_uuid()
FROM auth.users u
WHERE u.email = 'owner@edubridge.io'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

INSERT INTO public.app_users (
  user_id,
  school_id,
  role,
  full_name,
  phone,
  avatar_url,
  active
)
SELECT
  u.id,
  NULL,
  'super_admin',
  'Platform Owner',
  NULL,
  NULL,
  TRUE
FROM auth.users u
WHERE u.email = 'owner@edubridge.io'
  AND NOT EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = u.id
  );

-- =========================================================
-- DONE — Your EduBridge database is ready!
-- =========================================================
-- You can now log in with:
--   Email:    owner@edubridge.io
--   Password: EduBridge#2026
-- =========================================================
