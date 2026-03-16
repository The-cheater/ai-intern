-- NeuroSync AI — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)
-- Safe to run on an existing database — only adds what is missing.

-- ── Add missing columns to sessions ──────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS login_id        TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS questions       JSONB NOT NULL DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS job_description TEXT  NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sessions_opening  ON sessions(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_sessions_login_id ON sessions(login_id);

-- Drop UNIQUE constraint on sessions.login_id (login_id is shared per opening)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sessions' AND constraint_type = 'UNIQUE'
  ) THEN
    -- Drop the common default constraint name if present
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name='sessions' AND constraint_name='sessions_login_id_key'
    ) THEN
      ALTER TABLE sessions DROP CONSTRAINT sessions_login_id_key;
    END IF;
  END IF;
END $$;

-- ── Add missing columns to question_responses ─────────────────────────────────
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS transcript_flagged  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS technical_score     FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS communication_score FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS behavioral_score    FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS engagement_score    FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS authenticity_score  FLOAT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS video_file_id       TEXT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS audio_file_id       TEXT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS video_url           TEXT;
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS audio_url           TEXT;

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
ALTER TABLE video_signals ADD COLUMN IF NOT EXISTS gaze_metrics JSONB NOT NULL DEFAULT '{}';

-- ── Create candidate_credentials if missing ───────────────────────────────────
-- v2: multiple credentials per login_id (one per candidate/session)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'candidate_credentials'
  ) THEN
    CREATE TABLE candidate_credentials (
      id              BIGSERIAL   PRIMARY KEY,
      login_id         TEXT        NOT NULL,
      hashed_password  TEXT        NOT NULL,
      session_id       TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      used             BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_session ON candidate_credentials(session_id);
    CREATE INDEX IF NOT EXISTS idx_cc_login ON candidate_credentials(login_id);
  ELSE
    -- If old schema exists (login_id PRIMARY KEY), migrate to v2.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='candidate_credentials' AND column_name='login_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name='candidate_credentials' AND constraint_type='PRIMARY KEY'
    ) THEN
      -- Create v2 if missing
      CREATE TABLE IF NOT EXISTS candidate_credentials_v2 (
        id              BIGSERIAL   PRIMARY KEY,
        login_id         TEXT        NOT NULL,
        hashed_password  TEXT        NOT NULL,
        session_id       TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
        used             BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO candidate_credentials_v2 (login_id, hashed_password, session_id, used, created_at)
      SELECT login_id, hashed_password, session_id, used, created_at
      FROM candidate_credentials
      ON CONFLICT DO NOTHING;

      DROP TABLE candidate_credentials;
      ALTER TABLE candidate_credentials_v2 RENAME TO candidate_credentials;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_session ON candidate_credentials(session_id);
      CREATE INDEX IF NOT EXISTS idx_cc_login ON candidate_credentials(login_id);
    END IF;
  END IF;
END $$;

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

-- ── Unique constraint for async-upsert on question_responses ──────────────────
-- Needed so background transcription can upsert rather than double-insert.
ALTER TABLE question_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_session_question
    ON question_responses(session_id, question_id);
