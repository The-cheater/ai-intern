"""NeuroSync AI Interviewer — FastAPI backend (v3.0).

All endpoints return structured JSON errors on failure:
  {"error": "human-readable message", "code": "SCREAMING_SNAKE_CODE"}
"""

import json
import os
import random
import string
import tempfile
import time
import uuid
from functools import lru_cache
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Path, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from services.database import drive_client, supabase_client
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

# ── Whisper (lazy) ─────────────────────────────────────────────────────────────
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


def _gen_password(length: int = 8) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def _drive_upload_with_retry(
    local_path: str,
    filename: str,
    session_folder: str,
    max_retries: int = 3,
    session_id: Optional[str] = None,
) -> str:
    """Upload to Drive with exponential-backoff retries. Logs failures to Supabase."""
    for attempt in range(max_retries):
        try:
            return drive_client.upload_file(local_path, filename, session_folder)
        except Exception as exc:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"[NeuroSync][DriveUpload] attempt {attempt+1}/{max_retries} failed: {exc}. Retrying in {wait:.1f}s")
            if attempt < max_retries - 1:
                time.sleep(wait)
            else:
                supabase_client.log_error("DriveUpload", str(exc), session_id)
                raise


def _transcribe(audio_path: str) -> tuple:
    """Run Whisper on *audio_path*. Returns (transcript: str, flagged: bool)."""
    try:
        model = _get_whisper()
        result = model.transcribe(audio_path, fp16=False)
        return result.get("text", "").strip(), False
    except Exception as exc:
        print(f"[NeuroSync][Whisper] transcription failed: {exc}")
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


@app.post("/generate-questions", response_model=InterviewScript, tags=["Questions"],
          summary="Generate 18-20 interview questions with ideal_answer fields")
async def generate_interview_questions(req: QuestionGenRequest):
    if not req.resume_markdown and not req.job_description:
        _err("Provide resume_markdown and/or job_description.", "MISSING_INPUT", 400)
    kwargs: Dict[str, Any] = {
        "resume_markdown": req.resume_markdown or "",
        "job_description": req.job_description or "",
    }
    if req.model:      kwargs["model"]      = req.model
    if req.ollama_url: kwargs["ollama_url"] = req.ollama_url
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
    interviewer_id: str
    questions: Optional[List[Dict[str, Any]]] = None
    job_description: Optional[str] = ""


@app.post("/session/create", tags=["Session"],
          summary="Create session + generate one-time candidate credentials (NSC-XXXXXX)")
async def create_session(req: CreateSessionRequest):
    session_id     = str(uuid.uuid4())
    job_opening_id = req.job_opening_id or str(uuid.uuid4())
    login_id       = _gen_login_id()
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
    creds = supabase_client.get_credentials(req.login_id.strip())
    if not creds:
        _err("Invalid login ID.", "INVALID_CREDENTIALS", 401)
    if creds.get("used"):
        _err("These credentials have already been used.", "CREDENTIALS_USED", 403)
    if not _verify_pw(req.password, creds["hashed_password"]):
        _err("Incorrect password.", "INVALID_CREDENTIALS", 401)
    session = supabase_client.get_session(creds["session_id"])
    if not session:
        _err("Session not found.", "SESSION_NOT_FOUND", 404)
    supabase_client.mark_credentials_used(req.login_id)
    return {
        "session_id":      session["session_id"],
        "candidate_name":  session["candidate_name"],
        "job_description": session.get("job_description", ""),
        "questions":       session.get("questions", []),
    }


# ── Save response ──────────────────────────────────────────────────────────────

@app.post("/session/{session_id}/save-response", tags=["Session"],
          summary="Upload audio+video → Whisper → score → Drive → Supabase")
async def save_response(
    session_id:     str                  = Path(...),
    question_id:    str                  = Form(...),
    question_text:  str                  = Form(...),
    ideal_answer:   str                  = Form(...),
    question_stage: str                  = Form("intro"),
    audio_file:     Optional[UploadFile] = File(None),
    video_file:     Optional[UploadFile] = File(None),
):
    print(f"[NeuroSync][SaveResponse] session={session_id} q={question_id}")
    audio_file_id: Optional[str] = None
    video_file_id: Optional[str] = None
    transcript = ""
    transcript_flagged = False

    # Upload audio + transcribe
    if audio_file:
        suffix = os.path.splitext(audio_file.filename or "audio.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await audio_file.read())
            audio_tmp = tmp.name
        try:
            transcript, transcript_flagged = _transcribe(audio_tmp)
            fname = audio_file.filename or f"{question_id}_audio{suffix}"
            audio_file_id = _drive_upload_with_retry(audio_tmp, fname, session_id, session_id=session_id)
        except Exception as e:
            supabase_client.log_error("AudioPipeline", str(e), session_id)
        finally:
            os.unlink(audio_tmp)

    # Upload video
    if video_file:
        suffix = os.path.splitext(video_file.filename or "video.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await video_file.read())
            video_tmp = tmp.name
        try:
            fname = video_file.filename or f"{question_id}_video{suffix}"
            video_file_id = _drive_upload_with_retry(video_tmp, fname, session_id, session_id=session_id)
        except Exception as e:
            supabase_client.log_error("VideoUpload", str(e), session_id)
        finally:
            os.unlink(video_tmp)

    # Score transcript
    effective_transcript = transcript or "[NO RESPONSE — transcription unavailable]"
    score: ResponseScore = score_response(question_id, effective_transcript, ideal_answer)

    # LLM per-dimension scoring
    from services.scoring.llm_marker import mark_response as llm_mark
    llm = llm_mark(question_text, ideal_answer, transcript or "", question_stage)

    try:
        record = supabase_client.save_question_response(
            session_id=session_id,
            question_id=question_id,
            question_text=question_text,
            ideal_answer=ideal_answer,
            transcript=transcript,
            transcript_flagged=transcript_flagged,
            semantic_score=score.semantic_score,
            sentiment=score.sentiment.model_dump(),
            combined_score=score.combined_score,
            technical_score=llm["technical"],
            communication_score=llm["communication"],
            behavioral_score=llm["behavioral"],
            engagement_score=llm["engagement"],
            authenticity_score=llm["authenticity"],
            video_file_id=video_file_id,
            audio_file_id=audio_file_id,
        )
    except Exception as e:
        _err(f"Failed to save response: {e}", "DB_WRITE_FAILED")
    return record


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

    # Cheating detection
    try:
        cheat_result = detect_cheating(gaze_points)
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
          summary="Finalise calibration: fit affine transform, save JSON, upload to Drive")
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
            _drive_upload_with_retry(cal_path, f"{req.session_id}_calibration.json",
                                     req.session_id, session_id=req.session_id)
        except Exception:
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
    print(f"[NeuroSync][Finalize] session={session_id}")
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

    try:
        report = build_ocean_report(**kwargs)
    except Exception as e:
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


@app.delete("/session/{session_id}", tags=["Session"],
            summary="Delete session: purge all Drive files then all Supabase rows atomically")
async def delete_session(session_id: str):
    try:
        supabase_client.delete_session(session_id)
        return {"status": "deleted", "session_id": session_id}
    except Exception as e:
        _err(f"Failed to delete session: {e}", "DELETE_FAILED")


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
