-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_montages ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_montage_clips ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a project is active (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION check_project_active(project_id_input UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_id_input AND is_active = true
  );
END;
$$;

-- Helper function to get public project details by slug
CREATE OR REPLACE FUNCTION get_public_project(slug_text TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  background_image_url TEXT,
  response_duration INTEGER,
  is_active BOOLEAN,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.slug, p.background_image_url, p.response_duration, p.is_active, p.user_id
  FROM projects p
  WHERE p.slug = slug_text AND p.is_active = true;
END;
$$;

-- Helper function to get public questions for a project
CREATE OR REPLACE FUNCTION get_public_questions(project_id_input UUID)
RETURNS SETOF questions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM questions q
  JOIN projects p ON p.id = q.project_id
  WHERE q.project_id = project_id_input AND p.is_active = true
  ORDER BY q."order" ASC;
END;
$$;

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Public can view active projects by slug" ON projects;

-- Create strict policies
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- QUESTIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view questions of own projects" ON questions;
DROP POLICY IF EXISTS "Users can create questions for own projects" ON questions;
DROP POLICY IF EXISTS "Users can update questions of own projects" ON questions;
DROP POLICY IF EXISTS "Users can delete questions of own projects" ON questions;
DROP POLICY IF EXISTS "Public can view questions of active projects" ON questions;

CREATE POLICY "Users can view questions of own projects"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = questions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create questions for own projects"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = questions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update questions of own projects"
  ON questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = questions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete questions of own projects"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = questions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- VIDEOS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view videos of own projects" ON videos;
DROP POLICY IF EXISTS "Users can create videos for own projects" ON videos;
DROP POLICY IF EXISTS "Public can create videos for active projects" ON videos;
DROP POLICY IF EXISTS "Users can delete videos of own projects" ON videos;

CREATE POLICY "Users can view videos of own projects"
  ON videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = videos.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create videos for own projects"
  ON videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = videos.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Public can create videos ONLY if project is active (using Security Definer function)
CREATE POLICY "Public can create videos for active projects"
  ON videos FOR INSERT
  WITH CHECK (
    check_project_active(project_id)
  );

CREATE POLICY "Users can delete videos of own projects"
  ON videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = videos.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- VIDEO MONTAGES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own montages" ON video_montages;
DROP POLICY IF EXISTS "Users can create montages" ON video_montages;
DROP POLICY IF EXISTS "Users can update own montages" ON video_montages;
DROP POLICY IF EXISTS "Users can delete own montages" ON video_montages;

CREATE POLICY "Users can view own montages"
  ON video_montages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create montages"
  ON video_montages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own montages"
  ON video_montages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own montages"
  ON video_montages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- VIDEO MONTAGE CLIPS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view clips of own montages" ON video_montage_clips;
DROP POLICY IF EXISTS "Users can create clips for own montages" ON video_montage_clips;
DROP POLICY IF EXISTS "Users can delete clips of own montages" ON video_montage_clips;

CREATE POLICY "Users can view clips of own montages"
  ON video_montage_clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM video_montages
      WHERE video_montages.id = video_montage_clips.montage_id
      AND video_montages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create clips for own montages"
  ON video_montage_clips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM video_montages
      WHERE video_montages.id = video_montage_clips.montage_id
      AND video_montages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clips of own montages"
  ON video_montage_clips FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM video_montages
      WHERE video_montages.id = video_montage_clips.montage_id
      AND video_montages.user_id = auth.uid()
    )
  );
