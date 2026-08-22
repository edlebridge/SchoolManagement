/*
# Seed class_subjects (schema-safe for fresh database)

## Changes
1. Seed class_subjects linking all subjects to all classes, with teacher_id = class_teacher_id.
   In a fresh database this is a no-op since no classes/subjects exist yet.
*/

-- Seed class_subjects: assign all subjects to all classes, teacher = class teacher
INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id)
SELECT 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb', c.id, s.id, c.class_teacher_id
FROM classes c
CROSS JOIN subjects s
WHERE c.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
  AND s.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
ON CONFLICT (class_id, subject_id) DO NOTHING;