/*
# Redesign: Chat, Attendance, Students, Exams, Marks modules

## 1. Attendance — two sessions per day
- Add `session` column: 'morning' | 'afternoon', default 'morning'.
- Update unique constraint from (student_id, date) to (student_id, date, session).
- Add index on (class_id, date, session).

## 2. Exam Sessions + Exam Schedules
- Create `exam_sessions` table (name, year, term, dates, status, published).
- Add `exam_session_id` + schedule fields to `exams` (class_id, subject_id,
  start_time, end_time, duration_minutes, room, teacher_id, exam_date, total_marks, status).

## 3. Messages — chat enhancements
- Add conversation_id, message_type, attachment_url, attachment_name, is_typing.
- Add indexes for unread and conversation queries.

## 4. Seed demo data: academic year, term, class-subjects, exam session + schedule.

## 5. RLS on exam_sessions with school-member policies.
*/

-- ── Attendance: two sessions ──
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session text NOT NULL DEFAULT 'morning';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_session_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_session_check CHECK (session = ANY (ARRAY['morning','afternoon']));
ALTER TABLE attendance ADD CONSTRAINT attendance_student_date_session_key UNIQUE (student_id, date, session);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date_session ON attendance(class_id, date, session);

-- ── Exam Sessions ──
CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES app_users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_status_check;
ALTER TABLE exam_sessions ADD CONSTRAINT exam_sessions_status_check
  CHECK (status = ANY (ARRAY['draft','scheduled','completed','published']));
CREATE INDEX IF NOT EXISTS idx_exam_sessions_school ON exam_sessions(school_id);

DROP POLICY IF EXISTS "exam_sessions_select_member" ON exam_sessions;
CREATE POLICY "exam_sessions_select_member" ON exam_sessions FOR SELECT
  TO authenticated USING (is_super_admin() OR is_school_member(school_id));
DROP POLICY IF EXISTS "exam_sessions_insert_member" ON exam_sessions;
CREATE POLICY "exam_sessions_insert_member" ON exam_sessions FOR INSERT
  TO authenticated WITH CHECK (is_super_admin() OR is_school_member(school_id));
DROP POLICY IF EXISTS "exam_sessions_update_member" ON exam_sessions;
CREATE POLICY "exam_sessions_update_member" ON exam_sessions FOR UPDATE
  TO authenticated USING (is_super_admin() OR is_school_member(school_id))
  WITH CHECK (is_super_admin() OR is_school_member(school_id));
DROP POLICY IF EXISTS "exam_sessions_delete_member" ON exam_sessions;
CREATE POLICY "exam_sessions_delete_member" ON exam_sessions FOR DELETE
  TO authenticated USING (is_super_admin() OR is_school_member(school_id));

-- ── Exams: add session link + schedule fields ──
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_session_id uuid REFERENCES exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_date date;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES app_users(user_id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS total_marks numeric NOT NULL DEFAULT 100;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_status_check;
ALTER TABLE exams ADD CONSTRAINT exams_status_check
  CHECK (status = ANY (ARRAY['draft','scheduled','completed','published']));
CREATE INDEX IF NOT EXISTS idx_exams_session ON exams(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_exams_class_subject ON exams(class_id, subject_id);

-- ── Messages: chat enhancements ──
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_typing timestamptz;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','document','system']));
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read ON messages(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ── Seed: Academic Year + Term ──
INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','2025/2026','2025-01-06','2025-12-12',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO terms (id, school_id, academic_year_id, name, start_date, end_date, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','a0000000-0000-0000-0000-000000000001','Term 1','2025-01-06','2025-04-04',true)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Class-Subject assignments ──
-- teacher_id references app_users.id (not user_id)
-- Niineey app_users.id = 04530673-ec47-4fd5-b803-37aa2d4d302f
-- Harun   app_users.id = 77209ca6-6af6-4a5d-a448-86517559707a
INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id) VALUES
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','add0f7dc-74bc-44ae-975d-4d789fe7ed06','6e9fb430-0184-4a76-a99f-0c6340b10bd4','04530673-ec47-4fd5-b803-37aa2d4d302f'),
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','add0f7dc-74bc-44ae-975d-4d789fe7ed06','84d4ee64-607d-4cf5-b082-47be4ffe4e65','04530673-ec47-4fd5-b803-37aa2d4d302f'),
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','8af23a55-eaf0-4e22-b2bc-7632708fc5d8','8c8e1d24-34ce-4105-ba78-32c5b8c942e7','77209ca6-6af6-4a5d-a448-86517559707a'),
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','8af23a55-eaf0-4e22-b2bc-7632708fc5d8','6e9fb430-0184-4a76-a99f-0c6340b10bd4','77209ca6-6af6-4a5d-a448-86517559707a'),
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','0ac4d961-7a17-4013-b9f1-8d1d6798810c','84d4ee64-607d-4cf5-b082-47be4ffe4e65','77209ca6-6af6-4a5d-a448-86517559707a'),
('ddccbf60-353f-40c5-a83f-3f8cf84eccfb','0ac4d961-7a17-4013-b9f1-8d1d6798810c','8c8e1d24-34ce-4105-ba78-32c5b8c942e7','77209ca6-6af6-4a5d-a448-86517559707a')
ON CONFLICT DO NOTHING;

-- ── Seed: Demo exam session ──
INSERT INTO exam_sessions (id, school_id, academic_year_id, term_id, name, start_date, end_date, status, published)
VALUES ('c0000000-0000-0000-0000-000000000001','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Midterm Term 1','2025-02-10','2025-02-14','scheduled',false)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Demo exam schedule entries ──
-- exams.teacher_id references app_users.user_id
-- Niineey user_id = a052161f-3428-4e73-bce5-33876223c1f5
-- Harun   user_id = e5454b0e-bfa7-4abc-8ce9-4cbb34300be0
INSERT INTO exams (id, school_id, exam_session_id, term_id, name, exam_type, class_id, subject_id, exam_date, start_time, end_time, duration_minutes, room, teacher_id, total_marks, status)
VALUES
('d0000000-0000-0000-0000-000000000001','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','English Midterm','midterm','add0f7dc-74bc-44ae-975d-4d789fe7ed06','6e9fb430-0184-4a76-a99f-0c6340b10bd4','2025-02-10','08:00','10:00',120,'Room A','a052161f-3428-4e73-bce5-33876223c1f5',50,'scheduled'),
('d0000000-0000-0000-0000-000000000002','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Math Midterm','midterm','add0f7dc-74bc-44ae-975d-4d789fe7ed06','84d4ee64-607d-4cf5-b082-47be4ffe4e65','2025-02-11','08:00','10:00',120,'Room A','a052161f-3428-4e73-bce5-33876223c1f5',50,'scheduled'),
('d0000000-0000-0000-0000-000000000003','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Science Midterm','midterm','8af23a55-eaf0-4e22-b2bc-7632708fc5d8','8c8e1d24-34ce-4105-ba78-32c5b8c942e7','2025-02-10','08:00','10:00',120,'Room B','e5454b0e-bfa7-4abc-8ce9-4cbb34300be0',50,'scheduled'),
('d0000000-0000-0000-0000-000000000004','ddccbf60-353f-40c5-a83f-3f8cf84eccfb','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','English Midterm','midterm','8af23a55-eaf0-4e22-b2bc-7632708fc5d8','6e9fb430-0184-4a76-a99f-0c6340b10bd4','2025-02-11','08:00','10:00',120,'Room B','e5454b0e-bfa7-4abc-8ce9-4cbb34300be0',50,'scheduled')
ON CONFLICT (id) DO NOTHING;

-- ── updated_at trigger for exam_sessions ──
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_exam_sessions_touch ON exam_sessions;
CREATE TRIGGER trg_exam_sessions_touch
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
