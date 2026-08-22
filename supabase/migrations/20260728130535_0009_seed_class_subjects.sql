/*
# Seed class_subjects and fix exam_sessions created_by

## Changes
1. Seed class_subjects linking all 3 subjects to all 3 classes, with teacher_id = class_teacher_id
2. No schema change needed for exam_sessions — the FK references app_users(user_id)
   The frontend was sending profile.id (app_users.id) instead of profile.user_id (auth uid)
*/

-- Seed class_subjects: assign all subjects to all classes, teacher = class teacher
INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id)
SELECT 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb', c.id, s.id, c.class_teacher_id
FROM classes c
CROSS JOIN subjects s
WHERE c.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
  AND s.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
ON CONFLICT (class_id, subject_id) DO NOTHING;
