-- Create a SECURITY DEFINER function that returns all students linked to the calling parent.
-- This bypasses any client-side join bugs — the parent dashboard can call this directly.
CREATE OR REPLACE FUNCTION public.get_my_children()
RETURNS TABLE (
  id uuid,
  full_name text,
  school_id uuid,
  class_id uuid,
  admission_number text,
  enrollment_status text,
  gender text,
  date_of_birth date,
  phone_number text,
  relationship text,
  is_primary_guardian boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.id,
    s.full_name,
    s.school_id,
    s.class_id,
    s.admission_number,
    s.enrollment_status,
    s.gender,
    s.date_of_birth,
    s.phone_number,
    sp.relationship,
    sp.is_primary_guardian
  FROM public.student_parents sp
  JOIN public.students s ON s.id = sp.student_id
  WHERE sp.parent_user_id = auth.uid()
    AND s.enrollment_status != 'deleted';
$$;

-- Grant execute to authenticated users (the function checks auth.uid internally)
GRANT EXECUTE ON FUNCTION public.get_my_children() TO authenticated;