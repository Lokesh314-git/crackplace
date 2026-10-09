-- ==============================================================================
-- CrackPlace AI – Question Bank Manager: Migration 003
-- Security: Row Level Security (RLS) & Policies
-- ==============================================================================

-- 1. Enable RLS on tables
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- 2. Public Read Policies
-- Allows anonymous and authenticated students/clients to read questions & subjects
DROP POLICY IF EXISTS "Public can view active subjects" ON public.subjects;
CREATE POLICY "Public can view active subjects"
ON public.subjects
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Public can view questions" ON public.questions;
CREATE POLICY "Public can view questions"
ON public.questions
FOR SELECT
USING (true);

-- 3. Admin Full Access Policies
-- Authenticated admins can perform INSERT, UPDATE, DELETE on questions and subjects.
-- In Supabase, this allows authenticated users by default (or users with role 'admin' / matching admin email).

DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
CREATE POLICY "Admins can manage subjects"
ON public.subjects
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also permit anon key with service/custom access if configured in development
DROP POLICY IF EXISTS "Anon admin development access questions" ON public.questions;
CREATE POLICY "Anon admin development access questions"
ON public.questions
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon admin development access subjects" ON public.subjects;
CREATE POLICY "Anon admin development access subjects"
ON public.subjects
FOR ALL
TO anon
USING (true)
WITH CHECK (true);
