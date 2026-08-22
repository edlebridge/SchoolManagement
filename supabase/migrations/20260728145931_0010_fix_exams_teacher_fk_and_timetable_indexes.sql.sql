/*
# Fix exams.teacher_id FK + add timetable support indexes

## 1. Bug fix: exams.teacher_id foreign key
- The `exams.teacher_id` column was defined as `REFERENCES app_users(user_id)`,
  but `class_subjects.teacher_id` stores `app_users.id` (the primary key).
- The auto-generate feature copies `class_subjects.teacher_id` into
  `exams.teacher_id`, causing a foreign key violation because the value is
  an `app_users.id`, not an `app_users.user_id`.
- Fix: drop the old FK and recreate it referencing `app_users(id)`, matching
  the convention used by `class_subjects.teacher_id`.
- This is non-destructive: the column type (uuid) is unchanged, only the
  referenced column changes. Existing NULL values remain valid; existing
  non-null values that pointed at `user_id` are migrated to the
  corresponding `app_users.id` first so no rows are orphaned.

## 2. Timetable support
- Add a composite index on (exam_session_id, class_id, exam_date) so the
  per-class timetable grid loads efficiently.
- Add a partial unique index to prevent duplicate exams for the same
  class + subject + date within a session (one exam per subject per day
  per class — multiple subjects per day are still allowed).
- Add a partial exclusion-style guard via unique constraint on
  (exam_session_id, class_id, exam_date, start_time) to prevent two exams
  for the same class starting at the same time on the same day.

## 3. Notes
- No columns added, removed, or renamed — data-safe.
- RLS unchanged.
*/

-- ── 1. Migrate existing teacher_id values from user_id → app_users.id ──
-- Only touches non-null rows; safe no-op if already using app_users.id.
UPDATE exams e
SET teacher_id = au.id
FROM app_users au
WHERE e.teacher_id IS NOT NULL
  AND e.teacher_id = au.user_id
  AND e.teacher_id <> au.id;

-- Clear any teacher_id values that no longer reference a valid app_users.id
-- (prevents the new FK from failing on orphaned rows).
UPDATE exams
SET teacher_id = NULL
WHERE teacher_id IS NOT NULL
  AND teacher_id NOT IN (SELECT id FROM app_users);

-- ── 2. Recreate the FK on app_users(id) ──
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_teacher_id_fkey;
ALTER TABLE exams ADD CONSTRAINT exams_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES app_users(id) ON DELETE SET NULL;

-- ── 3. Timetable indexes ──
CREATE INDEX IF NOT EXISTS idx_exams_session_class_date
  ON exams(exam_session_id, class_id, exam_date);

-- Prevent two exams for the same class on the same date with the same start time.
DROP INDEX IF EXISTS idx_exams_session_class_date_start_unique;
CREATE UNIQUE INDEX idx_exams_session_class_date_start_unique
  ON exams(exam_session_id, class_id, exam_date, start_time)
  WHERE exam_session_id IS NOT NULL
    AND class_id IS NOT NULL
    AND exam_date IS NOT NULL
    AND start_time IS NOT NULL;
