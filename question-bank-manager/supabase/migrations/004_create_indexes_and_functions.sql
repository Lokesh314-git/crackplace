-- ==============================================================================
-- CrackPlace AI – Question Bank Manager: Migration 004
-- Performance: Indexes & Server-Side RPC Functions
-- ==============================================================================

-- 1. Optimized B-Tree Indexes for high-speed queries on 100,000+ questions
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON public.questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_questions_question_type ON public.questions(question_type);
CREATE INDEX IF NOT EXISTS idx_questions_question_id ON public.questions(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_subject_difficulty ON public.questions(subject, difficulty);

-- 2. Server-Authoritative Random Question Picker RPC
-- Allows the CrackPlace frontend/backend to fetch N random questions efficiently
-- without downloading the whole table or leaking answers!
CREATE OR REPLACE FUNCTION public.get_random_questions(
    p_subject TEXT DEFAULT NULL,
    p_difficulty TEXT DEFAULT NULL,
    p_topic TEXT DEFAULT NULL,
    p_limit INT DEFAULT 10
)
RETURNS SETOF public.questions
LANGUAGE sql
STABLE
AS $$
    SELECT *
    FROM public.questions
    WHERE (p_subject IS NULL OR subject = p_subject)
      AND (p_difficulty IS NULL OR difficulty = p_difficulty)
      AND (p_topic IS NULL OR topic = p_topic)
    ORDER BY random()
    LIMIT p_limit;
$$;

-- 3. High-Speed Subject Statistics RPC
-- Provides real-time dashboard analytics without heavy client-side aggregation
CREATE OR REPLACE FUNCTION public.get_question_bank_statistics()
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total_questions BIGINT;
    v_total_subjects BIGINT;
    v_by_subject JSON;
    v_by_difficulty JSON;
BEGIN
    SELECT count(*) INTO v_total_questions FROM public.questions;
    SELECT count(*) INTO v_total_subjects FROM public.subjects WHERE is_active = true;

    SELECT json_object_agg(subject, count) INTO v_by_subject
    FROM (
        SELECT subject, count(*) as count
        FROM public.questions
        GROUP BY subject
    ) s;

    SELECT json_object_agg(difficulty, count) INTO v_by_difficulty
    FROM (
        SELECT difficulty, count(*) as count
        FROM public.questions
        GROUP BY difficulty
    ) d;

    RETURN json_build_object(
        'total_questions', COALESCE(v_total_questions, 0),
        'total_subjects', COALESCE(v_total_subjects, 0),
        'by_subject', COALESCE(v_by_subject, '{}'::json),
        'by_difficulty', COALESCE(v_by_difficulty, '{}'::json)
    );
END;
$$;
