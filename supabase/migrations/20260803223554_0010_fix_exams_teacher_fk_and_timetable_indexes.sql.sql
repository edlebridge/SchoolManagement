/*
# Fix exams.teacher_id FK + add timetable support indexes

1. Bug fix: exams.teacher_id foreign key — recreate referencing app_users(id)
2. Timetable support: composite index + partial unique index
*/

UPDATE exams e
SET teacher_id = au.id
FROM app_users au
WHERE e.teacher_id IS NOT NULL
  AND e.teacher_id = au.user_id
  AND e.teacher_id <> au.id;

UPDATE exams
SET teacher_id = NULL
WHERE teacher_id IS NOT NULL
  AND teacher_id NOT IN (SELECT id FROM app_users);

ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_teacher_id_fkey;
ALTER TABLE exams ADD CONSTRAINT exams_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_session_class_date
  ON exams(exam_session_id, class_id, exam_date);

DROP INDEX IF EXISTS idx_exams_session_class_date_start_unique;
CREATE UNIQUE INDEX idx_exams_session_class_date_start_unique
  ON exams(exam_session_id, class_id, exam_date, start_time)
  WHERE exam_session_id IS NOT NULL
    AND class_id IS NOT NULL
    AND exam_date IS NOT NULL
    AND start_time IS NOT NULL;