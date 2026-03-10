-- NeuroSync AI — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)
-- Safe to run on an existing database — only adds what is missing.

-- ── Add missing columns to sessions ──────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS login_id        TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS questions       JSONB NOT NULL DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS job_description TEXT  NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sessions_opening  ON sessions(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_sessions_login_id ON sessions(login_id);

-- ── Add missing columns to question_responses ─────────────────────────────────
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS transcript_flagged  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS technical_score     FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS communication_score FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS behavioral_score    FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS engagement_score    FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS authenticity_score  FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS video_file_id       TEXT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS audio_file_id       TEXT;

-- sentiment column: migrate TEXT → JSONB if it exists as TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='question_responses' AND column_name='sentiment' AND data_type='text'
  ) THEN
    ALTER TABLE question_responses ALTER COLUMN sentiment TYPE JSONB USING sentiment::jsonb;
  END IF;
END $$;

ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS sentiment JSONB NOT NULL DEFAULT '{}';

-- ── Add missing column to video_signals ───────────────────────────────────────
ALTER TABLE video_signals ADD COLUMN IF NOT EXISTS hr_bpm FLOAT;

-- ── Create candidate_credentials if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_credentials (
    login_id        TEXT        PRIMARY KEY,
    hashed_password TEXT        NOT NULL,
    session_id      TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    used            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Create error_logs if missing ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
    id            BIGSERIAL   PRIMARY KEY,
    session_id    TEXT,
    service       TEXT        NOT NULL,
    error_message TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_session ON error_logs(session_id);

-- ── Fix ocean_reports: success_prediction TEXT not FLOAT ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ocean_reports' AND column_name='success_prediction' AND data_type='double precision'
  ) THEN
    ALTER TABLE ocean_reports ALTER COLUMN success_prediction TYPE TEXT USING
      CASE WHEN success_prediction >= 0.7 THEN 'High'
           WHEN success_prediction >= 0.4 THEN 'Medium'
           ELSE 'Low' END;
  END IF;
END $$;

ALTER TABLE ocean_reports ADD COLUMN IF NOT EXISTS role_recommendation TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocean_session ON ocean_reports(session_id);
