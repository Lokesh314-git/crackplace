-- ==============================================================================
-- CrackPlace AI – Question Bank Manager: Migration 002
-- Table: subjects
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    code_prefix TEXT NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for subjects updated_at
DROP TRIGGER IF EXISTS set_subjects_updated_at ON public.subjects;
CREATE TRIGGER set_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed Default 8 Standard Placement Subjects
INSERT INTO public.subjects (slug, name, code_prefix, description, display_order)
VALUES
    ('quantitative_aptitude', 'Quantitative Aptitude', 'QA', 'Arithmetic, algebra, geometry, probability, and data interpretation for campus recruitment.', 1),
    ('dsa', 'Data Structures & Algorithms', 'DSA', 'Arrays, linked lists, trees, graphs, sorting, searching, and dynamic programming.', 2),
    ('dbms', 'DBMS', 'DBMS', 'Relational database concepts, SQL queries, normalization, transactions, and indexing.', 3),
    ('operating_system', 'Operating Systems', 'OS', 'Process management, multithreading, memory virtualization, deadlocks, and system calls.', 4),
    ('computer_network', 'Computer Networks', 'CN', 'OSI model, TCP/IP, IP subnetting, routing protocols, DNS, HTTP, and network security.', 5),
    ('logical_reasoning', 'Logical Reasoning & Puzzles', 'LR', 'Deductive reasoning, analytical puzzles, coding-decoding, blood relations, and seating arrangement.', 6),
    ('verbal_ability', 'Verbal Ability & English', 'VA', 'Reading comprehension, sentence correction, grammar rules, vocabulary, and paragraph completion.', 7),
    ('hr_behavioral', 'HR & Behavioral Interview', 'HR', 'STAR methodology questions, leadership situations, conflict resolution, and career aspirations.', 8)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.subjects IS 'Dynamic Placement Subjects Catalog';
