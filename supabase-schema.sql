-- Création des tables pour le SaaS multi-tenant

-- Table profiles (extension de auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  background_image_url TEXT,
  response_duration INTEGER DEFAULT 8, -- Durée en secondes pour répondre à chaque question (par défaut 8)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par slug
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Table questions
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour tri par ordre
CREATE INDEX idx_questions_project_order ON questions(project_id, "order");

-- Table videos
CREATE TABLE videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  s3_url TEXT NOT NULL,
  participant_name TEXT,
  duration INTEGER,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche par projet
CREATE INDEX idx_videos_project_id ON videos(project_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- Table video_montages (montages finaux)
CREATE TABLE video_montages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  file_size BIGINT,
  duration INTEGER,
  video_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table video_montage_clips (détails des clips dans le montage)
CREATE TABLE video_montage_clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  montage_id UUID REFERENCES video_montages(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  clip_order INTEGER NOT NULL,
  start_time FLOAT NOT NULL DEFAULT 0,
  end_time FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour montages
CREATE INDEX idx_video_montages_project_id ON video_montages(project_id);
CREATE INDEX idx_video_montages_user_id ON video_montages(user_id);
CREATE INDEX idx_video_montage_clips_montage_id ON video_montage_clips(montage_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_montages_updated_at BEFORE UPDATE ON video_montages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLITIQUES RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_montages ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_montage_clips ENABLE ROW LEVEL SECURITY;

-- Politiques pour profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Politiques pour projects
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

-- Politique publique pour accès via slug (page d'enregistrement)
CREATE POLICY "Public can view active projects by slug"
  ON projects FOR SELECT
  USING (is_active = true);

-- Politiques pour questions
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

-- Politique publique pour lire les questions des projets actifs
CREATE POLICY "Public can view questions of active projects"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = questions.project_id
      AND projects.is_active = true
    )
  );

-- Politiques pour videos
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

-- Politique publique pour créer des vidéos (page d'enregistrement)
CREATE POLICY "Public can create videos for active projects"
  ON videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = videos.project_id
      AND projects.is_active = true
    )
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

-- Politiques pour video_montages
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

-- Politiques pour video_montage_clips
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
