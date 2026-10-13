-- ==============================================================================
-- CrackPlace AI – Question Bank Manager: Migration 005
-- Topic & Subtopic Aggregation RPC Functions
-- ==============================================================================

-- 1. High-speed subject topic statistics RPC
-- Aggregates question counts across all records for a subject in milliseconds
CREATE OR REPLACE FUNCTION public.get_subject_topic_stats(p_subject TEXT)
RETURNS TABLE (name TEXT, question_count BIGINT)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COALESCE(NULLIF(topic, ''), NULLIF(subtopic, ''), 'General') AS name,
        COUNT(*)::BIGINT AS question_count
    FROM public.questions
    WHERE subject = p_subject
    GROUP BY COALESCE(NULLIF(topic, ''), NULLIF(subtopic, ''), 'General')
    ORDER BY name ASC;
$$;

-- 2. High-speed subtopic breakdown RPC for a specific topic
CREATE OR REPLACE FUNCTION public.get_subject_subtopic_stats(
    p_subject TEXT,
    p_topic TEXT DEFAULT NULL
)
RETURNS TABLE (topic TEXT, subtopic TEXT, question_count BIGINT)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COALESCE(NULLIF(questions.topic, ''), 'General') AS topic,
        COALESCE(NULLIF(questions.subtopic, ''), 'General') AS subtopic,
        COUNT(*)::BIGINT AS question_count
    FROM public.questions
    WHERE subject = p_subject
      AND (p_topic IS NULL OR questions.topic = p_topic)
    GROUP BY 
        COALESCE(NULLIF(questions.topic, ''), 'General'),
        COALESCE(NULLIF(questions.subtopic, ''), 'General')
    ORDER BY topic ASC, subtopic ASC;
$$;
