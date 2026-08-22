-- Make created_by nullable so invitations can be created without it
ALTER TABLE public.invitations ALTER COLUMN created_by DROP NOT NULL;