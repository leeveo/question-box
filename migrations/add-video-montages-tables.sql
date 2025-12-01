-- ============================================
-- Migration: Ajouter les tables de montage vidéo
-- Date: 2025-11-29
-- Description: Tables pour gérer les montages vidéo automatiques
-- ============================================

-- Table video_montages (montages finaux)
CREATE TABLE IF NOT EXISTS video_montages (
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
CREATE TABLE IF NOT EXISTS video_montage_clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  montage_id UUID REFERENCES video_montages(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  clip_order INTEGER NOT NULL,
  start_time FLOAT NOT NULL DEFAULT 0,
  end_time FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour montages
CREATE INDEX IF NOT EXISTS idx_video_montages_project_id ON video_montages(project_id);
CREATE INDEX IF NOT EXISTS idx_video_montages_user_id ON video_montages(user_id);
CREATE INDEX IF NOT EXISTS idx_video_montage_clips_montage_id ON video_montage_clips(montage_id);

-- Trigger pour updated_at
CREATE TRIGGER update_video_montages_updated_at BEFORE UPDATE ON video_montages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS
ALTER TABLE video_montages ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_montage_clips ENABLE ROW LEVEL SECURITY;

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
