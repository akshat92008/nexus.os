CREATE TABLE IF NOT EXISTS nexus_folders ( 
  id         TEXT        PRIMARY KEY, 
  name       TEXT        NOT NULL, 
  path       TEXT        NOT NULL, 
  parent_id  TEXT        REFERENCES nexus_folders(id) ON DELETE CASCADE, 
  owner_id   TEXT        NOT NULL, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now() 
); 
ALTER TABLE nexus_folders ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "owner_only" ON nexus_folders USING (owner_id = auth.uid()::text); 

CREATE TABLE IF NOT EXISTS nexus_files ( 
  id           TEXT        PRIMARY KEY, 
  name         TEXT        NOT NULL, 
  extension    TEXT, 
  size         BIGINT      NOT NULL DEFAULT 0, 
  mime_type    TEXT, 
  path         TEXT        NOT NULL, 
  parent_id    TEXT        REFERENCES nexus_folders(id) ON DELETE CASCADE, 
  owner_id     TEXT        NOT NULL, 
  storage_path TEXT, 
  metadata     JSONB       NOT NULL DEFAULT '{}', 
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(), 
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now() 
); 
ALTER TABLE nexus_files ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "owner_only" ON nexus_files USING (owner_id = auth.uid()::text); 
