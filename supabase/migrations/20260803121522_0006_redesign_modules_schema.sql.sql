/*
# Redesign: Chat, Attendance, Students, Exams, Marks modules (retry)

Schema-only migration — demo seed data omitted for fresh database.
*/

-- ── Attendance: two sessions ──
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session text NOT NULL DEFAULT 'morning';
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_session_check;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_date_session_key;
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
ALTER TABLE exams ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
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