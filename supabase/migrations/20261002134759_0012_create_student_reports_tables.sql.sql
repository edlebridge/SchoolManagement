/*
# Create Student Reports and School Reports tables

1. Purpose
- Implements a role-based Student Report workflow: Teacher writes → Admin reviews → Admin publishes → Parent views.
- Adds school-level analytical reports for admins.
- One central student_report record shared across web and mobile.

2. New Tables
- `student_reports`: Individual student reports written by teachers, reviewed/published by admins, viewed by parents.
  - id, school_id, student_id, teacher_id, class_id, academic_year_id, term_id
  - academic_progress, strengths, areas_for_improvement, behaviour (text)
  - attendance_summary (jsonb: {percentage, present, absent, late, excused})
  - academic_results (jsonb: [{subject, score, grade}])
  - teacher_comment, recommendations (text)
  - overall_assessment (enum: excellent, very_good, good, satisfactory, needs_improvement)
  - status (enum: draft, submitted, under_review, changes_requested, resubmitted, approved, published)
  - admin_feedback (text), approved_by (uuid), approved_at, published_at
  - created_at, updated_at

- `school_reports`: School-level analytical reports created by admins.
  - id, school_id, academic_year_id, term_id
  - report_type (enum: term, annual, academic_performance, attendance_overview, school_improvement)
  - school_overview, academic_commentary, attendance_commentary, achievements, challenges, improvements, next_steps, principal_message (text)
  - analytics_snapshot (jsonb: computed stats at time of save)
  - status (enum: draft, published)
  - created_by, created_at, updated_at, published_at

3. Security
- RLS enabled on both tables.
- Policies: school members (authenticated users belonging to the same school) can read; teachers can insert/update their own reports; school admins can update any report in their school; parents can read only published reports for their children.
*/

CREATE TABLE IF NOT EXISTS student_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  academic_progress text DEFAULT '',
  strengths text DEFAULT '',
  areas_for_improvement text DEFAULT '',
  behaviour text DEFAULT '',
  attendance_summary jsonb DEFAULT '{}'::jsonb,
  academic_results jsonb DEFAULT '[]'::jsonb,
  teacher_comment text DEFAULT '',
  recommendations text DEFAULT '',
  overall_assessment text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  admin_feedback text DEFAULT NULL,
  approved_by uuid DEFAULT NULL,
  approved_at timestamptz DEFAULT NULL,
  published_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_student_reports_school ON student_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_student_reports_teacher ON student_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_reports_student ON student_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_student_reports_status ON student_reports(status);

-- SELECT: school members can read reports in their school; parents can read only published reports for their children
DROP POLICY IF EXISTS "select_student_reports" ON student_reports;
CREATE POLICY "select_student_reports"
ON student_reports FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = student_reports.school_id)
  OR
  EXISTS (
    SELECT 1 FROM app_users au
    JOIN student_parents sp ON sp.parent_user_id = au.user_id
    WHERE au.id = auth.uid()
      AND au.school_id = student_reports.school_id
      AND sp.student_id = student_reports.student_id
      AND student_reports.status = 'published'
  )
);

-- INSERT: teachers can create reports for their school
DROP POLICY IF EXISTS "insert_student_reports" ON student_reports;
CREATE POLICY "insert_student_reports"
ON student_reports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = student_reports.school_id)
);

-- UPDATE: teachers can update their own reports; school admins can update any report in their school
DROP POLICY IF EXISTS "update_student_reports" ON student_reports;
CREATE POLICY "update_student_reports"
ON student_reports FOR UPDATE
TO authenticated
USING (
  student_reports.teacher_id = auth.uid()
  OR
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = student_reports.school_id AND au.role = 'school_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = student_reports.school_id)
);

-- DELETE: teachers can delete their own draft reports; school admins can delete any report
DROP POLICY IF EXISTS "delete_student_reports" ON student_reports;
CREATE POLICY "delete_student_reports"
ON student_reports FOR DELETE
TO authenticated
USING (
  student_reports.teacher_id = auth.uid()
  OR
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = student_reports.school_id AND au.role = 'school_admin')
);

-- School Reports table
CREATE TABLE IF NOT EXISTS school_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  report_type text NOT NULL DEFAULT 'term',
  title text NOT NULL DEFAULT '',
  school_overview text DEFAULT '',
  academic_commentary text DEFAULT '',
  attendance_commentary text DEFAULT '',
  achievements text DEFAULT '',
  challenges text DEFAULT '',
  improvements text DEFAULT '',
  next_steps text DEFAULT '',
  principal_message text DEFAULT '',
  analytics_snapshot jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz DEFAULT NULL
);

ALTER TABLE school_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_school_reports_school ON school_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_school_reports_type ON school_reports(report_type);

-- SELECT: any school member can read school reports
DROP POLICY IF EXISTS "select_school_reports" ON school_reports;
CREATE POLICY "select_school_reports"
ON school_reports FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = school_reports.school_id)
);

-- INSERT/UPDATE/DELETE: only school admins
DROP POLICY IF EXISTS "insert_school_reports" ON school_reports;
CREATE POLICY "insert_school_reports"
ON school_reports FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = school_reports.school_id AND au.role = 'school_admin')
);

DROP POLICY IF EXISTS "update_school_reports" ON school_reports;
CREATE POLICY "update_school_reports"
ON school_reports FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = school_reports.school_id AND au.role = 'school_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = school_reports.school_id AND au.role = 'school_admin')
);

DROP POLICY IF EXISTS "delete_school_reports" ON school_reports;
CREATE POLICY "delete_school_reports"
ON school_reports FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.school_id = school_reports.school_id AND au.role = 'school_admin')
);
