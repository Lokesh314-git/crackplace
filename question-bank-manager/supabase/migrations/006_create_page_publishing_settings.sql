-- 006_create_page_publishing_settings.sql
-- Schema migration for Admin-Controlled Page Publishing & Coming Soon System

CREATE TABLE IF NOT EXISTS page_publishing_settings (
  page_key VARCHAR(50) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'coming_soon',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Enable Row Level Security (RLS)
ALTER TABLE page_publishing_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to status (anon and authenticated users can view publishing status)
DROP POLICY IF EXISTS "Allow public read access to page publishing status" ON page_publishing_settings;
CREATE POLICY "Allow public read access to page publishing status"
  ON page_publishing_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow backend service role full access
DROP POLICY IF EXISTS "Allow service role full access to page publishing status" ON page_publishing_settings;
CREATE POLICY "Allow service role full access to page publishing status"
  ON page_publishing_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed default initial records: both Study Notes and Coding Workspace default to 'coming_soon'
INSERT INTO page_publishing_settings (page_key, status, updated_at, updated_by)
VALUES 
  ('study_notes', 'coming_soon', NOW(), 'system_init'),
  ('coding_workspace', 'coming_soon', NOW(), 'system_init')
ON CONFLICT (page_key) DO NOTHING;
