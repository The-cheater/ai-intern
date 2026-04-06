# Examiney.AI — AI-Powered Interview Intelligence Platform

Examiney.AI is a full-stack, multi-modal AI platform that automates the interview process from resume parsing through candidate evaluation. It combines speech recognition, computer vision, physiological signal analysis, and large language model scoring to produce a structured psychological and technical assessment of every candidate — delivered to recruiters through a live dashboard.

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
13. [Production Deployment](#13-production-deployment)
14. [Security Considerations](#14-security-considerations)
15. [Known Issues and Fixes](#15-known-issues-and-fixes)

---

## 1. System Overview

Examiney.AI removes subjectivity from hiring by running every candidate through an identical, AI-scored interview. The platform operates across two user-facing interfaces:

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
| LLM (Primary) | Google Gemini Flash | Question generation, LLM evaluation, OCEAN role recommendation |
| LLM (Fallback) | Ollama + Qwen2.5:0.5b | Local inference when Gemini is unavailable |
| Speech-to-Text | OpenAI Whisper (small) | Audio transcription, serialised via threading.Lock |
| Semantic Scoring | sentence-transformers all-MiniLM-L6-v2 | Cosine similarity between transcript and ideal answer |
| Sentiment Scoring | VADER SentimentIntensityAnalyzer | Compound sentiment signal (10% weight in combined score) |
| Gaze Tracking | MediaPipe FaceMesh (browser) | Real-time iris landmark detection during interview |
| Post-Session Gaze | GazeFollower 1.0.2 | Appearance-based gaze model on recorded video |
| Face Landmark | MediaPipe (Python) | Calibration affine transform computation |
| Emotion Analysis | DeepFace | 8-class facial emotion classification per video chunk |
| Physiological Signals | CHROM rPPG (OpenCV + NumPy) | Heart rate and HRV RMSSD from webcam footage |
| Cheating Detection | Custom (NumPy + FFT) | 9-signal FFT-based scan pattern + fixation analysis |
| Password Hashing | bcrypt 4.0.1 (direct) | Candidate credential hashing |
| HTTP Client | httpx | External LLM API calls, media download |
| Environment | python-dotenv | .env loading |

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
| Local LLM | Ollama | Self-hosted Qwen2.5 model server (fallback only) |

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
│   │   ├── prompts.py                  # System prompt + build_batch_prompt()
│   │   └── generator.py               # generate_questions() → Gemini / Ollama
│   │
│   ├── scoring/
│   │   ├── models.py                   # ResponseScore, SentimentScores, OceanReport
│   │   ├── response_scorer.py          # Transcript → semantic + VADER scoring
│   │   ├── ocean_mapper.py             # OCEAN trait mapping + job-fit cosine similarity
│   │   └── llm_marker.py              # LLM judge (verdict) + dimension marker (5 scores)
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
│       └── cloudinary_client.py        # Upload, delete, naming, prefix delete
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
├── outputs/                            # Runtime output (calibration JSONs, OCEAN reports)
│   └── calibration/                    # Per-session calibration data — volume-mounted
│
├── Dockerfile                          # Single-worker container (model safety)
├── docker-compose.yml                  # API + Ollama services
├── supabase_schema.sql                 # Safe incremental schema (run in Supabase SQL Editor)
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
                     18-20 questions across 5 stages:
                       intro / technical / behavioral / logical / situational
                     Each question includes ideal_answer + answer_key
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
                           Validates question_stage against known stage values
                           Uploads audio + video to Cloudinary (in-memory, no disk)
                           Naming: {login_id}_{session_id}_q{n}_{audio|video}
                           Folder: candidates/{login_id}/sessions/{session_id}/
                           Stores video_url + audio_url in question_responses
                           Fires _bg_process_single_response (daemon thread):
                             → Whisper transcription
                             → semantic scoring (SentenceTransformer + VADER)
                             → LLM judge with stage-specific evaluation criteria
                             → 5-dimension mark_response scoring
                             → GazeFollower on the uploaded video

                        →  POST /video/analyze-chunk
                           Loads calibration once for both zone classification and cheating
                           Classifies gaze zones using calibrated personalised thresholds
                           Detects cheating via 9-signal FFT-based scan pattern analysis
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

  Step 1 — Fetch session + build stage map
    Load session to get question stage mapping (intro/technical/behavioral/...)
    Fetch all question_responses rows

  Step 2 — Transcription + Scoring (any un-transcribed questions)
    For each question with audio_url and no transcript:
      Download .webm from Cloudinary  →  _download_to_tmp()
      Whisper.transcribe() (serialised via _whisper_lock)
      Update question_responses.transcript
      LLM judge with CORRECT stage-specific criteria → verdict + key_gaps + strengths
      mark_response → technical / communication / behavioral / engagement / authenticity
      combined_score = (llm_score × 0.70 + semantic_score × 0.30) × 10
      Save all scores back to question_responses

  Step 3 — OCEAN Finalize (inline, no HTTP self-call)
    _finalize_ocean_inline():
      Loads all ResponseScore objects from Supabase
      Maps per-question scores to Big-Five trait signals:
        Extraversion    ← intro question sentiment + engagement (depth-weighted)
        Conscientiousness ← technical/logical semantic score + structure signal
        Openness        ← vocabulary richness across technical/logical/situational
        Agreeableness   ← behavioral cooperative keywords + positive sentiment
        Neuroticism     ← negative sentiment + stress signals (inverse)
      Signals multiplied by _depth_ratio() — shallow answers get low weight
      Computes job_fit_score via cosine_similarity(all_transcripts, JD)
        Fallback: keyword overlap when SentenceTransformer unavailable
      ocean_confidence: High (≥6 questions) / Medium (3-5) / Low (<3)
      success_prediction: High (fit≥70 AND balance≥60) / Medium / Low
      Calls Gemini Flash for role_recommendation narrative
      Saves OCEAN report to ocean_reports table

  Step 4 — GazeFollower Video Analysis
    For each question with video_url:
      Download .webm from Cloudinary
      Extract frames via OpenCV (every 3rd frame)
      GazeFollower.predict(frame) → raw (x, y) gaze point
      Track off-screen predictions before clamping → offscreen_ratio_raw
      Classify zones using calibration-derived thresholds
      _detect_robotic_reading() with adaptive thresholds (scaled by sqrt(baseline_variance))
      detect_cheating() with neurodiversity-adjusted personalised thresholds
      Store all metrics in video_signals.gaze_metrics (JSONB)
```

### Stage 4 — Dashboard Reporting

```
GET /opening/{id}/candidates  →  lists all sessions with OCEAN summaries
                                   batch-checks question_responses (single query)
                                   sessions with no responses → ocean_summary: null
GET /session/{id}/report      →  full joined record:
                                   sessions + question_responses + video_signals + ocean_reports
                                   interview_completed flag (false if no question_responses)
                                   video_url / audio_url → direct Cloudinary playback
DELETE /session/{id}          →  destroys Cloudinary assets + all Supabase rows
```

---

## 6. Backend Services

### `services/parser/`

**parser.py** — Wraps IBM Docling's `DocumentConverter` for PDF parsing. Falls back to regex-based extraction for plain text resumes. Email regex supports multi-part TLDs (`.co.uk`, `.com.au`). Phone regex handles international formats with E.164, UK, India, EU patterns. Name detection skips known section headers (`experience`, `education`, `skills`, etc.). Section caps: education 10, experience 10, projects 10.

### `services/question_gen/`

**generator.py** — Calls Gemini Flash (primary) or Ollama Qwen2.5 (fallback) with a structured system prompt. Generates 18-20 questions mapped directly to resume projects and job description requirements, distributed across `intro`, `technical`, `behavioral`, `logical`, and `situational` stages. Every question includes an `ideal_answer` field and an `answer_key`. Tracks up to 20 used topic keywords across batches to prevent repetition. Padding logic correctly tracks `added_in_batch` to handle non-dict items in LLM responses.

### `services/scoring/`

**response_scorer.py** — Takes a candidate transcript and ideal answer. Computes:
- `semantic_score` — cosine similarity via `all-MiniLM-L6-v2` SentenceTransformer (keyword overlap fallback if unavailable)
- `_depth_penalty` — caps scores for shallow responses: <30 words capped at 0.30, <50 words scaled 70%, <80 words scaled 85%
- `sentiment` — VADER `compound`, `pos`, `neg`, `neu` scores
- `combined_score` — semantic (90%) + VADER compound (10%) normalised to 0–10
- `engagement_flag` — True if word count < 50 OR penalised semantic < 0.20
- Whisper hallucination guard: 15 known garbage phrases + mixed Unicode script detection

**llm_marker.py** — Two entry points:
- `judge_response()` — stage-aware verdict (correct / partially_correct / can_be_better / incorrect / not_attempted) with per-stage criteria: behavioral enforces STAR method, technical enforces depth and terminology, logical enforces step-by-step reasoning. Score mapping: correct=9.5, partially_correct=6.5, can_be_better=3.5, incorrect=1.0.
- `mark_response()` — scores 5 dimensions (technical, communication, behavioral, engagement, authenticity 0–10 each) + raw OCEAN signals (0–1 each). Both functions try Gemini Flash first, fall back to Ollama.

**ocean_mapper.py** — Aggregates all `ResponseScore` objects into Big-Five trait scores (0–100) using deterministic rule mapping. All signals are depth-weighted via `_depth_ratio()` so shallow answers don't pollute the profile. Computes `job_fit_score` as cosine similarity between all concatenated transcripts and the job description, with keyword fallback if SentenceTransformer is unavailable. `ocean_confidence` reported as High/Medium/Low based on questions scored.

### `services/video_analysis/calibration/`

**calibration_runner.py** — Implements a 15-point screen calibration sequence. The browser sends averaged MediaPipe iris coordinates for each known screen position (corners, edge midpoints, center, inner quadrant points). `run_calibration()` fits a 3×2 affine transform via `numpy.linalg.lstsq`, computes per-candidate baseline gaze variance, blink rate, and a neurodiversity adjustment factor (1.4× scale on cheating thresholds if baseline variance > 0.06). Returns a `calibration_quality_score` (0–1 based on cluster tightness) — below 0.6 triggers a recalibration prompt.

### `services/video_analysis/gaze/`

**zone_classifier.py** — Loads the candidate's personal calibration JSON. Applies affine transform before every classification. Classifies each gaze point into:
- `strategic` — calibrated y ≤ 0.55, x within ±30% of center
- `wandering` — frame-to-frame displacement > 1.3× candidate baseline
- `red` — calibrated y > 0.72 (notes/phone) or off-screen angle > 15°
- `neutral` — all other positions

**cheating_detector.py** — 9-signal batch detector: horizontal scan (x-variance), rapid gaze jumps, periodic scan via FFT (0.3–3.5 Hz reading band), directional sweeps (L→R reversal rate), gaze freeze (variance < 5% of baseline), extreme lateral gaze, robotic velocity, linear reading trajectory, sustained downward gaze. Risk level scaled by `neurodiversity_adjustment` — high-variance candidates are not unfairly penalised. Max score = 13 (weighted); high ≥ 5, medium ≥ 2.

**gazefollower_runner.py** — Post-session video processor. Extracts frames with OpenCV (every 3rd frame), runs GazeFollower's appearance-based model, tracks off-screen predictions before coordinate clamping (`offscreen_ratio_raw`), classifies zones using calibration-derived thresholds, runs adaptive `_detect_robotic_reading()` (thresholds scaled by `sqrt(baseline_variance)`), and re-runs cheating detection with personalised baseline.

### `services/video_analysis/emotion_analyzer.py`

Runs DeepFace with `enforce_detection=True` — frames without a detectable face are skipped rather than analysing background content. Returns 8-class emotion distribution as proportional floats summing to 1.0. Logs skipped frame count.

### `services/video_analysis/rppg.py`

Implements CHROM rPPG using OpenCV to extract the forehead region of interest. Computes a photoplethysmography signal, applies bandpass filtering (0.75–3 Hz), and derives `avg_hrv_rmssd`, `hr_bpm`, and `stress_spike_detected`. Returns `data_available: false` (not fake defaults) when signal quality is too low.

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
| POST | `/session/{id}/save-response` | Upload audio + video to Cloudinary, fires background processing |
| POST | `/session/{id}/process` | Fire full background pipeline (202 immediate return) |
| POST | `/session/{id}/finalize` | Aggregate responses → OCEAN scores → Supabase |
| GET  | `/session/{id}/status` | Live pipeline stage for polling |
| GET  | `/session/{id}/report` | Full joined candidate report (includes `interview_completed` flag) |
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
| DELETE | `/admin/reset-database` | Wipe Cloudinary prefix + truncate all tables (requires `X-Admin-Secret` header) |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Global API health check |
| GET | `/session/{id}/health` | Per-session heartbeat |

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
| transcript | TEXT | Filled by Whisper background processing |
| transcript_flagged | BOOLEAN | True if Whisper hallucination detected |
| semantic_score | FLOAT | SentenceTransformer cosine similarity |
| sentiment | JSONB | `{compound, pos, neg, neu}` |
| combined_score | FLOAT | 0–10 weighted composite (LLM 70% + semantic 30%) |
| technical_score | FLOAT | LLM dimension score 0–10 |
| communication_score | FLOAT | LLM dimension score 0–10 |
| behavioral_score | FLOAT | LLM dimension score 0–10 |
| engagement_score | FLOAT | LLM dimension score 0–10 |
| authenticity_score | FLOAT | LLM dimension score 0–10 |
| llm_verdict | TEXT | correct / partially_correct / can_be_better / incorrect / not_attempted |
| llm_verdict_reason | TEXT | One-sentence LLM explanation |
| llm_key_gaps | JSONB | Array of specific missing points |
| llm_strengths | JSONB | Array of specific strong points |
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
| cheat_flags | JSONB | risk_level, 9-signal breakdown, cheat_score |
| emotion_distribution | JSONB | 8-class DeepFace percentages |
| avg_hrv_rmssd | FLOAT | rPPG-derived (null if signal unavailable) |
| hr_bpm | FLOAT | rPPG-derived (null if signal unavailable) |
| stress_spike_detected | BOOLEAN | |
| gaze_metrics | JSONB | GazeFollower post-session metrics + offscreen_ratio_raw |

### `ocean_reports`
| Column | Type | Notes |
|--------|------|-------|
| session_id | TEXT PK | |
| openness | FLOAT | 0–100 |
| conscientiousness | FLOAT | |
| extraversion | FLOAT | |
| agreeableness | FLOAT | |
| neuroticism | FLOAT | |
| job_fit_score | FLOAT | 0–100 |
| success_prediction | TEXT | High / Medium / Low |
| role_recommendation | TEXT | 2-sentence LLM narrative |

### `error_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| session_id | TEXT | Nullable |
| service | TEXT | e.g. AudioUpload, EarlyTranscribe, PostSessionGaze |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | |

---

## 9. Frontend Application

### Candidate Portal (`/portal/`)

**`login/page.tsx`** — Accepts `login_id` + password. POSTs to `/candidate/login`. On success stores `session_id` and `questions` in localStorage and routes to permissions.

**`permissions/page.tsx`** — Requests camera and microphone permissions. Visual status indicators (granted / denied). Enforces fullscreen via Fullscreen API. "Begin" button only enabled when both permissions are granted and fullscreen is active.

**`calibration/page.tsx`** — Full-screen dark overlay with a 15-point glowing dot sequence. Loads MediaPipe FaceMesh from CDN. Captures 30 iris landmark frames per dot at 66ms intervals. Filters noisy frames (face must be centred, stable). POSTs to `/calibration/start` then `/calibration/submit`. Shows quality score — recalibration prompt if below 0.6.

**`interview/page.tsx`** — Distraction-free fullscreen interview. Shows one question at a time with a circular countdown timer (amber at 30s, red at 10s). Records audio and video simultaneously via MediaRecorder. Collects MediaPipe gaze samples during each question. On answer: POSTs to `/session/{id}/save-response` (media upload, fires per-question background processing) and `/video/analyze-chunk` (gaze + emotion + rPPG). 5-second interstitial between questions.

**`thank-you/page.tsx`** — Shows session reference ID. Fires `POST /session/{id}/process` once (guarded by `useRef` to prevent React StrictMode double-fire). Polls `/session/{id}/status` every 8 seconds until the backend pipeline completes. Never shows scoring data to the candidate.

### Recruiter Dashboard (`/dashboard/`)

**`page.tsx`** — Groups all sessions by `job_opening_id` into opening cards showing candidate count and average score. "Create New Opening" wizard: upload resume PDF or paste JD, generate questions, display candidate credentials. Supports adding candidates to existing openings via inline form.

**`openings/[id]/OpeningDetailClient.tsx`** — Candidates table with per-row actions:
- **View** — link to full candidate profile
- **Process / Re-run** — fires `POST /session/{id}/process`, polls `/status` every 3 seconds, displays animated progress banner with stage labels and item counts
- **Add Candidate** — modal with name input, fetches questions from first existing session, calls `/session/create` with same `job_opening_id`, displays generated credentials with one-click copy
- **Delete** — calls `DELETE /session/{id}` with confirmation; removes all media and scores without touching the job opening

**`candidates/[id]/page.tsx`** — Digital Candidate Twin profile with four tabs:
- **Overview** — OCEAN Big Five radar chart, sentiment timeline, emotion distribution, HRV area chart, job-fit score ring. Shows `"—"` and "Interview not taken" when `interview_completed` is false — never shows fake scores.
- **Per-Question** — expandable accordion per question: transcript, LLM verdict badge, scores as progress bars, gaze zone donut chart, emotion snapshots, cheat flag banners, native `<video>` and `<audio>` players using Cloudinary secure URLs
- **Gaze & Signals** — GazeFollower zone distribution bar chart, HRV+HR area chart, robotic reading detection, per-question cheat risk breakdown
- **Raw Media** — full-session video and audio players. Shows "Candidate has not taken the interview yet" message when no media is available.

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
- Deleted atomically when `DELETE /session/{id}` is called (folder prefix + individual IDs)
- Deleted by prefix `candidates/` when admin reset is triggered

---

## 11. Environment Configuration

Copy `.env` and set all values:

```dotenv
# LLM — Gemini Flash (primary) / Ollama Qwen (fallback)
GEMINI_API_KEY=

# Ollama configuration (used as fallback only)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:0.5b

# Supabase
SUPABASE_URL=
SUPABASE_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# CORS — comma-separated list of allowed frontend origins
# For production: CORS_ORIGINS=https://your-app.vercel.app
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Admin reset endpoint secret — CHANGE before any shared deployment
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
- Google Gemini API key (free tier sufficient)

### 1. Database Migration

In Supabase SQL Editor, run the full contents of `supabase_schema.sql`. The script is idempotent — safe to run on an existing database. It adds all missing columns, creates indexes, and configures FK-safe delete order.

### 2. Pull Local LLM Model

```bash
ollama pull qwen2.5:0.5b
```

This is only used as a fallback. If `GEMINI_API_KEY` is set, Ollama is never called for question generation or evaluation.

### 3. Backend

```bash
cd e:/ai-intern
python -m venv venv
source venv/Scripts/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# GazeFollower (optional — enables post-session video gaze analysis)
pip install gazefollower

# Start API server
pip install gazefollower
```

Swagger UI available at `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd e:/ai-intern/frontend
npm install
npm run dev
```

Application available at `http://localhost:3000`.

### 5. Clean Database (Development Reset)

Wipes all Cloudinary media under the `candidates/` prefix and truncates every Supabase table.

```bash
curl -X DELETE http://localhost:8000/admin/reset-database \
  -H "X-Admin-Secret: your-admin-secret"
```

PowerShell equivalent:

```powershell
Invoke-RestMethod -Method DELETE http://localhost:8000/admin/reset-database `
  -Headers @{ "X-Admin-Secret" = "your-admin-secret" }
```

---

## 13. Production Deployment

Examiney.AI uses several local ML models (Whisper, SentenceTransformer, DeepFace, GazeFollower) and a local LLM (Ollama). Running these in production requires deliberate architectural decisions. This section covers every concern.

### 13.1 Local Models in Production

| Model | Size | Startup Time | Production Strategy |
|-------|------|-------------|---------------------|
| Whisper (small) | ~480 MB | ~5 s first call | Keep single process; or replace with OpenAI Whisper API |
| SentenceTransformer (all-MiniLM-L6-v2) | ~90 MB | ~3 s first call | Cached via `lru_cache(maxsize=1)` — safe in single process |
| DeepFace | ~600 MB+ | ~10 s first call | Acceptable for background processing; disable if latency critical |
| GazeFollower | ~200 MB | ~5 s first call | Post-session only — no latency impact on interview itself |
| Ollama Qwen2.5:0.5b | ~400 MB | Depends on host | Used only when Gemini is unavailable; can be disabled in pure-cloud setup |

### 13.2 Critical: Single Worker Requirement

The API runs with `--workers 1`. **Do not increase workers** without architectural changes:

- `_whisper_lock` is a process-local threading lock. With multiple workers (processes), two requests can reach Whisper simultaneously — each worker loads its own ~480 MB model instance, consuming ~1 GB RAM and potentially corrupting model state.
- `_get_whisper()` and `_get_model()` use `lru_cache(maxsize=1)` which is also process-local.

**To scale horizontally in production:**

```
Option A — Task Queue (recommended)
  Move transcription + scoring into Celery/ARQ workers.
  Each worker is a dedicated process holding exactly one Whisper instance.
  FastAPI just enqueues jobs and polls.

Option B — Dedicated Transcription Microservice
  Extract transcription into a separate FastAPI service (1 instance).
  Main API forwards audio URLs to it via internal HTTP.
  Scale main API freely (workers=N) since transcription is now isolated.

Option C — Replace Whisper with OpenAI Whisper API
  Remove the local model entirely.
  WHISPER_API_KEY= in .env, call api.openai.com/v1/audio/transcriptions.
  Then --workers 4+ is safe.
```

### 13.3 Using Docker Compose

The provided `docker-compose.yml` runs the API and Ollama together:

```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f api

# Pull Qwen model into the Ollama container
docker-compose exec ollama ollama pull qwen2.5:0.5b
```

The `outputs/` directory is volume-mounted to persist calibration JSONs across container restarts.

### 13.4 Environment Variables for Production

Set these in your deployment platform (Railway, Render, Fly.io, etc.) or update `.env`:

```dotenv
# Production LLM — use Gemini exclusively; disable Ollama
GEMINI_API_KEY=your-real-key

# Set to empty string to disable Ollama fallback (faster fail, no 60s timeout)
OLLAMA_URL=

# CORS — your actual frontend domain
CORS_ORIGINS=https://your-app.vercel.app

# Strong admin secret (generate with: openssl rand -hex 32)
ADMIN_SECRET=your-random-64-char-hex-string

# Frontend
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

### 13.5 Frontend Deployment (Vercel)

```bash
cd frontend
# Add to Vercel environment variables:
# NEXT_PUBLIC_API_URL = https://your-api.railway.app
vercel deploy --prod
```

No local models run in the frontend. All compute is in the API.

### 13.6 Calibration File Persistence

Calibration JSONs are saved to `outputs/calibration/{session_id}_calibration.json` and immediately uploaded to Cloudinary as `raw` resources. In production:

- The local file is deleted after upload (`os.unlink(cal_path)` in `calibration_submit`)
- The cheating detector loads calibration from disk via `load_calibration(session_id)` — this will fail if the file was deleted
- **Fix for serverless/ephemeral storage**: Download calibration from Cloudinary before use, or store calibration data directly in the `sessions` Supabase table

For containerised deployments with a persistent volume (the default Docker Compose setup), this is not an issue.

### 13.7 Recommended Production Stack

```
Frontend:   Vercel (Next.js 14) — free tier sufficient for most interview volumes
API:        Railway / Render (Python 3.11, --workers 1, 2 GB RAM minimum)
Whisper:    Co-deployed with API or replaced with OpenAI Whisper API
Ollama:     Disabled in production (GEMINI_API_KEY covers all LLM needs)
Database:   Supabase (already cloud-hosted)
Media:      Cloudinary (already cloud-hosted)
```

---

## 14. Security Considerations

### Authentication Gaps (Current Limitations)

| Gap | Risk | Recommended Fix |
|-----|------|-----------------|
| No recruiter authentication on API endpoints | Anyone with the API URL can list all sessions, view reports, and delete candidates | Add JWT auth middleware (FastAPI-Users or custom) to all `/session`, `/opening`, `/sessions` endpoints |
| `/admin/reset-database` protected by a single shared secret | If the secret leaks, all data can be wiped | Rotate `ADMIN_SECRET` regularly; restrict to IP allowlist in production |
| No rate limiting on `/candidate/login` | Brute force of candidate passwords is possible | Add slowapi rate limiting: 5 requests/minute per IP |
| `question_stage` is client-supplied | Candidate could submit a different stage to manipulate scoring strictness | Validated against `_KNOWN_STAGES` set on server — this is already enforced |

### CORS

CORS origins are configurable via `CORS_ORIGINS` env var. Default allows only `localhost:3000`. **Set this to your exact frontend domain** in production — never use `*` with `allow_credentials=True`.

### Input Handling

- All Supabase queries use the official `supabase-py` client with parameterized operations — SQL injection is not possible
- Transcript and question text from candidates are stored as plain text and rendered escaped in the frontend
- `ideal_answer` and `question_text` truncated at 600/400 chars respectively in LLM prompts to prevent prompt injection

### Secrets

- Candidate passwords are bcrypt-hashed before storage
- Raw passwords are never logged or stored — only returned once to the recruiter at creation time
- `ADMIN_SECRET` must be set via environment variable — the server refuses to execute reset if the variable is empty

### One-Time Credentials

The `candidate_credentials.used` flag is set to `True` on first successful login. A credential cannot be used twice — if a candidate disconnects, the recruiter must create a new session.

---

## 15. Known Issues and Fixes

### Whisper concurrent access crash

**Symptom:** `RuntimeError: Linear(in_features=768, bias=True)` when two sessions process simultaneously.

**Fix:** Whisper model access is serialised via `_whisper_lock = threading.Lock()`. All transcription calls acquire this lock before invoking the model. Do not run with `--workers > 1`.

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

**Fix:** The backend uses bcrypt directly, bypassing passlib.

```bash
pip install bcrypt==4.0.1
```

### React StrictMode double pipeline trigger

**Symptom:** `POST /session/{id}/process` called twice from the thank-you page in development.

**Fix:** The thank-you page uses `didFireRef = useRef(false)` to guard the call, ensuring it fires exactly once regardless of React's double-invocation behaviour in strict mode.

### GazeFollower not installed

When `gazefollower` is not installed, the pipeline gracefully stores `{"provider": "gazefollower", "status": "not_installed"}` in `video_signals.gaze_metrics`. Install with `pip install gazefollower` to enable full post-session gaze analysis.

### Candidate shown fake 50% job fit before interview

**Fix:** The API checks `question_responses` before returning any OCEAN data. Sessions with no responses have `interview_completed: false` and `ocean_report: null`. Stale `ocean_reports` rows are deleted on detection. The frontend shows `"—"` and "Interview not taken" for all scores when `interview_completed` is false.

### LLM judge using generic evaluation criteria for all questions

**Fix:** Both `_bg_process_single_response` and `_bg_post_session` now pass the actual question stage (`intro`, `technical`, `behavioral`, `logical`, `situational`) to `judge_response`. Stage-specific criteria are enforced: behavioral requires STAR method examples, technical requires depth and correct terminology, logical requires step-by-step reasoning.

### Dimension scores (technical/communication/behavioral) always 0

**Fix:** `mark_response()` is now called in both scoring code paths and its results are persisted to `question_responses`.

### Background pipeline calling itself via HTTP (`localhost:8000`)

**Fix:** `_finalize_ocean_inline()` replaces the `httpx.POST http://localhost:8000/finalize` self-call. OCEAN finalization runs inline in the background thread — no hardcoded port, no network round-trip, no silent failure if the port changes.

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




