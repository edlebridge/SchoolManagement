/*
# Expand announcement audience targeting

1. Changes
   - Drop the existing `announcements_audience_check` constraint and replace it
     with an expanded version that supports granular recipient targeting.
   - New allowed audience values:
     - `school`      — entire school (kept for backwards compatibility)
     - `teachers`    — teachers only
     - `parents`     — parents only
     - `students`    — students only
     - `class`       — a specific class (uses class_id)
     - `class_all`   — a specific class with its students + parents + class teacher (uses class_id)
     - `staff`       — staff (kept for backwards compatibility)
     - `emergency`   — emergency (kept for backwards compatibility)
   - The `class_id` column already exists and is nullable; it is used when
     audience is `class` or `class_all`.

2. Security
   - No RLS policy changes. Existing policies remain intact.

3. Important notes
   - This is purely a constraint widening — no data is lost or transformed.
   - Existing rows (if any) with `school`, `class`, `staff`, or `emergency`
     remain valid under the new constraint.
*/

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_audience_check;

ALTER TABLE public.announcements ADD CONSTRAINT announcements_audience_check
  CHECK (audience = ANY (ARRAY[
    'school'::text,
    'teachers'::text,
    'parents'::text,
    'students'::text,
    'class'::text,
    'class_all'::text,
    'staff'::text,
    'emergency'::text
  ]));
