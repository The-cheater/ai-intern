"""NeuroSync AI Interviewer — FastAPI backend (v3.0).

All endpoints return structured JSON errors on failure:
  {"error": "human-readable message", "code": "SCREAMING_SNAKE_CODE"}
"""

import json
import os
import random
import shutil
import string
import tempfile
import threading
import time
import uuid
from functools import lru_cache
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, Path, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from services.database import cloudinary_client, supabase_client
from services.parser.models import ParsedResume
from services.parser.parser import parse_pdf, parse_text
from services.question_gen.generator import generate_questions
from services.question_gen.models import InterviewScript
from services.scoring.models import ResponseScore, SentimentScores
from services.scoring.ocean_mapper import build_ocean_report
from services.scoring.response_scorer import score_response
from services.video_analysis.calibration.calibration_runner import (
    CalibrationResult,
    IrisSample,
    PointMeasurement,
    get_calibration_points,
    run_calibration,
)

# ── Password hashing (bcrypt direct — avoids passlib/__about__ issue) ──────────
try:
    import bcrypt as _bcrypt_lib
    def _hash_pw(pw: str) -> str:
        return _bcrypt_lib.hashpw(pw.encode(), _bcrypt_lib.gensalt()).decode()
    def _verify_pw(pw: str, h: str) -> bool:
        try:
            return _bcrypt_lib.checkpw(pw.encode(), h.encode())
        except Exception:
            return False
    print("[NeuroSync][Auth] Using bcrypt for password hashing")
except ImportError:
    import hashlib
    def _hash_pw(pw: str) -> str:   return hashlib.sha256(pw.encode()).hexdigest()
    def _verify_pw(pw: str, h: str) -> bool: return _hash_pw(pw) == h
    print("[NeuroSync][Auth] bcrypt not found — using SHA-256 fallback")

# ── Per-session processing stage tracker ──────────────────────────────────────
# Stores live pipeline stage for sessions currently being processed.
# { session_id: {"stage": str, "label": str, "done": int, "total": int} }
# Cleaned up when pipeline completes or on error.
_processing_stages: Dict[str, Dict[str, Any]] = {}
_stages_lock = threading.Lock()


def _set_stage(session_id: str, stage: str, label: str, done: int = 0, total: int = 0) -> None:
    with _stages_lock:
        _processing_stages[session_id] = {"stage": stage, "label": label, "done": done, "total": total}
    print(f"[VidyaAI][PostSession] [{session_id[:8]}] Stage: {stage} — {label} ({done}/{total})")


def _clear_stage(session_id: str) -> None:
    with _stages_lock:
        _processing_stages.pop(session_id, None)


# ── Whisper (lazy, serialised) ─────────────────────────────────────────────────
_whisper_lock = threading.Lock()

@lru_cache(maxsize=1)
def _get_whisper():
    import whisper
    return whisper.load_model("small")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroSync AI Interviewer",
    description=(
        "Full pipeline: resume parsing → question generation → interview session → "
        "gaze analysis → OCEAN personality scoring → recruiter dashboard."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _err(message: str, code: str, status: int = 500):
    raise HTTPException(status_code=status, detail={"error": message, "code": code})


def _gen_login_id() -> str:
    return "NSC-" + "".join(random.choices(string.digits, k=6))

def _gen_opening_login_id() -> str:
    return "NSO-" + "".join(random.choices(string.digits, k=6))


def _gen_password(length: int = 8) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def _cloudinary_upload_with_retry(
    *,
    data: bytes,
    public_id: str,
    folder: str,
    resource_type: str,
    max_retries: int = 3,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Upload to Cloudinary with exponential-backoff retries. Logs failures to Supabase."""
    for attempt in range(max_retries):
        try:
            return cloudinary_client.upload_bytes(
                data=data,
                public_id=public_id,
                folder=folder,
                resource_type=resource_type,
                overwrite=True,
                tags=["neurosync", f"session:{session_id}" if session_id else "session:unknown"],
                context={"session_id": session_id or ""},
            )
        except Exception as exc:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"[VidyaAI][CloudinaryUpload] attempt {attempt+1}/{max_retries} failed: {exc}. Retrying in {wait:.1f}s")
            if attempt < max_retries - 1:
                time.sleep(wait)
            else:
                supabase_client.log_error("CloudinaryUpload", str(exc), session_id)
                raise


def _transcribe(audio_path: str) -> tuple:
    """Run Whisper on *audio_path*. Serialised via lock to prevent concurrent access crashes."""
    with _whisper_lock:
        try:
            print(f"[VidyaAI][Whisper] transcribing {os.path.basename(audio_path)}")
            model = _get_whisper()
            result = model.transcribe(audio_path, fp16=False)
            text = result.get("text", "").strip()
            print(f"[VidyaAI][Whisper] done — {len(text)} chars")
            return text, False
        except Exception as exc:
            print(f"[VidyaAI][Whisper] transcription failed: {exc}")
            return "", True


# ── Parse endpoints ────────────────────────────────────────────────────────────

@app.post("/parse/pdf", response_model=ParsedResume, tags=["Parse"],
          summary="Upload a PDF resume → structured data")
async def parse_resume_pdf(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        _err("Only PDF files are supported.", "INVALID_FILE_TYPE", 400)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        return parse_pdf(tmp_path)
    except Exception as e:
        _err(f"PDF parsing failed: {e}", "PARSE_FAILED")
    finally:
        os.unlink(tmp_path)


@app.post("/parse/text", response_model=ParsedResume, tags=["Parse"],
          summary="Submit plain-text resume → structured data")
async def parse_resume_text(text: str = Form(...)):
    return parse_text(text)


# ── Question generation ────────────────────────────────────────────────────────

class QuestionGenRequest(BaseModel):
    resume_markdown: Optional[str] = ""
    job_description: Optional[str] = ""
    model: Optional[str] = None
    ollama_url: Optional[str] = None
    section_counts: Optional[Dict[str, int]] = None   # e.g. {"intro":2,"technical":5,"behavioral":3,"logical":3}


@app.post("/generate-questions", response_model=InterviewScript, tags=["Questions"],
          summary="Generate interview questions with ideal_answer fields")
async def generate_interview_questions(req: QuestionGenRequest):
    if not req.resume_markdown and not req.job_description:
        _err("Provide resume_markdown and/or job_description.", "MISSING_INPUT", 400)
    kwargs: Dict[str, Any] = {
        "resume_markdown": req.resume_markdown or "",
        "job_description": req.job_description or "",
    }
    if req.model:          kwargs["model"]          = req.model
    if req.ollama_url:     kwargs["ollama_url"]     = req.ollama_url
    if req.section_counts: kwargs["section_counts"] = req.section_counts
    try:
        return generate_questions(**kwargs)
    except Exception as e:
        _err(f"Question generation failed: {e}", "GENERATION_FAILED")


# ── Combined parse + generate ──────────────────────────────────────────────────

@app.post("/parse-and-generate", tags=["Combined"],
          summary="Upload PDF + optional JD → parse + 18-20 questions in one call")
async def parse_and_generate(
    file: Optional[UploadFile] = File(None),
    job_description: str = Form(""),
    model: str = Form("qwen2.5:0.5b"),
    ollama_url: str = Form("http://localhost:11434"),
):
    parsed: Optional[ParsedResume] = None
    resume_markdown = ""
    if file:
        if not (file.filename or "").lower().endswith(".pdf"):
            _err("Only PDF files are supported.", "INVALID_FILE_TYPE", 400)
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            parsed = parse_pdf(tmp_path)
            resume_markdown = parsed.raw_markdown
        except Exception as e:
            _err(f"PDF parsing failed: {e}", "PARSE_FAILED")
        finally:
            os.unlink(tmp_path)
    if not resume_markdown and not job_description:
        _err("Provide a PDF and/or job_description.", "MISSING_INPUT", 400)
    try:
        script = generate_questions(
            resume_markdown=resume_markdown,
            job_description=job_description,
            model=model,
            ollama_url=ollama_url,
        )
    except Exception as e:
        _err(f"Question generation failed: {e}", "GENERATION_FAILED")
    return {"parsed_resume": parsed, "interview_script": script}


# ── Session endpoints ──────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    candidate_name: str
    job_opening_id: Optional[str] = None
    opening_title: Optional[str] = None   # human-readable title; used as job_opening_id if job_opening_id not set
    interviewer_id: str
    questions: Optional[List[Dict[str, Any]]] = None
    job_description: Optional[str] = ""


@app.post("/session/create", tags=["Session"],
          summary="Create session + generate one-time candidate credentials (NSC-XXXXXX)")
async def create_session(req: CreateSessionRequest):
    session_id = str(uuid.uuid4())

    # Prefer explicit job_opening_id; otherwise derive from opening_title or generate UUID
    if req.job_opening_id:
        job_opening_id = req.job_opening_id
    elif req.opening_title:
        # Slugify the title: lowercase, replace non-alphanumeric with hyphens
        import re as _re
        slug = _re.sub(r"[^a-z0-9]+", "-", req.opening_title.lower()).strip("-")
        job_opening_id = slug[:64] or str(uuid.uuid4())
    else:
        job_opening_id = str(uuid.uuid4())
    # One login_id per opening (shared). Password remains per candidate/session.
    login_id = supabase_client.get_opening_login_id(job_opening_id) or _gen_opening_login_id()
    raw_password   = _gen_password()
    print(f"[NeuroSync][CreateSession] session={session_id} login={login_id} opening={job_opening_id}")
    try:
        print(f"[NeuroSync][CreateSession] Inserting session into Supabase...")
        supabase_client.create_session(
            session_id=session_id,
            candidate_name=req.candidate_name,
            job_opening_id=job_opening_id,
            interviewer_id=req.interviewer_id,
            login_id=login_id,
            questions=req.questions or [],
            job_description=req.job_description or "",
        )
        print(f"[NeuroSync][CreateSession] Session inserted OK. Creating credentials...")
        supabase_client.create_candidate_credentials(
            session_id=session_id,
            login_id=login_id,
            hashed_password=_hash_pw(raw_password),
        )
        print(f"[NeuroSync][CreateSession] Credentials created OK.")
    except Exception as e:
        import traceback
        print(f"[NeuroSync][CreateSession] ERROR: {e}")
        print(traceback.format_exc())
        _err(f"Failed to create session: {e}", "SESSION_CREATE_FAILED")
    return {
        "session_id":     session_id,
        "job_opening_id": job_opening_id,
        "login_id":       login_id,
        "password":       raw_password,
    }


# ── Candidate login ────────────────────────────────────────────────────────────

class CandidateLoginRequest(BaseModel):
    login_id: str
    password: str


@app.post("/candidate/login", tags=["Candidate"],
          summary="Validate one-time credentials → return session_id + questions")
async def candidate_login(req: CandidateLoginRequest):
    login_id = req.login_id.strip()
    creds_list = supabase_client.list_credentials(login_id)
    if not creds_list:
        _err("Invalid login ID.", "INVALID_CREDENTIALS", 401)

    # Find the matching (unused) credential by password
    matched = None
    for c in creds_list:
        if c.get("used"):
            continue
        if _verify_pw(req.password, c.get("hashed_password", "")):
            matched = c
            break
    if not matched:
        _err("Incorrect password.", "INVALID_CREDENTIALS", 401)

    session = supabase_client.get_session(matched["session_id"])
    if not session:
        _err("Session not found.", "SESSION_NOT_FOUND", 404)
    supabase_client.mark_credentials_used(int(matched["id"]))
    return {
        "session_id":      session["session_id"],
        "candidate_name":  session["candidate_name"],
        "job_description": session.get("job_description", ""),
        "questions":       session.get("questions", []),
    }


# ── Post-session processing ───────────────────────────────────────────────────

def _download_to_tmp(url: str, suffix: str) -> str:
    import httpx
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
    with httpx.stream("GET", url, timeout=120.0, follow_redirects=True) as r:
        r.raise_for_status()
        with open(tmp_path, "wb") as out:
            for chunk in r.iter_bytes():
                out.write(chunk)
    return tmp_path


# ── Save response ──────────────────────────────────────────────────────────────

@app.post("/session/{session_id}/save-response", tags=["Session"],
          summary="Upload audio+video to Cloudinary immediately (no local persistence)")
async def save_response(
    session_id:     str                  = Path(...),
    question_id:    str                  = Form(...),
    question_number: int                 = Form(...),
    question_text:  str                  = Form(...),
    ideal_answer:   str                  = Form(...),
    question_stage: str                  = Form("intro"),
    audio_file:     Optional[UploadFile] = File(None),
    video_file:     Optional[UploadFile] = File(None),
):
    print(f"[VidyaAI][SaveResponse] session={session_id} q={question_id} qn={question_number} — uploading to Cloudinary")

    session = supabase_client.get_session(session_id)
    login_id = (session or {}).get("login_id") or "unknown"
    folder = cloudinary_client.build_session_folder(login_id=login_id, session_id=session_id)

    audio_public_id: Optional[str] = None
    video_public_id: Optional[str] = None
    audio_url: Optional[str] = None
    video_url: Optional[str] = None

    if audio_file:
        audio_bytes = await audio_file.read()
        print(f"[VidyaAI][SaveResponse] audio received — {len(audio_bytes)} bytes for q={question_id}")
        if audio_bytes:
            audio_public_id = cloudinary_client.build_public_id(
                login_id=login_id, session_id=session_id, question_number=question_number, kind="audio"
            )
            try:
                resp = _cloudinary_upload_with_retry(
                    data=audio_bytes,
                    public_id=audio_public_id,
                    folder=folder,
                    resource_type="video",
                    session_id=session_id,
                )
                audio_url = resp.get("secure_url") or resp.get("url")
                print(f"[VidyaAI][SaveResponse] audio uploaded → {audio_url}")
            except Exception as e:
                print(f"[VidyaAI][SaveResponse] AUDIO UPLOAD FAILED q={question_id}: {e}")
                supabase_client.log_error("AudioUpload", str(e), session_id)
        else:
            print(f"[VidyaAI][SaveResponse] audio file is empty for q={question_id}")

    if video_file:
        video_bytes = await video_file.read()
        print(f"[VidyaAI][SaveResponse] video received — {len(video_bytes)} bytes for q={question_id}")
        if video_bytes:
            video_public_id = cloudinary_client.build_public_id(
                login_id=login_id, session_id=session_id, question_number=question_number, kind="video"
            )
            try:
                resp = _cloudinary_upload_with_retry(
                    data=video_bytes,
                    public_id=video_public_id,
                    folder=folder,
                    resource_type="video",
                    session_id=session_id,
                )
                video_url = resp.get("secure_url") or resp.get("url")
                print(f"[VidyaAI][SaveResponse] video uploaded → {video_url}")
            except Exception as e:
                print(f"[VidyaAI][SaveResponse] VIDEO UPLOAD FAILED q={question_id}: {e}")
                supabase_client.log_error("VideoUpload", str(e), session_id)
        else:
            print(f"[VidyaAI][SaveResponse] video file is empty for q={question_id}")

    # Upsert placeholder row (or update existing) immediately with Cloudinary pointers.
    try:
        supabase_client.save_question_response(
            session_id=session_id,
            question_id=question_id,
            question_text=question_text,
            ideal_answer=ideal_answer,
            transcript="",
            transcript_flagged=False,
            semantic_score=0.0,
            sentiment={"compound": 0, "pos": 0, "neg": 0, "neu": 1},
            combined_score=0.0,
            technical_score=0,
            communication_score=0,
            behavioral_score=0,
            engagement_score=0,
            authenticity_score=0,
            video_file_id=video_public_id,
            audio_file_id=audio_public_id,
            video_url=video_url,
            audio_url=audio_url,
        )
    except Exception as e:
        print(f"[NeuroSync][SaveResponse] DB upsert failed ({e})")
        supabase_client.log_error("SaveResponseDB", str(e), session_id)
        _err(f"Failed to save response: {e}", "DB_WRITE_FAILED")

    print(f"[VidyaAI][SaveResponse] DONE q={question_id} audio_url={bool(audio_url)} video_url={bool(video_url)}")
    return {"status": "uploaded", "session_id": session_id, "question_id": question_id, "audio_url": audio_url, "video_url": video_url}


# ── Video analysis ─────────────────────────────────────────────────────────────

@app.post("/video/analyze-chunk", tags=["Video"],
          summary="Gaze zone classification + DeepFace emotion + rPPG HRV → Supabase")
async def analyze_video_chunk(
    session_id:   str                  = Form(...),
    question_id:  str                  = Form(...),
    gaze_samples: str                  = Form("[]"),
    video_file:   Optional[UploadFile] = File(None),
):
    print(f"[NeuroSync][VideoChunk] session={session_id} q={question_id}")
    from services.video_analysis.gaze.cheating_detector import detect_cheating
    from services.video_analysis.gaze.zone_classifier import ZoneClassifier

    # Parse gaze samples
    try:
        samples: List[Dict] = json.loads(gaze_samples) if gaze_samples else []
    except json.JSONDecodeError:
        samples = []
    gaze_points = [(float(s["x"]), float(s["y"])) for s in samples if "x" in s]

    # Gaze zone classification
    gaze_zone_distribution: Dict[str, float] = {}
    try:
        clf = ZoneClassifier(session_id)
        zone_counts: Dict[str, int] = {}
        prev = None
        for pt in gaze_points:
            z = clf.classify(pt, prev)
            zone_counts[z] = zone_counts.get(z, 0) + 1
            prev = pt
        total = len(gaze_points) or 1
        gaze_zone_distribution = {z: round(c / total, 4) for z, c in zone_counts.items()}
    except FileNotFoundError:
        zone_counts = {}
        for x, y in gaze_points:
            if y > 0.72:
                z = "red"
            elif y <= 0.55 and abs(x - 0.5) <= 0.30:
                z = "strategic"
            else:
                z = "neutral"
            zone_counts[z] = zone_counts.get(z, 0) + 1
        total = len(gaze_points) or 1
        gaze_zone_distribution = {z: round(c / total, 4) for z, c in zone_counts.items()}
    except Exception as e:
        print(f"[NeuroSync][GazeZone] {e}")
        gaze_zone_distribution = {"neutral": 1.0}

    # Cheating detection — pass calibration baseline if available for personalised thresholds
    try:
        from services.video_analysis.calibration.calibration_runner import load_calibration
        try:
            cal = load_calibration(session_id)
            baseline_var = cal.get("baseline_gaze_variance", 0.004)
        except Exception:
            baseline_var = 0.004
        cheat_result = detect_cheating(gaze_points, baseline_variance=baseline_var)
        cheat_flags = cheat_result if isinstance(cheat_result, dict) else {"raw": str(cheat_result)}
    except Exception as e:
        print(f"[NeuroSync][CheatDetect] {e}")
        cheat_flags = {"risk_level": "low"}

    # Video analysis (emotion + rPPG)
    emotion_distribution: Dict[str, float] = {"neutral": 1.0}
    avg_hrv_rmssd = 42.0
    hr_bpm: Optional[float] = None
    stress_spike = False

    if video_file:
        suffix = os.path.splitext(video_file.filename or "video.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await video_file.read())
            video_tmp = tmp.name
        try:
            from services.video_analysis.emotion_analyzer import analyze_emotions_from_video
            from services.video_analysis.rppg import analyze_rppg_from_video
            emotion_distribution = analyze_emotions_from_video(video_tmp)
            rppg = analyze_rppg_from_video(video_tmp)
            avg_hrv_rmssd = rppg["avg_hrv_rmssd"]
            hr_bpm        = rppg["hr_bpm"]
            stress_spike  = rppg["stress_spike_detected"]
        except Exception as e:
            print(f"[NeuroSync][VideoAnalysis] {e}")
            supabase_client.log_error("VideoAnalysis", str(e), session_id)
        finally:
            os.unlink(video_tmp)

    try:
        record = supabase_client.save_video_signals(
            session_id=session_id,
            question_id=question_id,
            gaze_zone_distribution=gaze_zone_distribution,
            cheat_flags=cheat_flags,
            emotion_distribution=emotion_distribution,
            avg_hrv_rmssd=avg_hrv_rmssd,
            stress_spike_detected=stress_spike,
            hr_bpm=hr_bpm,
        )
    except Exception as e:
        _err(f"Failed to save video signals: {e}", "DB_WRITE_FAILED")
    return {"status": "saved", "record": record}


# ── Scoring ────────────────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    question_id: str
    transcript: str
    ideal_answer: str


@app.post("/score/response", response_model=ResponseScore, tags=["Scoring"],
          summary="Score transcript: semantic + VADER sentiment → combined 0-10")
async def score_candidate_response(req: ScoreRequest):
    if not req.transcript.strip():
        _err("transcript must not be empty.", "MISSING_TRANSCRIPT", 400)
    if not req.ideal_answer.strip():
        _err("ideal_answer must not be empty.", "MISSING_IDEAL_ANSWER", 400)
    try:
        return score_response(req.question_id, req.transcript, req.ideal_answer)
    except Exception as e:
        _err(f"Scoring failed: {e}", "SCORING_FAILED")


# ── Calibration ────────────────────────────────────────────────────────────────

class CalibrationStartResponse(BaseModel):
    session_id: str
    calibration_points: List[List[float]]


class IrisSampleModel(BaseModel):
    x: float
    y: float


class PointMeasurementModel(BaseModel):
    screen_x: float
    screen_y: float
    iris_samples: List[IrisSampleModel]


class CalibrationSubmitRequest(BaseModel):
    session_id: str
    measurements: List[PointMeasurementModel]


class CalibrationSubmitResponse(BaseModel):
    session_id: str
    calibration_quality_score: float
    needs_recalibration: bool
    baseline_gaze_variance: float
    baseline_blink_rate: float
    neurodiversity_adjustment: float


@app.post("/calibration/start", response_model=CalibrationStartResponse, tags=["Calibration"],
          summary="Begin calibration session (optionally tied to an interview session_id)")
async def calibration_start(session_id: Optional[str] = None):
    sid = session_id or str(uuid.uuid4())
    return CalibrationStartResponse(
        session_id=sid,
        calibration_points=[[x, y] for x, y in get_calibration_points()],
    )


@app.post("/calibration/submit", response_model=CalibrationSubmitResponse, tags=["Calibration"],
          summary="Finalise calibration: fit affine transform, save JSON, upload to Cloudinary")
async def calibration_submit(req: CalibrationSubmitRequest):
    if not req.measurements:
        _err("No measurements provided.", "MISSING_MEASUREMENTS", 400)
    measurements = [
        PointMeasurement(
            screen_x=pm.screen_x,
            screen_y=pm.screen_y,
            iris_samples=[IrisSample(x=s.x, y=s.y) for s in pm.iris_samples],
        )
        for pm in req.measurements
    ]
    try:
        result: CalibrationResult = run_calibration(req.session_id, measurements)
    except Exception as e:
        _err(f"Calibration failed: {e}", "CALIBRATION_FAILED")

    cal_path = f"outputs/calibration/{req.session_id}_calibration.json"
    if os.path.exists(cal_path):
        try:
            session = supabase_client.get_session(req.session_id) or {}
            login_id = session.get("login_id") or "unknown"
            folder = cloudinary_client.build_session_folder(login_id=login_id, session_id=req.session_id)
            with open(cal_path, "rb") as f:
                cal_bytes = f.read()
            public_id = f"{login_id}_{req.session_id}_calibration"
            _cloudinary_upload_with_retry(
                data=cal_bytes,
                public_id=public_id,
                folder=folder,
                resource_type="raw",
                session_id=req.session_id,
            )
        except Exception:
            pass
        finally:
            try:
                os.unlink(cal_path)
            except OSError:
                pass

    return CalibrationSubmitResponse(
        session_id=result.session_id,
        calibration_quality_score=result.calibration_quality_score,
        needs_recalibration=result.needs_recalibration,
        baseline_gaze_variance=result.baseline_gaze_variance,
        baseline_blink_rate=result.baseline_blink_rate,
        neurodiversity_adjustment=result.neurodiversity_adjustment,
    )


# ── Finalize (OCEAN pipeline) ──────────────────────────────────────────────────

class FinalizeConfig(BaseModel):
    model:      Optional[str] = None
    ollama_url: Optional[str] = None


@app.post("/session/{session_id}/finalize", tags=["Session"],
          summary="Aggregate all responses → OCEAN scores → role recommendation → Supabase")
async def finalize_session(session_id: str, config: FinalizeConfig = FinalizeConfig()):
    print(f"[VidyaAI][Finalize] START session={session_id}")
    session = supabase_client.get_session(session_id)
    if not session:
        _err(f"Session '{session_id}' not found.", "SESSION_NOT_FOUND", 404)

    from services.database.supabase_client import _get_client
    c = _get_client()
    qr_data = (
        c.table("question_responses").select("*").eq("session_id", session_id).execute()
    ).data or []

    # Reconstruct ResponseScore objects
    scores: List[ResponseScore] = []
    for row in qr_data:
        raw_sent = row.get("sentiment") or {}
        sent = SentimentScores(
            compound=raw_sent.get("compound", 0.0),
            pos=raw_sent.get("pos", 0.0),
            neg=raw_sent.get("neg", 0.0),
            neu=raw_sent.get("neu", 1.0),
        )
        scores.append(ResponseScore(
            question_id=row["question_id"],
            transcript=row.get("transcript", ""),
            semantic_score=row.get("semantic_score", 0.0),
            sentiment=sent,
            engagement_flag=bool(row.get("transcript_flagged", False)),
            combined_score=row.get("combined_score", 0.0),
        ))

    # Build InterviewScript from stored questions
    from services.question_gen.models import AnswerKey, Question
    raw_qs = session.get("questions") or []
    script_qs = [
        Question(
            id=q.get("id", str(uuid.uuid4())),
            stage=q.get("stage", "intro"),
            question=q.get("question", ""),
            time_window_seconds=q.get("time_window_seconds", 75),
            answer_key=AnswerKey(
                critical_keywords=q.get("answer_key", {}).get("critical_keywords", []),
                ideal_sentiment=q.get("answer_key", {}).get("ideal_sentiment", "positive"),
                rubric=q.get("answer_key", {}).get("rubric", ""),
            ),
            ideal_answer=q.get("ideal_answer", ""),
        )
        for q in raw_qs
    ]
    script = InterviewScript(questions=script_qs)

    kwargs: Dict[str, Any] = {
        "scores":          scores,
        "script":          script,
        "job_description": session.get("job_description", ""),
        "session_id":      session_id,
    }
    if config.model:      kwargs["model"]      = config.model
    if config.ollama_url: kwargs["ollama_url"] = config.ollama_url

    print(f"[VidyaAI][Finalize] Building OCEAN report — {len(scores)} responses, {len(script_qs)} questions")
    try:
        report = build_ocean_report(**kwargs)
        print(f"[VidyaAI][Finalize] OCEAN done — job_fit={report.job_fit_score:.1f} prediction={report.success_prediction}")
    except Exception as e:
        print(f"[VidyaAI][Finalize] OCEAN FAILED: {e}")
        _err(f"OCEAN pipeline failed: {e}", "OCEAN_FAILED")

    try:
        supabase_client.save_ocean_scores(
            session_id=session_id,
            openness=report.ocean_scores.openness,
            conscientiousness=report.ocean_scores.conscientiousness,
            extraversion=report.ocean_scores.extraversion,
            agreeableness=report.ocean_scores.agreeableness,
            neuroticism=report.ocean_scores.neuroticism,
            job_fit_score=report.job_fit_score,
            success_prediction=report.success_prediction,
            role_recommendation=report.role_recommendation,
        )
    except Exception as e:
        _err(f"Failed to save OCEAN scores: {e}", "DB_WRITE_FAILED")

    return {
        "session_id":          session_id,
        "ocean_scores":        report.ocean_scores.model_dump(),
        "job_fit_score":       report.job_fit_score,
        "success_prediction":  report.success_prediction,
        "role_recommendation": report.role_recommendation,
        "questions_scored":    report.questions_scored,
    }


# ── Sessions list (admin dashboard) ───────────────────────────────────────────

@app.get("/sessions", tags=["Session"],
         summary="List all sessions ordered by creation date, with OCEAN summaries")
async def list_all_sessions():
    try:
        return supabase_client.list_all_sessions()
    except Exception as e:
        _err(f"Failed to list sessions: {e}", "LIST_SESSIONS_FAILED")


# ── Post-session async transcription ──────────────────────────────────────────

@app.post("/session/{session_id}/transcribe", tags=["Session"],
          summary="Download Cloudinary audio → Whisper → update transcripts (fires after interview ends)")
async def transcribe_session(session_id: str):
    """Downloads each question's audio from Cloudinary, runs Whisper transcription,
    scores with sentence-transformers + VADER, and writes results back to Supabase.
    Called once per session from the candidate thank-you page.
    """
    from services.database.supabase_client import _get_client as _sb
    print(f"[VidyaAI][Transcribe] START session={session_id}")

    c = _sb()
    rows = (
        c.table("question_responses")
        .select("question_id,audio_url,transcript,question_text,ideal_answer")
        .eq("session_id", session_id)
        .execute()
    ).data or []

    print(f"[VidyaAI][Transcribe] Found {len(rows)} question_response rows for session={session_id}")

    updated = 0
    errors: List[str] = []
    for row in rows:
        aurl = row.get("audio_url")
        qid  = row.get("question_id", "?")
        if not aurl:
            print(f"[VidyaAI][Transcribe] q={qid} has no audio_url — skipping")
            continue
        if row.get("transcript", "").strip():
            print(f"[VidyaAI][Transcribe] q={qid} already transcribed — skipping")
            continue

        tmp_path: Optional[str] = None
        try:
            print(f"[VidyaAI][Transcribe] q={qid} — downloading audio from Cloudinary: {aurl[:60]}…")
            tmp_path = _download_to_tmp(aurl, suffix=".webm")
            print(f"[VidyaAI][Transcribe] q={qid} — running Whisper on {os.path.getsize(tmp_path)} bytes")
            transcript, flagged = _transcribe(tmp_path)
            print(f"[VidyaAI][Transcribe] q={qid} — transcript={repr(transcript[:80])} flagged={flagged}")

            supabase_client.update_transcript(
                session_id=session_id,
                question_id=qid,
                transcript=transcript,
                transcript_flagged=flagged,
            )
            updated += 1

            # Score transcript (lightweight — OCEAN pipeline runs in /finalize)
            effective = transcript or "[NO RESPONSE — transcription unavailable]"
            try:
                score: ResponseScore = score_response(qid, effective, row.get("ideal_answer", "") or "")
                supabase_client.save_question_response(
                    session_id=session_id,
                    question_id=qid,
                    question_text=row.get("question_text", "") or "",
                    ideal_answer=row.get("ideal_answer", "") or "",
                    transcript=transcript,
                    transcript_flagged=flagged,
                    semantic_score=score.semantic_score,
                    sentiment=score.sentiment.model_dump(),
                    combined_score=score.combined_score,
                )
                print(f"[VidyaAI][Transcribe] q={qid} scored — semantic={score.semantic_score:.2f} combined={score.combined_score:.2f}")
            except Exception as e:
                print(f"[VidyaAI][Transcribe] q={qid} scoring failed: {e}")
                supabase_client.log_error("TranscribeScore", str(e), session_id)
        except Exception as e:
            err_msg = f"q={qid}: {e}"
            print(f"[VidyaAI][Transcribe] ERROR {err_msg}")
            errors.append(err_msg)
            supabase_client.log_error("Transcribe", err_msg, session_id)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

    print(f"[VidyaAI][Transcribe] DONE session={session_id} — transcribed={updated} errors={len(errors)}")
    return {"session_id": session_id, "transcribed": updated, "errors": errors}


@app.post("/session/{session_id}/process-video", tags=["Session"],
          summary="Download Cloudinary videos → GazeFollower metrics → Supabase")
async def process_video_session(session_id: str):
    """Runs heavier video-only processing after the interview ends.

    - Downloads each question's video_url from Cloudinary
    - Runs GazeFollower (or placeholder) to compute gaze direction metrics
    - Stores results into video_signals.gaze_metrics
    """
    from services.database.supabase_client import _get_client as _sb
    from services.video_analysis.gaze.gazefollower_runner import run_gazefollower_on_video

    c = _sb()
    rows = (
        c.table("question_responses")
        .select("question_id,video_url")
        .eq("session_id", session_id)
        .execute()
    ).data or []

    processed = 0
    errors: List[str] = []
    for row in rows:
        vurl = row.get("video_url")
        if not vurl:
            continue
        try:
            tmp_path = _download_to_tmp(vurl, suffix=".webm")
            metrics = run_gazefollower_on_video(tmp_path)
            supabase_client.update_video_gaze_metrics(
                session_id=session_id,
                question_id=row["question_id"],
                gaze_metrics=metrics,
            )
            processed += 1
        except Exception as e:
            err_msg = f"q={row.get('question_id')}: {e}"
            errors.append(err_msg)
            supabase_client.log_error("ProcessVideo", err_msg, session_id)
        finally:
            try:
                if "tmp_path" in locals() and tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except Exception:
                pass

    return {"session_id": session_id, "processed": processed, "errors": errors}


# ── Reports & recruiter dashboard ─────────────────────────────────────────────

@app.get("/session/{session_id}/report", tags=["Reports"],
         summary="Full joined candidate report for recruiter dashboard")
async def get_session_report(session_id: str):
    try:
        report = supabase_client.get_candidate_full_report(session_id)
        if not report.get("session"):
            _err(f"Session '{session_id}' not found.", "SESSION_NOT_FOUND", 404)
        return report
    except HTTPException:
        raise
    except Exception as e:
        _err(f"Failed to fetch report: {e}", "REPORT_FETCH_FAILED")


@app.get("/opening/{job_opening_id}/candidates", tags=["Reports"],
         summary="All sessions for a job opening with OCEAN summaries")
async def list_candidates(job_opening_id: str):
    try:
        return supabase_client.list_sessions_by_opening(job_opening_id)
    except Exception as e:
        _err(f"Failed to list sessions: {e}", "LIST_SESSIONS_FAILED")


@app.delete("/opening/{job_opening_id}", tags=["Session"],
            summary="Delete opening: delete all sessions (and their media) for this job_opening_id")
async def delete_opening(job_opening_id: str):
    try:
        from services.database.supabase_client import _get_client as _sb

        c = _sb()
        rows = (
            c.table("sessions")
            .select("session_id")
            .eq("job_opening_id", job_opening_id)
            .execute()
        ).data or []
        deleted = 0
        for row in rows:
            sid = row.get("session_id")
            if not sid:
                continue
            try:
                supabase_client.delete_session(sid)
                deleted += 1
            except Exception as e:
                supabase_client.log_error("DeleteOpeningSession", str(e), sid)
        return {"status": "deleted", "job_opening_id": job_opening_id, "sessions_deleted": deleted}
    except Exception as e:
        _err(f"Failed to delete opening: {e}", "DELETE_OPENING_FAILED")


@app.delete("/session/{session_id}", tags=["Session"],
            summary="Delete session: purge all Drive files then all Supabase rows atomically")
async def delete_session(session_id: str):
    try:
        supabase_client.delete_session(session_id)
        return {"status": "deleted", "session_id": session_id}
    except Exception as e:
        _err(f"Failed to delete session: {e}", "DELETE_FAILED")


# ── Fire-and-forget post-session pipeline ─────────────────────────────────────

def _bg_post_session(session_id: str) -> None:
    """Background: transcribe → score → finalize OCEAN → GazeFollower. Runs in daemon thread."""
    print(f"[VidyaAI][PostSession] START session={session_id}")

    from services.database.supabase_client import _get_client as _sb
    c = _sb()

    try:
        # ── Step 1: fetch question_responses rows ──────────────────────────────
        rows = (
            c.table("question_responses")
            .select("question_id,audio_url,transcript,question_text,ideal_answer")
            .eq("session_id", session_id)
            .execute()
        ).data or []

        total_qs = len(rows)
        audio_rows = [r for r in rows if r.get("audio_url")]
        print(f"[VidyaAI][PostSession] {total_qs} questions, {len(audio_rows)} have audio")

        # ── Step 2: transcribe each audio file ─────────────────────────────────
        done = 0
        for row in audio_rows:
            aurl = row.get("audio_url")
            qid  = row.get("question_id", "?")
            if row.get("transcript", "").strip():
                print(f"[VidyaAI][PostSession] q={qid} already transcribed — skip")
                done += 1
                _set_stage(session_id, "transcribing", f"Transcribing audio ({done}/{len(audio_rows)})", done, len(audio_rows))
                continue

            _set_stage(session_id, "transcribing", f"Transcribing audio ({done}/{len(audio_rows)})", done, len(audio_rows))
            tmp_path: Optional[str] = None
            try:
                print(f"[VidyaAI][PostSession] q={qid} downloading audio…")
                tmp_path = _download_to_tmp(aurl, suffix=".webm")
                transcript, flagged = _transcribe(tmp_path)
                print(f"[VidyaAI][PostSession] q={qid} transcribed: {len(transcript)} chars")
                supabase_client.update_transcript(
                    session_id=session_id, question_id=qid,
                    transcript=transcript, transcript_flagged=flagged,
                )
                # Score immediately after transcription
                _set_stage(session_id, "scoring", f"Scoring response {done + 1}/{len(audio_rows)}", done, len(audio_rows))
                try:
                    score: ResponseScore = score_response(qid, transcript or "[NO RESPONSE]", row.get("ideal_answer", "") or "")
                    supabase_client.save_question_response(
                        session_id=session_id, question_id=qid,
                        question_text=row.get("question_text", "") or "",
                        ideal_answer=row.get("ideal_answer", "") or "",
                        transcript=transcript, transcript_flagged=flagged,
                        semantic_score=score.semantic_score,
                        sentiment=score.sentiment.model_dump(),
                        combined_score=score.combined_score,
                    )
                    print(f"[VidyaAI][PostSession] q={qid} scored — semantic={score.semantic_score:.2f} combined={score.combined_score:.2f}")
                except Exception as se:
                    print(f"[VidyaAI][PostSession] q={qid} scoring FAILED: {se}")
                    supabase_client.log_error("PostSessionScore", str(se), session_id)
                done += 1
            except Exception as e:
                print(f"[VidyaAI][PostSession] q={qid} transcription FAILED: {e}")
                supabase_client.log_error("PostSessionTranscribe", str(e), session_id)
                done += 1
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

        # ── Step 3: finalize OCEAN ─────────────────────────────────────────────
        _set_stage(session_id, "finalizing", "Computing OCEAN personality profile…", total_qs, total_qs)
        print(f"[VidyaAI][PostSession] Running OCEAN finalize for session={session_id}")
        try:
            import httpx
            r = httpx.post(
                f"http://localhost:8000/session/{session_id}/finalize",
                json={}, timeout=180.0,
            )
            print(f"[VidyaAI][PostSession] Finalize HTTP status={r.status_code} for session={session_id}")
        except Exception as e:
            print(f"[VidyaAI][PostSession] Finalize FAILED: {e}")
            supabase_client.log_error("PostSessionFinalize", str(e), session_id)

        # ── Step 4: GazeFollower video analysis ────────────────────────────────
        vrows = (
            c.table("question_responses")
            .select("question_id,video_url")
            .eq("session_id", session_id)
            .execute()
        ).data or []
        video_rows = [r for r in vrows if r.get("video_url")]

        if video_rows:
            try:
                from services.video_analysis.gaze.gazefollower_runner import run_gazefollower_on_video
                for vi, vrow in enumerate(video_rows):
                    vurl = vrow.get("video_url")
                    qid  = vrow.get("question_id", "?")
                    _set_stage(session_id, "analyzing_gaze", f"Analyzing gaze video {vi + 1}/{len(video_rows)}", vi, len(video_rows))
                    tmp_v: Optional[str] = None
                    try:
                        print(f"[VidyaAI][PostSession] GazeFollower q={qid} downloading video…")
                        tmp_v = _download_to_tmp(vurl, suffix=".webm")
                        metrics = run_gazefollower_on_video(tmp_v, session_id=session_id)
                        supabase_client.update_video_gaze_metrics(
                            session_id=session_id, question_id=qid, gaze_metrics=metrics,
                        )
                        print(f"[VidyaAI][PostSession] GazeFollower q={qid} OK: status={metrics.get('status')}")
                    except Exception as e:
                        print(f"[VidyaAI][PostSession] GazeFollower q={qid} FAILED: {e}")
                        supabase_client.log_error("PostSessionGaze", str(e), session_id)
                    finally:
                        if tmp_v and os.path.exists(tmp_v):
                            try:
                                os.unlink(tmp_v)
                            except Exception:
                                pass
            except Exception as e:
                print(f"[VidyaAI][PostSession] GazeFollower loop FAILED: {e}")

    finally:
        _clear_stage(session_id)
        print(f"[VidyaAI][PostSession] COMPLETE session={session_id}")


@app.post("/session/{session_id}/process", tags=["Session"],
          summary="Fire background pipeline: Whisper + OCEAN + GazeFollower. Returns 202 immediately.")
async def start_post_session_processing(session_id: str):
    """Called by the thank-you page once all recordings are uploaded.
    Immediately returns 202. Transcription + OCEAN + GazeFollower run in background.
    Poll /session/{id}/status to check when OCEAN results are ready.
    """
    print(f"[VidyaAI][Process] Queuing background pipeline for session={session_id}")
    session = supabase_client.get_session(session_id)
    if not session:
        _err(f"Session '{session_id}' not found.", "SESSION_NOT_FOUND", 404)
    threading.Thread(target=_bg_post_session, args=(session_id,), daemon=True).start()
    return {"status": "processing", "session_id": session_id, "message": "Pipeline started. Poll /session/{id}/status for results."}


# ── Session status (polled by candidate thank-you page) ───────────────────────

@app.get("/session/{session_id}/status", tags=["Session"],
         summary="Check pipeline stage + OCEAN readiness for a session")
async def session_status(session_id: str):
    """Returns live processing stage so the frontend can poll with meaningful labels.

    Response fields:
      status         — "processing" | "ready" | "not_found" | "error"
      stage          — current pipeline stage (only when processing)
      stage_label    — human-readable description of current stage
      stage_done     — items completed in current stage
      stage_total    — total items in current stage
      transcripts_done / questions_total — transcript progress counts
    """
    from services.database.supabase_client import _get_client as _sb
    try:
        c = _sb()
        session = supabase_client.get_session(session_id)
        if not session:
            return {"status": "not_found", "session_id": session_id}

        # ── Check OCEAN ready ──────────────────────────────────────────────────
        ocean_rows = (
            c.table("ocean_reports")
            .select("session_id,job_fit_score,success_prediction")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        ).data or []

        if ocean_rows:
            row = ocean_rows[0]
            print(f"[VidyaAI][Status] {session_id[:8]} READY — job_fit={row.get('job_fit_score')}")
            return {
                "status":             "ready",
                "session_id":         session_id,
                "job_fit_score":      row.get("job_fit_score"),
                "success_prediction": row.get("success_prediction"),
            }

        # ── In-flight stage info ───────────────────────────────────────────────
        with _stages_lock:
            stage_info = _processing_stages.get(session_id, {})

        total_qs = len(session.get("questions") or [])
        done_qs  = (
            c.table("question_responses")
            .select("question_id", count="exact")
            .eq("session_id", session_id)
            .neq("transcript", "")
            .execute()
        ).count or 0

        stage       = stage_info.get("stage", "transcribing")
        stage_label = stage_info.get("label", f"Transcribing audio ({done_qs}/{total_qs})…")
        stage_done  = stage_info.get("done", done_qs)
        stage_total = stage_info.get("total", total_qs)

        print(f"[VidyaAI][Status] {session_id[:8]} PROCESSING — {stage}: {stage_done}/{stage_total}")
        return {
            "status":            "processing",
            "session_id":        session_id,
            "stage":             stage,
            "stage_label":       stage_label,
            "stage_done":        stage_done,
            "stage_total":       stage_total,
            "transcripts_done":  done_qs,
            "questions_total":   total_qs,
        }
    except Exception as e:
        print(f"[VidyaAI][Status] ERROR session={session_id}: {e}")
        return {"status": "error", "session_id": session_id, "detail": str(e)}


# ── Admin: database + media reset ─────────────────────────────────────────────

@app.delete("/admin/reset-database", tags=["Admin"],
            summary="Purge all Supabase data and Cloudinary media. Requires X-Admin-Secret header.")
async def admin_reset_database(x_admin_secret: str = Header(..., alias="X-Admin-Secret")):
    """Full environment reset for development/testing.

    - Validates X-Admin-Secret against the ADMIN_SECRET env variable.
    - Deletes all Cloudinary resources under candidates/ (video + raw).
    - Truncates all Supabase tables in FK-safe order.

    WARNING: irreversible. All candidate data, transcripts, and media will be permanently deleted.
    """
    expected = os.getenv("ADMIN_SECRET", "").strip()
    if not expected:
        _err("ADMIN_SECRET env variable is not set. Cannot perform reset.", "ADMIN_SECRET_NOT_CONFIGURED", 500)
    if x_admin_secret != expected:
        print(f"[VidyaAI][AdminReset] Unauthorised attempt with secret={x_admin_secret[:4]}…")
        _err("Invalid admin secret.", "UNAUTHORIZED", 401)

    print("[VidyaAI][AdminReset] ⚠ FULL DATABASE + MEDIA RESET INITIATED")

    # 1. Delete Cloudinary assets
    cloud_video_deleted = cloudinary_client.delete_by_prefix(prefix="candidates/", resource_type="video")
    cloud_raw_deleted   = cloudinary_client.delete_by_prefix(prefix="candidates/", resource_type="raw")
    print(f"[VidyaAI][AdminReset] Cloudinary: {cloud_video_deleted} video, {cloud_raw_deleted} raw assets deleted")

    # 2. Truncate Supabase tables
    table_results = supabase_client.truncate_all_tables()
    total_rows = sum(v for v in table_results.values() if v >= 0)
    print(f"[VidyaAI][AdminReset] Supabase: {total_rows} total rows deleted across {len(table_results)} tables")

    # 3. Clear any in-flight stage trackers
    with _stages_lock:
        _processing_stages.clear()

    return {
        "status":              "reset_complete",
        "cloudinary_deleted":  {"video": cloud_video_deleted, "raw": cloud_raw_deleted},
        "supabase_tables":     table_results,
    }


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"], summary="Global API health check")
def health():
    return {"status": "ok", "version": app.version}


@app.get("/session/{session_id}/health", tags=["Health"],
         summary="Per-session heartbeat (frontend pings every 30 s)")
async def session_health(session_id: str):
    try:
        session = supabase_client.get_session(session_id)
        if not session:
            return {"status": "not_found", "session_id": session_id}
        return {"status": "healthy", "session_id": session_id}
    except Exception:
        return {"status": "error", "session_id": session_id}
