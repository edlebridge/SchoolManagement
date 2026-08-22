/*
# Extend student_parents for multi-child relationships

1. Schema Changes
   - Add `is_primary_guardian` (boolean, default false) to student_parents.
   - Add `updated_at` (timestamptz, default now()) to student_parents.
   - Expand the relationship CHECK constraint to include: father, mother,
     guardian, aunt, uncle, other (previously only father/mother/guardian/other).
   - Add a trigger to auto-update `updated_at` on row changes.
   - Add an index on parent_user_id for faster "my children" lookups.

2. Demo Data
   - Link the existing parent (Mohamed Edle) to all three existing students
     (Abubakar, Ayman, Asma) so the multi-child parent experience can be
     tested immediately. Mohamed is set as father + primary guardian for all.

3. Security
   - No RLS policy changes — existing school-member policies remain valid.

4. Notes
   - The table was already many-to-many; this migration only adds the new
     fields, expands allowed relationship values, and seeds demo links.
*/

-- 1. Add new columns (idempotent)
ALTER TABLE student_parents
  ADD COLUMN IF NOT EXISTS is_primary_guardian boolean NOT NULL DEFAULT false;
ALTER TABLE student_parents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Expand the relationship CHECK constraint
ALTER TABLE student_parents DROP CONSTRAINT IF EXISTS student_parents_relationship_check;
ALTER TABLE student_parents
  ADD CONSTRAINT student_parents_relationship_check
  CHECK (relationship = ANY (ARRAY['father','mother','guardian','aunt','uncle','other']));

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_parents_touch ON student_parents;
CREATE TRIGGER trg_student_parents_touch
  BEFORE UPDATE ON student_parents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Index for "my children" lookups
CREATE INDEX IF NOT EXISTS idx_student_parents_parent ON student_parents(parent_user_id);

-- 5. Demo data — link Mohamed Edle to all three students as father/primary
INSERT INTO student_parents (school_id, student_id, parent_user_id, relationship, is_primary_guardian)
SELECT 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb', s.id, 'e1016dda-34a5-4973-9b9a-6f2ac243812b', 'father', true
FROM students s
WHERE s.school_id = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb'
ON CONFLICT (student_id, parent_user_id) DO UPDATE
  SET relationship = EXCLUDED.relationship,
      is_primary_guardian = EXCLUDED.is_primary_guardian;
