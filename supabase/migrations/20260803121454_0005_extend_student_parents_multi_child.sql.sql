/*
# Extend student_parents for multi-child relationships (schema only)

1. Schema Changes
   - Add `is_primary_guardian` (boolean, default false) to student_parents.
   - Add `updated_at` (timestamptz, default now()) to student_parents.
   - Expand the relationship CHECK constraint to include: father, mother,
     guardian, aunt, uncle, other.
   - Add a trigger to auto-update `updated_at` on row changes.
   - Add an index on parent_user_id for faster "my children" lookups.

2. Security
   - No RLS policy changes — existing school-member policies remain valid.

3. Notes
   - Demo data seed from original migration is omitted because the referenced
     parent user does not exist in a fresh database. The schema changes are
     what matter — demo links can be created through the app UI.
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