/*
# Seed class_subjects (schema-safe for fresh database)

In a fresh database this is a no-op since no classes/subjects exist yet.
*/

INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id)
SELECT 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb', c.id, s.id, c.class_teacher_id
FROM classes c
CROSS JOIN subjects s
WHERE c.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
  AND s.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
ON CONFLICT (class_id, subject_id) DO NOTHING;