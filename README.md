# VidyaAI — AI-Powered Interview Intelligence Platform

VidyaAI is a full-stack, multi-modal AI platform that automates the interview process from resume parsing through candidate evaluation. It combines speech recognition, computer vision, physiological signal analysis, and large language model scoring to produce a structured psychological and technical assessment of every candidate — delivered to recruiters through a live dashboard.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Structure](#4-repository-structure)
5. [Core Pipeline](#5-core-pipeline)
6. [Backend Services](#6-backend-services)
7. [API Reference](#7-api-reference)
8. [Database Schema](#8-database-schema)
9. [Frontend Application](#9-frontend-application)
10. [Media Storage](#10-media-storage)
11. [Environment Configuration](#11-environment-configuration)
12. [Setup and Installation](#12-setup-and-installation)
13. [Known Issues and Fixes](#13-known-issues-and-fixes)

---

## 1. System Overview

VidyaAI removes subjectivity from hiring by running every candidate through an identical, AI-scored interview. The platform operates across two user-facing interfaces:

**Recruiter Dashboard** — The interviewer creates a job opening, uploads a resume or job description, and receives a shareable candidate login link. After each interview, the dashboard shows a full Digital Candidate Twin: OCEAN personality scores, job-fit percentage, per-question transcripts, gaze analytics, physiological stress signals, and embedded video/audio playback.

**Candidate Portal** — A distraction-free, fullscreen interview environment. The candidate authenticates with a one-time credential, passes a 15-point gaze calibration, answers timed questions one by one with webcam and microphone recording, and sees a thank-you screen on completion. The candidate never sees scoring data.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router)  —  Recruiter Dashboard + Candidate    │
│  Portal (two fully separated UI flows)                          │
│  localhost:3000                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.11)  —  api/main.py                          │
│  localhost:8000                                                  │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  Parser    │  │ Question Gen │  │  Scoring + OCEAN      │   │
│  │ (Docling)  │  │ (Qwen2.5)    │  │  (SentenceTransformer │   │
│  └────────────┘  └──────────────┘  │   + VADER + LLM)      │   │
│                                    └───────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Video Analysis                                        │     │
│  │  ├── Calibration (MediaPipe affine transform)          │     │
│  │  ├── Gaze Zone Classifier (personalised thresholds)    │     │
│  │  ├── Cheating Detector (9-signal FFT + scan pattern)   │     │
│  │  ├── GazeFollower (post-session appearance model)      │     │
│  │  ├── Emotion Analyzer (DeepFace, 8-class)              │     │
│  │  └── rPPG / HRV (CHROM algorithm, OpenCV)              │     │
│  └────────────────────────────────────────────────────────┘     │
└───────┬──────────────────────────┬──────────────────────────────┘
        │                          │
        ▼                          ▼
┌───────────────┐        ┌──────────────────────┐
│   Supabase    │        │     Cloudinary        │
│  (PostgreSQL) │        │  (Video + Audio CDN)  │
│               │        │  candidates/          │
│  sessions     │        │  <login_id>/          │
│  credentials  │        │  sessions/<sid>/      │
│  responses    │        │  <lid>_<sid>_q<n>_    │
│  video_signals│        │  <audio|video>        │
│  ocean_reports│        └──────────────────────┘
│  error_logs   │
└───────────────┘
        ▲
        │
┌───────────────┐
│  Ollama       │
│  Qwen2.5:0.5b │
│  localhost:   │
│  11434        │
│  (fallback)   │
└───────────────┘
        +
┌───────────────┐
│  Gemini Flash │
│  (primary LLM)│
└───────────────┘
```

---

## 3. Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Framework | FastAPI 0.111 + Uvicorn | HTTP server, request routing, background tasks |
| Language Runtime | Python 3.11 | All backend services |
| Data Validation | Pydantic v2 | Request/response models, strict typing |
| PDF Parsing | IBM Docling 2.x | Structured resume extraction to Markdown |
| LLM (Primary) | Google Gemini Flash | Question generation, OCEAN role recommendation |
| LLM (Fallback) | Ollama + Qwen2.5:0.5b | Local inference when Gemini is unavailable |
| Speech-to-Text | OpenAI Whisper (small) | Audio transcription, serialised via threading.Lock |
| Semantic Scoring | sentence-transformers all-MiniLM-L6-v2 | Cosine similarity between transcript and ideal answer |
| Sentiment Scoring | VADER SentimentIntensityAnalyzer | Compound sentiment of candidate transcripts |
| Gaze Tracking | MediaPipe FaceMesh (browser) | Real-time iris landmark detection during interview |
| Post-Session Gaze | GazeFollower 1.0.2 | Appearance-based gaze model on recorded video |
| Face Landmark | MediaPipe (Python) | Calibration affine transform computation |
| Emotion Analysis | DeepFace | 8-class facial emotion classification per video chunk |
| Physiological Signals | CHROM rPPG (OpenCV + NumPy) | Heart rate and HRV RMSSD from webcam footage |
| Cheating Detection | Custom (NumPy + SciPy) | 9-signal FFT-based scan pattern + fixation analysis |
| Password Hashing | bcrypt 4.0.1 (direct) | Candidate credential hashing |
| HTTP Client | httpx | Internal service calls (finalize, download) |
| Environment | python-dotenv | .env loading |
| Testing | pytest + pytest-asyncio | Unit and integration tests |

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 (App Router) | Full-stack React, SSR, file-based routing |
| Language | TypeScript | Type-safe component development |
| Styling | Tailwind CSS | Utility-first responsive design |
| Animation | Framer Motion | Page transitions, progress banners, modals |
| Charts | Recharts | OCEAN radar, sentiment timeline, HRV area chart |
| Icons | Lucide React | UI iconography |
| Media Recording | MediaRecorder API (browser) | WebM audio and video capture |
| Gaze Tracking | MediaPipe FaceMesh (CDN, browser) | Live iris landmark extraction |
| HTTP Client | fetch (native) | All API calls to FastAPI backend |

### Infrastructure

| Service | Technology | Purpose |
|---------|------------|---------|
| Database | Supabase (PostgreSQL) | All structured data, JSONB for gaze/emotion/OCEAN |
| Media Storage | Cloudinary | Video and audio CDN, deterministic public_id naming |
| Local LLM | Ollama | Self-hosted Qwen2.5 model server |

---

## 4. Repository Structure

```
e:/ai-intern/
├── api/
│   └── main.py                         # FastAPI application — all endpoints
│
├── services/
│   ├── parser/
│   │   ├── models.py                   # ParsedResume, Experience, Project (Pydantic)
│   │   └── parser.py                   # parse_pdf() via Docling, parse_text() via regex
│   │
│   ├── question_gen/
│   │   ├── models.py                   # InterviewScript, Question, AnswerKey
│   │   ├── prompts.py                  # System prompt + build_user_prompt()
│   │   └── generator.py               # generate_questions() → Gemini / Ollama
│   │
│   ├── scoring/
│   │   ├── models.py                   # ResponseScore, SentimentScores, OceanReport
│   │   ├── response_scorer.py          # Whisper transcript → semantic + VADER scoring
│   │   ├── ocean_mapper.py             # OCEAN trait mapping + job-fit cosine similarity
│   │   └── llm_marker.py              # LLM-as-judge for qualitative scoring
│   │
│   ├── video_analysis/
│   │   ├── calibration/
│   │   │   └── calibration_runner.py  # 15-point affine transform calibration
│   │   ├── gaze/
│   │   │   ├── zone_classifier.py     # Personalised strategic/wandering/red zones
│   │   │   ├── cheating_detector.py   # 9-signal FFT + horizontal scan detection
│   │   │   └── gazefollower_runner.py # Post-session GazeFollower video processor
│   │   ├── emotion_analyzer.py        # DeepFace 8-class emotion extraction
│   │   └── rppg.py                    # CHROM rPPG → HRV RMSSD + HR BPM
│   │
│   └── database/
│       ├── supabase_client.py          # All Supabase read/write operations
│       ├── cloudinary_client.py        # Upload, delete, naming, prefix delete
│       └── models.py                   # Shared DB models
│
├── frontend/
│   └── src/app/
│       ├── portal/
│       │   ├── login/page.tsx          # Candidate one-time credential login
│       │   ├── permissions/page.tsx    # Camera + microphone permission gate
│       │   ├── calibration/page.tsx    # 15-point gaze calibration (MediaPipe)
│       │   ├── interview/page.tsx      # Fullscreen timed interview + recording
│       │   └── thank-you/page.tsx      # Completion screen, fires /process pipeline
│       │
│       └── dashboard/
│           ├── page.tsx                # Recruiter home — openings + create flow
│           ├── login/page.tsx          # Recruiter authentication
│           ├── openings/[id]/
│           │   ├── page.tsx            # Opening detail server wrapper
│           │   └── OpeningDetailClient.tsx  # Candidate table, process/delete/add
│           └── candidates/[id]/page.tsx    # Digital Candidate Twin profile
│
├── tests/
│   ├── conftest.py
│   ├── test_ocean_mapper.py
│   ├── test_parser.py
│   ├── test_question_gen.py
│   └── test_scorer.py
│
├── supabase_migration.sql              # Safe incremental migration (run in SQL Editor)
├── requirements.txt                    # Python dependencies
└── .env                                # Environment variables (never commit)
```

---

## 5. Core Pipeline

### Stage 1 — Pre-Interview Setup (Recruiter)

```
Recruiter uploads PDF  →  POST /parse/pdf  →  IBM Docling extracts Markdown
                or
Recruiter pastes JD    →  POST /parse/text →  regex extraction

                          ↓
                     POST /generate-questions
                     Gemini Flash (or Qwen2.5 fallback)
                     18-20 questions across 4 stages:
                       intro / technical / behavioral / situational
                     Each question includes ideal_answer
                          ↓
                     POST /session/create
                     Creates session in Supabase
                     Generates login_id (NSO-XXXXXX, shared per opening)
                     Generates unique password per candidate (8-char alphanumeric)
                     Stores bcrypt hash in candidate_credentials
                     Returns credentials to recruiter
```

### Stage 2 — Candidate Interview

```
Candidate logs in      →  POST /candidate/login  →  validates credential, marks used
                                                     returns session_id + questions
     ↓
Gaze Calibration       →  POST /calibration/start  → returns 15 dot positions
(browser MediaPipe         POST /calibration/submit → fits 3×2 affine transform
 iris landmarks)                                       computes baseline_gaze_variance
                                                       baseline_blink_rate
                                                       neurodiversity_adjustment (1.4× if high variance)
                                                       calibration_quality_score
                                                       saves JSON to Cloudinary
     ↓
Per-Question Recording
  Browser simultaneously:
    - Records audio as WebM via MediaRecorder API
    - Records video as WebM via getUserMedia
    - Captures iris landmark samples via MediaPipe FaceMesh (CDN)
    - Applies affine transform → classifies each frame into:
        strategic (upper-center, thinking)
        wandering  (high displacement vs baseline, natural)
        red        (y > 0.72 calibrated, notes reading)
        neutral    (default)

  On answer submission  →  POST /session/{id}/save-response
                           Uploads audio + video to Cloudinary (in-memory, no disk)
                           Naming: {login_id}_{session_id}_q{n}_{audio|video}
                           Folder: candidates/{login_id}/sessions/{session_id}/
                           Stores video_url + audio_url in question_responses

                        →  POST /video/analyze-chunk
                           Classifies gaze zones using calibrated thresholds
                           Detects cheating via fixation + horizontal scan patterns
                           Runs DeepFace on video frames → 8-class emotion distribution
                           Runs CHROM rPPG → avg_hrv_rmssd, hr_bpm, stress_spike_detected
                           Stores all signals in video_signals table
     ↓
Interview Complete      →  Thank-you page fires POST /session/{id}/process
                           Returns 202 immediately
                           Background daemon thread starts _bg_post_session
```

### Stage 3 — Post-Session Processing Pipeline

```
_bg_post_session (daemon thread):

  Step 1 — Transcription
    For each question with audio_url:
      Download .webm from Cloudinary  →  _download_to_tmp()
      Whisper.transcribe() (serialised via _whisper_lock)
      Update question_responses.transcript

  Step 2 — Scoring
    For each transcribed question:
      sentence-transformers cosine_similarity(transcript, ideal_answer)  → semantic_score
      VADER SentimentIntensityAnalyzer(transcript)                        → sentiment dict
      combined_score = (semantic_score × 0.6) + ((compound + 1) / 2 × 0.4) × 10
      Save full ResponseScore back to question_responses

  Step 3 — OCEAN Finalize
    POST http://localhost:8000/session/{id}/finalize
    Loads all ResponseScore objects from Supabase
    Maps per-question scores to Big-Five trait signals:
      Extraversion    ← intro question sentiment + engagement
      Conscientiousness ← logical question semantic score + structure
      Openness        ← situational question creative divergence + vocab richness
      Agreeableness   ← behavioral question cooperative keywords + teamwork similarity
      Neuroticism     ← HRV spikes + negative sentiment on pressure questions
    Computes job_fit_score via cosine_similarity(all_transcripts, job_description)
    Calls Qwen2.5 for role_recommendation (2-sentence summary)
    Saves OCEAN report to ocean_reports table
    success_prediction: High (job_fit > 70) / Medium (50-70) / Low (<50)

  Step 4 — GazeFollower Video Analysis
    For each question with video_url:
      Download .webm from Cloudinary
      Extract frames via OpenCV (every 3rd frame)
      GazeFollower.predict(frame) → normalised (x, y) gaze point
      Classify zones → zone_distribution
      _detect_robotic_reading() → reversal_rate + y_stdev → reading flag
      detect_cheating() with neurodiversity-adjusted thresholds
      Store all metrics in video_signals.gaze_metrics (JSONB)
```

### Stage 4 — Dashboard Reporting

```
GET /opening/{id}/candidates  →  lists all sessions with OCEAN summaries
GET /session/{id}/report      →  full joined record:
                                   sessions + question_responses + video_signals + ocean_reports
                                   video_url / audio_url → direct Cloudinary playback
DELETE /session/{id}          →  destroys Cloudinary assets + all Supabase rows
```

---

## 6. Backend Services

### `services/parser/`

**parser.py** — Wraps IBM Docling's `DocumentConverter` for PDF parsing. Falls back to regex-based extraction for plain text resumes. Outputs a `ParsedResume` Pydantic model containing name, contact, experience entries (title, company, date range, bullets), skills list, education, and raw Markdown.

### `services/question_gen/`

**generator.py** — Calls Gemini Flash (primary) or Ollama Qwen2.5 (fallback) with a structured system prompt. Generates 18-20 questions mapped directly to resume projects and job description requirements, distributed across `intro`, `technical`, `behavioral`, and `situational` stages. Every question includes an `ideal_answer` field (3-5 sentence gold-standard response) and an `answer_key` with `critical_keywords`, `ideal_sentiment`, and a 1-10 `rubric`.

### `services/scoring/`

**response_scorer.py** — Takes a candidate transcript and ideal answer. Computes:
- `semantic_score` — cosine similarity via `all-MiniLM-L6-v2` SentenceTransformer (keyword overlap fallback if tf-keras unavailable)
- `sentiment` — VADER `compound`, `pos`, `neg`, `neu` scores
- `combined_score` — weighted composite normalised to 0-10
- `engagement_flag` — True if word count < 30 or semantic_score < 0.25

**ocean_mapper.py** — Aggregates all `ResponseScore` objects into Big-Five trait scores (0-100) using deterministic rule mapping. Computes `job_fit_score` as cosine similarity between all concatenated transcripts and the job description. Calls Qwen2.5 for a `role_recommendation` narrative. Outputs a full `OceanReport` Pydantic model.

### `services/video_analysis/calibration/`

**calibration_runner.py** — Implements a 15-point screen calibration sequence. The browser sends averaged MediaPipe iris coordinates for each known screen position (corners, edge midpoints, center, inner quadrant points). `run_calibration()` fits a 3×2 affine transform via `numpy.linalg.lstsq`, computes per-candidate baseline gaze variance, blink rate, and a neurodiversity adjustment factor (1.4× scale on cheating thresholds if baseline variance > 0.06). Returns a `calibration_quality_score` (0-1 based on cluster tightness) — below 0.6 triggers a recalibration prompt.

### `services/video_analysis/gaze/`

**zone_classifier.py** — Loads the candidate's personal calibration JSON. Classifies each gaze point into:
- `strategic` — calibrated y <= 0.55, x within ±30% of center
- `wandering` — frame-to-frame displacement > 1.3× candidate baseline
- `red` — calibrated y > 0.72 (notes/phone)
- `neutral` — all other positions

**cheating_detector.py** — Applies the affine transform before all classification. Detects horizontal scanning via direction-reversal rate with threshold `baseline_variance × 0.4`. Reports `risk_level` (low / medium / high) with confidence scores and timestamps.

**gazefollower_runner.py** — Post-session video processor. Extracts frames with OpenCV, runs GazeFollower's appearance-based model (no per-user calibration needed at inference), aggregates zone distribution, runs `_detect_robotic_reading()` (reversal rate + Y-axis standard deviation), and re-runs cheating detection. Returns a structured `gaze_metrics` dict stored as JSONB.

### `services/video_analysis/emotion_analyzer.py`

Runs DeepFace on sampled video frames. Returns 8-class emotion distribution (`happy`, `sad`, `angry`, `fear`, `disgust`, `surprise`, `neutral`, `contempt`) as proportional floats summing to 1.0.

### `services/video_analysis/rppg.py`

Implements CHROM rPPG using OpenCV to extract the forehead region of interest. Computes a photoplethysmography signal from the G channel, applies bandpass filtering, and derives `avg_hrv_rmssd`, `hr_bpm`, and a `stress_spike_detected` boolean.

### `services/database/cloudinary_client.py`

- `upload_bytes()` — uploads raw bytes to Cloudinary with `resource_type="video"` (handles both WebM video and WebM audio). Deterministic `public_id` prevents duplicate uploads.
- `build_public_id()` — produces `{login_id}_{session_id}_q{n}_{kind}` naming convention.
- `build_session_folder()` — produces `candidates/{login_id}/sessions/{session_id}`.
- `destroy()` — single-asset deletion.
- `delete_by_prefix()` — bulk deletion for session cleanup and database reset.

### `services/database/supabase_client.py`

All Supabase operations via `supabase-py`. Key functions:
- `create_session()` / `get_session()` — session lifecycle management
- `create_candidate_credentials()` — one-time hashed password storage
- `save_question_response()` — upsert on `(session_id, question_id)` — safe for both initial placeholder and post-processing updates
- `save_video_signals()` / `update_video_gaze_metrics()` — split storage for real-time vs post-session gaze data
- `save_ocean_scores()` — upsert on `session_id`
- `delete_session()` — cascades Cloudinary delete then FK-ordered Supabase delete
- `truncate_all_tables()` — admin reset, returns row counts per table

---

## 7. API Reference

### Parse

| Method | Path | Description |
|--------|------|-------------|
| POST | `/parse/pdf` | Upload PDF resume → `ParsedResume` |
| POST | `/parse/text` | Submit plain-text resume → `ParsedResume` |
| POST | `/parse-and-generate` | PDF + JD → parse + 18-20 questions in one call |

### Questions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate-questions` | Generate interview questions with ideal answers |

### Session

| Method | Path | Description |
|--------|------|-------------|
| POST | `/session/create` | Create session + one-time candidate credentials |
| POST | `/candidate/login` | Validate credentials → return session_id + questions |
| POST | `/session/{id}/save-response` | Upload audio + video to Cloudinary |
| POST | `/session/{id}/process` | Fire background pipeline (202 immediate return) |
| POST | `/session/{id}/transcribe` | Download audio → Whisper → update transcripts |
| POST | `/session/{id}/process-video` | Download video → GazeFollower metrics |
| POST | `/session/{id}/finalize` | Aggregate responses → OCEAN scores → Supabase |
| GET  | `/session/{id}/status` | Live pipeline stage for polling |
| GET  | `/session/{id}/report` | Full joined candidate report |
| DELETE | `/session/{id}` | Delete candidate: Cloudinary assets + all Supabase rows |

### Video

| Method | Path | Description |
|--------|------|-------------|
| POST | `/video/analyze-chunk` | Gaze + emotion + rPPG → video_signals |

### Calibration

| Method | Path | Description |
|--------|------|-------------|
| POST | `/calibration/start` | Begin calibration session → 15 dot positions |
| POST | `/calibration/submit` | Fit affine transform → quality score |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | All sessions with OCEAN summaries |
| GET | `/opening/{id}/candidates` | All sessions for a job opening |
| DELETE | `/opening/{id}` | Delete all sessions for an opening |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| DELETE | `/admin/reset-database` | Wipe Cloudinary prefix + truncate all tables |

All error responses follow the structure:
```json
{ "error": "Human-readable message", "code": "SCREAMING_SNAKE_CODE" }
```

---

## 8. Database Schema

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| session_id | TEXT PK | UUID |
| candidate_name | TEXT | |
| job_opening_id | TEXT | Shared across candidates for same opening |
| interviewer_id | TEXT | |
| login_id | TEXT | Shared per opening (format: NSO-XXXXXX) |
| questions | JSONB | Full InterviewScript question array |
| job_description | TEXT | |
| created_at | TIMESTAMPTZ | Auto |

### `candidate_credentials`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| login_id | TEXT | Shared per opening |
| hashed_password | TEXT | bcrypt hash |
| session_id | TEXT FK → sessions | |
| used | BOOLEAN | Marked true after first login |
| created_at | TIMESTAMPTZ | |

### `question_responses`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| session_id | TEXT FK | |
| question_id | TEXT | |
| question_text | TEXT | |
| ideal_answer | TEXT | |
| transcript | TEXT | Filled by Whisper post-session |
| transcript_flagged | BOOLEAN | |
| semantic_score | FLOAT | all-MiniLM-L6-v2 cosine similarity |
| sentiment | JSONB | `{compound, pos, neg, neu}` |
| combined_score | FLOAT | 0-10 weighted composite |
| technical_score | FLOAT | |
| communication_score | FLOAT | |
| behavioral_score | FLOAT | |
| engagement_score | FLOAT | |
| authenticity_score | FLOAT | |
| video_file_id | TEXT | Cloudinary public_id |
| audio_file_id | TEXT | Cloudinary public_id |
| video_url | TEXT | Cloudinary secure_url |
| audio_url | TEXT | Cloudinary secure_url |
| UNIQUE | | `(session_id, question_id)` — enables safe upsert |

### `video_signals`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| session_id | TEXT FK | |
| question_id | TEXT | |
| gaze_zone_distribution | JSONB | Real-time zones from browser MediaPipe |
| cheat_flags | JSONB | risk_level, confidence, timestamps |
| emotion_distribution | JSONB | 8-class DeepFace percentages |
| avg_hrv_rmssd | FLOAT | rPPG-derived |
| hr_bpm | FLOAT | rPPG-derived |
| stress_spike_detected | BOOLEAN | |
| gaze_metrics | JSONB | GazeFollower post-session metrics |

### `ocean_reports`
| Column | Type | Notes |
|--------|------|-------|
| session_id | TEXT PK | |
| openness | FLOAT | 0-100 |
| conscientiousness | FLOAT | |
| extraversion | FLOAT | |
| agreeableness | FLOAT | |
| neuroticism | FLOAT | |
| job_fit_score | FLOAT | 0-100 |
| success_prediction | TEXT | High / Medium / Low |
| role_recommendation | TEXT | 2-sentence LLM narrative |

### `error_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| session_id | TEXT | Nullable |
| service | TEXT | e.g. AudioUpload, Transcribe, PostSessionGaze |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | |

---

## 9. Frontend Application

### Candidate Portal (`/portal/`)

**`login/page.tsx`** — Accepts `login_id` + password. POSTs to `/candidate/login`. On success stores `session_id` and `questions` in localStorage and routes to permissions.

**`permissions/page.tsx`** — Requests camera and microphone permissions. Visual status indicators (granted / denied). Enforces fullscreen via Fullscreen API. "Begin" button only enabled when both permissions are granted and fullscreen is active.

**`calibration/page.tsx`** — Full-screen dark overlay with a 15-point glowing dot sequence. Loads MediaPipe FaceMesh from CDN. Captures 30 iris landmark frames per dot at 66ms intervals. Filters noisy frames (face must be centred, stable). POSTs to `/calibration/start` then `/calibration/submit`. Shows quality score — recalibration prompt if below 0.6.

**`interview/page.tsx`** — Distraction-free fullscreen interview. Shows one question at a time with a circular countdown timer (amber at 30s, red at 10s). Records audio and video simultaneously via MediaRecorder. Collects MediaPipe gaze samples during each question. On answer: POSTs to `/session/{id}/save-response` (media upload) and `/video/analyze-chunk` (gaze + emotion + rPPG). 5-second interstitial between questions.

**`thank-you/page.tsx`** — Shows session reference ID. Fires `POST /session/{id}/process` once (guarded by `useRef` to prevent React StrictMode double-fire). Polls `/session/{id}/status` every 8 seconds until the backend pipeline completes. Never shows scoring data to the candidate.

### Recruiter Dashboard (`/dashboard/`)

**`page.tsx`** — Groups all sessions by `job_opening_id` into opening cards showing candidate count and average score. "Create New Opening" wizard: upload resume PDF or paste JD, generate questions, display candidate credentials. Supports adding candidates to existing openings via inline form.

**`openings/[id]/OpeningDetailClient.tsx`** — Candidates table with per-row actions:
- **View** — link to full candidate profile
- **Process / Re-run** — fires `POST /session/{id}/process`, polls `/status` every 3 seconds, displays animated progress banner with stage labels and item counts
- **Add Candidate** — modal with name input, fetches questions from first existing session, calls `/session/create` with same `job_opening_id`, displays generated credentials with one-click copy
- **Delete** — calls `DELETE /session/{id}` with confirmation; removes all media and scores without touching the job opening

**`candidates/[id]/page.tsx`** — Digital Candidate Twin profile with four tabs:
- **Overview** — OCEAN Big Five radar chart, sentiment timeline, emotion distribution, HRV area chart, job-fit score ring
- **Per-Question** — expandable accordion per question: transcript, scores as progress bars, gaze zone donut chart, emotion snapshots, cheat flag banners, native `<video>` and `<audio>` players using Cloudinary secure URLs
- **Gaze & Signals** — GazeFollower zone distribution bar chart, HRV+HR area chart, robotic reading detection, per-question cheat risk breakdown
- **Raw Media** — full-session video and audio players

---

## 10. Media Storage

All media is stored in Cloudinary with no server-side local persistence.

**Naming convention:**

```
public_id:  {login_id}_{session_id}_q{question_number}_{audio|video}
folder:     candidates/{login_id}/sessions/{session_id}/
full path:  candidates/{login_id}/sessions/{session_id}/{login_id}_{session_id}_q{n}_{kind}
```

Both audio (WebM) and video (WebM) are stored under `resource_type="video"` as Cloudinary treats this resource type for all streaming media.

**Media lifecycle:**
- Uploaded immediately at end of each question response (in-memory, no disk write)
- Uploaded with `overwrite=True` — re-running the interview re-uploads cleanly
- Deleted atomically when `DELETE /session/{id}` is called
- Deleted by prefix `candidates/` when admin reset is triggered

---

## 11. Environment Configuration

Copy `.env` and set all values:

```dotenv
# LLM — Gemini Flash (primary) / Ollama Qwen (fallback)
GEMINI_API_KEY=

# Ollama configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:0.5b

# Supabase
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_CONNECTION_STRING=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Admin reset endpoint secret
ADMIN_SECRET=change-before-deploying
```

---

## 12. Setup and Installation

### Prerequisites

- Python 3.11
- Node.js 20+
- Ollama installed and running (`ollama serve`)
- Supabase project with schema applied
- Cloudinary account

### 1. Database Migration

In Supabase SQL Editor, run the full contents of `supabase_migration.sql`. The script is idempotent — safe to run on an existing database. It adds all missing columns, creates indexes, and configures FK-safe delete order.

### 2. Pull Local LLM Model

```bash
ollama pull qwen2.5:0.5b
```

### 3. Backend

```bash
cd e:/ai-intern
python -m venv venv
source venv/Scripts/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# GazeFollower (optional, enables post-session video gaze analysis)
pip install gazefollower

# Start API server
uvicorn api.main:app --reload --port 8000
```

Swagger UI available at `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd e:/ai-intern/frontend
npm install
npm run dev
```

Application available at `http://localhost:3000`.

### 5. Run Tests

```bash
cd e:/ai-intern
python -m pytest tests/ -v
```

---

## 13. Known Issues and Fixes

### Whisper concurrent access crash

**Symptom:** `RuntimeError: Linear(in_features=768, bias=True)` when two sessions process simultaneously.

**Fix:** Whisper model access is serialised via `_whisper_lock = threading.Lock()`. All transcription calls acquire this lock before invoking the model.

### GazeFollower / MediaPipe version conflict

**Symptom:** `module 'mediapipe' has no attribute 'solutions'`

**Fix:** GazeFollower requires `mediapipe==0.10.21`.

```bash
pip install mediapipe==0.10.21 --force-reinstall
```

### sentence-transformers Keras 3 conflict

**Symptom:** Import error referencing missing `tf-keras` module.

**Fix:**

```bash
pip install tf-keras
```

### bcrypt `__about__` error with passlib

**Symptom:** `AttributeError: module 'bcrypt' has no attribute '__about__'` when using passlib.

**Fix:** The backend uses bcrypt directly, bypassing passlib. If encountered with older code:

```bash
pip install bcrypt==4.0.1
```

### React StrictMode double pipeline trigger

**Symptom:** `POST /session/{id}/process` called twice from the thank-you page in development.

**Fix:** The thank-you page uses `didFireRef = useRef(false)` to guard the call, ensuring it fires exactly once regardless of React's double-invocation behaviour in strict mode.

### GazeFollower not installed

When `gazefollower` is not installed, the pipeline gracefully stores `{"provider": "gazefollower", "status": "not_installed"}` in `video_signals.gaze_metrics`. The dashboard displays this status rather than crashing. Install with `pip install gazefollower` to enable full post-session gaze analysis.

---

## Processing Pipeline Status Labels

When `POST /session/{id}/process` is called and the frontend polls `/session/{id}/status`, the following stage labels are returned:

| Stage | Label | Progress |
|-------|-------|----------|
| `transcribing` | Transcribing audio (N/M) | 20% |
| `scoring` | Scoring response N/M | 50% |
| `finalizing` | Computing OCEAN personality profile | 75% |
| `analyzing_gaze` | Analyzing gaze video N/M | 90% |
| complete (OCEAN saved) | `status: ready` | 100% |

The pipeline runs in a daemon thread and is fire-and-forget. If the server restarts mid-pipeline, call `POST /session/{id}/process` again to re-run from scratch (all operations are idempotent via upsert).
