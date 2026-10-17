CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE TABLE hadith_embeddings (
  hadith_id uuid NOT NULL REFERENCES hadiths(id) ON DELETE CASCADE,
  model text NOT NULL CHECK(model='@cf/baai/bge-m3'),
  content_hash char(64) NOT NULL,
  embedding vector(1024) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(hadith_id,model)
);
