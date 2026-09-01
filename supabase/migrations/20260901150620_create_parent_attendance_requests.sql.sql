/*
# Create parent_attendance_requests table

1. New Tables
- `parent_attendance_requests`
  - `id` (uuid, PK)
  - `school_id` (uuid, FK to schools)
  - `parent_user_id` (uuid, NOT NULL - the parent submitting the request)
  - `student_id` (uuid, FK to students - the child the request is about)
  - `class_id` (uuid, nullable - child's class at time of submission for routing to teacher)
  - `request_type` (text, NOT NULL - 'absence' | 'late' | 'early_collection')
  - `status` (text, NOT NULL DEFAULT 'pending' - 'pending' | 'approved' | 'rejected' | 'acknowledged')
  - `reason` (text, nullable - for absence: 'holiday' | 'illness' | 'urgent_family' | 'other')
  - `custom_reason` (text, nullable - when reason is 'other')
  - `from_date` (date, nullable - for absence)
  - `to_date` (date, nullable - for absence)
  - `date` (date, nullable - for late/early_collection)
  - `expected_arrival_time` (time, nullable - for late)
  - `leaving_time` (time, nullable - for early_collection)
  - `collected_by` (text, nullable - for early_collection)
  - `notes` (text, nullable - general notes)
  - `reviewed_by` (uuid, nullable - teacher/admin who reviewed)
  - `reviewed_at` (timestamptz, nullable)
  - `review_notes` (text, nullable - response from school)
  - `created_at` (timestamptz, DEFAULT now())
  - `updated_at` (timestamptz, DEFAULT now())

2. Security
- Enable RLS on `parent_attendance_requests`.
- Parents can CRUD their own requests (filtered by parent_user_id = auth.uid()).
- School admins can view/update requests for their school.
- Teachers can view requests for students in their classes.

3. Indexes
- Index on school_id for admin queries
- Index on parent_user_id for parent queries
- Index on class_id for teacher queries
- Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS parent_attendance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid,
  request_type text NOT NULL CHECK (request_type IN ('absence', 'late', 'early_collection')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'acknowledged')),
  reason text,
  custom_reason text,
  from_date date,
  to_date date,
  date date,
  expected_arrival_time time,
  leaving_time time,
  collected_by text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parent_attendance_requests ENABLE ROW LEVEL SECURITY;

-- Parents: full CRUD on their own requests
DROP POLICY IF EXISTS "select_own_parent_requests" ON parent_attendance_requests;
CREATE POLICY "select_own_parent_requests" ON parent_attendance_requests
  FOR SELECT TO authenticated USING (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_parent_requests" ON parent_attendance_requests;
CREATE POLICY "insert_own_parent_requests" ON parent_attendance_requests
  FOR INSERT TO authenticated WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_parent_requests" ON parent_attendance_requests;
CREATE POLICY "update_own_parent_requests" ON parent_attendance_requests
  FOR UPDATE TO authenticated USING (parent_user_id = auth.uid()) WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_parent_requests" ON parent_attendance_requests;
CREATE POLICY "delete_own_parent_requests" ON parent_attendance_requests
  FOR DELETE TO authenticated USING (parent_user_id = auth.uid());

-- School admins: view and update requests for their school
-- Uses app_users table to verify the user is a school_admin for this school
DROP POLICY IF EXISTS "admin_view_parent_requests" ON parent_attendance_requests;
CREATE POLICY "admin_view_parent_requests" ON parent_attendance_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.school_id = parent_attendance_requests.school_id
      AND app_users.role = 'school_admin'
    )
  );

DROP POLICY IF EXISTS "admin_update_parent_requests" ON parent_attendance_requests;
CREATE POLICY "admin_update_parent_requests" ON parent_attendance_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.school_id = parent_attendance_requests.school_id
      AND app_users.role = 'school_admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.school_id = parent_attendance_requests.school_id
      AND app_users.role = 'school_admin'
    )
  );

-- Teachers: view requests for students in classes they teach
DROP POLICY IF EXISTS "teacher_view_parent_requests" ON parent_attendance_requests;
CREATE POLICY "teacher_view_parent_requests" ON parent_attendance_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.school_id = parent_attendance_requests.school_id
      AND app_users.role = 'teacher'
    )
    AND (
      -- Class teacher of the student's class
      EXISTS (
        SELECT 1 FROM classes
        WHERE classes.id = parent_attendance_requests.class_id
        AND classes.class_teacher_id = (
          SELECT id FROM app_users WHERE app_users.user_id = auth.uid()
        )
      )
      OR
      -- Teaches a subject in the student's class
      EXISTS (
        SELECT 1 FROM class_subjects
        WHERE class_subjects.class_id = parent_attendance_requests.class_id
        AND class_subjects.teacher_id = (
          SELECT id FROM app_users WHERE app_users.user_id = auth.uid()
        )
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parent_attendance_requests_school_id ON parent_attendance_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_attendance_requests_parent_user_id ON parent_attendance_requests(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_attendance_requests_class_id ON parent_attendance_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_parent_attendance_requests_status ON parent_attendance_requests(status);
CREATE INDEX IF NOT EXISTS idx_parent_attendance_requests_created_at ON parent_attendance_requests(created_at DESC);
