-- Create a view that joins student_parents with students and app_users
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