-- NeuroSync AI Interviewer — Supabase Schema v2
-- Run this in the Supabase SQL editor.
-- Safe to re-run: all statements use IF NOT EXISTS / upsert semantics.

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    session_id     TEXT        PRIMARY KEY,
    candidate_name TEXT        NOT NULL,
    job_opening_id TEXT        NOT NULL,
    interviewer_id TEXT        NOT NULL,
    login_id       TEXT        UNIQUE,                 -- NSC-XXXXXX shown to recruiter
    questions      JSONB       NOT NULL DEFAULT '[]',  -- full InterviewScript questions
    job_description TEXT       NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_opening  ON sessions(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_sessions_login_id ON sessions(login_id);

-- ── Candidate one-time credentials ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_credentials (
    login_id        TEXT        PRIMARY KEY,           -- NSC-XXXXXX
    hashed_password TEXT        NOT NULL,
    session_id      TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    used            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Question Responses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_responses (
    id                   BIGSERIAL   PRIMARY KEY,
    session_id           TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    question_id          TEXT        NOT NULL,
    question_text        TEXT        NOT NULL,
    ideal_answer         TEXT        NOT NULL,
    transcript           TEXT        NOT NULL DEFAULT '',
    transcript_flagged   BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE when Whisper failed
    semantic_score       FLOAT       NOT NULL DEFAULT 0,
    sentiment            JSONB       NOT NULL DEFAULT '{}',   -- {compound,pos,neg,neu}
    combined_score       FLOAT       NOT NULL DEFAULT 0,
    technical_score      FLOAT,
    communication_score  FLOAT,
    behavioral_score     FLOAT,
    engagement_score     FLOAT,
    authenticity_score   FLOAT,
    video_file_id        TEXT,
    audio_file_id        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_session ON question_responses(session_id);

-- ── Video Signals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_signals (
    id                     BIGSERIAL   PRIMARY KEY,
    session_id             TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    question_id            TEXT        NOT NULL,
    gaze_zone_distribution JSONB       NOT NULL DEFAULT '{}',
    cheat_flags            JSONB       NOT NULL DEFAULT '{}',
    emotion_distribution   JSONB       NOT NULL DEFAULT '{}',
    avg_hrv_rmssd          FLOAT       NOT NULL DEFAULT 0,
    hr_bpm                 FLOAT,
    stress_spike_detected  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_session ON video_signals(session_id);

-- ── OCEAN Reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ocean_reports (
    id                  BIGSERIAL   PRIMARY KEY,
    session_id          TEXT        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    openness            FLOAT       NOT NULL,
    conscientiousness   FLOAT       NOT NULL,
    extraversion        FLOAT       NOT NULL,
    agreeableness       FLOAT       NOT NULL,
    neuroticism         FLOAT       NOT NULL,
    job_fit_score       FLOAT       NOT NULL,
    success_prediction  TEXT        NOT NULL,           -- "High" | "Medium" | "Low"
    role_recommendation TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocean_session ON ocean_reports(session_id);

-- ── Error Logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
    id            BIGSERIAL   PRIMARY KEY,
    session_id    TEXT,                                -- nullable for global errors
    service       TEXT        NOT NULL,               -- e.g. "DriveUpload", "Whisper"
    error_message TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_session ON error_logs(session_id);
