"""Supabase client — all database read/write operations for Examiney.AI."""

import logging
import os
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from services.database import cloudinary_client

logger = logging.getLogger(__name__)

_URL: str = os.getenv("SUPABASE_URL", "")
_KEY: str = os.getenv("SUPABASE_KEY", "")

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client
    if _client is None:
        if not _URL or not _KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set.")
        _client = create_client(_URL, _KEY)
    return _client


# ── Sessions ───────────────────────────────────────────────────────────────────

def create_session(
    session_id: str,
    candidate_name: str,
    job_opening_id: str,
    interviewer_id: str,
    login_id: str = "",
    questions: Optional[List[Dict]] = None,
    job_description: str = "",
) -> Dict[str, Any]:
    c = _get_client()
    payload = {
        "session_id":     session_id,
        "candidate_name": candidate_name,
        "job_opening_id": job_opening_id,
        "interviewer_id": interviewer_id,
        "login_id":       login_id,
        "questions":      questions or [],
        "job_description": job_description,
    }
    r = c.table("sessions").insert(payload).execute()
    return r.data[0] if r.data else {}


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    c = _get_client()
    r = c.table("sessions").select("*").eq("session_id", session_id).execute()
    return r.data[0] if r.data else None


# ── Candidate credentials ──────────────────────────────────────────────────────

def create_candidate_credentials(
    session_id: str,
    login_id: str,
    hashed_password: str,
) -> None:
    c = _get_client()
    c.table("candidate_credentials").insert({
        "login_id":        login_id,
        "hashed_password": hashed_password,
        "session_id":      session_id,
    }).execute()


def list_credentials(login_id: str) -> List[Dict[str, Any]]:
    c = _get_client()
    r = (
        c.table("candidate_credentials")
        .select("*")
        .eq("login_id", login_id)
        .order("created_at", desc=True)
        .execute()
    )
    return r.data or []


def mark_credentials_used(credential_id: int) -> None:
    c = _get_client()
    c.table("candidate_credentials").update({"used": True}).eq("id", credential_id).execute()


def get_opening_login_id(job_opening_id: str) -> Optional[str]:
    c = _get_client()
    r = (
        c.table("sessions")
        .select("login_id")
        .eq("job_opening_id", job_opening_id)
        .limit(1)
        .execute()
    )
    if r.data and r.data[0].get("login_id"):
        return str(r.data[0]["login_id"])
    return None


# ── Question Responses ─────────────────────────────────────────────────────────

def save_question_response(
    session_id: str,
    question_id: str,
    question_text: str,
    ideal_answer: str,
    transcript: str,
    transcript_flagged: bool,
    semantic_score: float,
    sentiment: Dict[str, float],
    combined_score: float,
    technical_score: Optional[float] = None,
    communication_score: Optional[float] = None,
    behavioral_score: Optional[float] = None,
    engagement_score: Optional[float] = None,
    authenticity_score: Optional[float] = None,
    video_file_id: Optional[str] = None,
    audio_file_id: Optional[str] = None,
    video_url: Optional[str] = None,
    audio_url: Optional[str] = None,
    llm_verdict: Optional[str] = None,
    llm_verdict_reason: Optional[str] = None,
    llm_key_gaps: Optional[list] = None,
    llm_strengths: Optional[list] = None,
) -> Dict[str, Any]:
    c = _get_client()
    payload = {
        "session_id":          session_id,
        "question_id":         question_id,
        "question_text":       question_text,
        "ideal_answer":        ideal_answer,
        "transcript":          transcript,
        "transcript_flagged":  transcript_flagged,
        "semantic_score":      semantic_score,
        "sentiment":           sentiment,
        "combined_score":      combined_score,
        "technical_score":     technical_score,
        "communication_score": communication_score,
        "behavioral_score":    behavioral_score,
        "engagement_score":    engagement_score,
        "authenticity_score":  authenticity_score,
        "video_file_id":       video_file_id,
        "audio_file_id":       audio_file_id,
        "video_url":           video_url,
        "audio_url":           audio_url,
        "llm_verdict":         llm_verdict,
        "llm_verdict_reason":  llm_verdict_reason,
        "llm_key_gaps":        llm_key_gaps or [],
        "llm_strengths":       llm_strengths or [],
    }
    # Upsert so background task can update the placeholder inserted at request-time
    r = c.table("question_responses").upsert(payload, on_conflict="session_id,question_id").execute()
    return r.data[0] if r.data else {}


# ── Video Signals ──────────────────────────────────────────────────────────────

def save_video_signals(
    session_id: str,
    question_id: str,
    gaze_zone_distribution: Dict[str, Any],
    cheat_flags: Dict[str, Any],
    emotion_distribution: Dict[str, Any],
    avg_hrv_rmssd: float,
    stress_spike_detected: bool,
    hr_bpm: Optional[float] = None,
    gaze_metrics: Optional[Dict[str, Any]] = None,  # ← CRITICAL FIX #5: Add full gaze metrics storage
) -> Dict[str, Any]:
    c = _get_client()
    payload = {
        "session_id":             session_id,
        "question_id":            question_id,
        "gaze_zone_distribution": gaze_zone_distribution,
        "cheat_flags":            cheat_flags,
        "emotion_distribution":   emotion_distribution,
        "avg_hrv_rmssd":          avg_hrv_rmssd,
        "hr_bpm":                 hr_bpm,
        "stress_spike_detected":  stress_spike_detected,
        "gaze_metrics":           gaze_metrics or {},  # ← NOW STORED FOR DASHBOARD
    }
    r = c.table("video_signals").upsert(payload, on_conflict="session_id,question_id").execute()
    return r.data[0] if r.data else {}


def update_video_gaze_metrics(
    session_id: str,
    question_id: str,
    gaze_metrics: Dict[str, Any],
) -> None:
    """Best-effort update of gaze_metrics on the most recent video_signals row for a question."""
    c = _get_client()
    rows = (
        c.table("video_signals")
        .select("id")
        .eq("session_id", session_id)
        .eq("question_id", question_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        # No row yet; create a minimal placeholder row.
        # Only include fields that the database requires; omit avg_hrv_rmssd if NULL
        # to avoid NOT NULL constraint violations.
        c.table("video_signals").insert({
            "session_id": session_id,
            "question_id": question_id,
            "gaze_zone_distribution": {},
            "cheat_flags": {},
            "emotion_distribution": {},
            "stress_spike_detected": False,
            "gaze_metrics": gaze_metrics,
        }).execute()
        return
    c.table("video_signals").update({"gaze_metrics": gaze_metrics}).eq("id", rows[0]["id"]).execute()


# ── OCEAN Report ───────────────────────────────────────────────────────────────

def save_ocean_scores(
    session_id: str,
    openness: float,
    conscientiousness: float,
    extraversion: float,
    agreeableness: float,
    neuroticism: float,
    job_fit_score: float,
    success_prediction: str,
    role_recommendation: str,
    ocean_confidence: str = "Low",
    trait_coverage: Optional[Dict[str, Any]] = None,
    stages_covered: Optional[list] = None,
) -> Dict[str, Any]:
    c = _get_client()
    # Only include core required fields to avoid schema cache issues
    # Optional fields (ocean_confidence, trait_coverage, stages_covered) are skipped
    # to prevent "column not found" errors when Supabase schema cache is stale
    payload = {
        "session_id":          session_id,
        "openness":            openness,
        "conscientiousness":   conscientiousness,
        "extraversion":        extraversion,
        "agreeableness":       agreeableness,
        "neuroticism":         neuroticism,
        "job_fit_score":       job_fit_score,
        "success_prediction":  success_prediction,
        "role_recommendation": role_recommendation,
    }
    r = c.table("ocean_reports").upsert(payload, on_conflict="session_id").execute()
    return r.data[0] if r.data else {}


# ── Reports & Queries ──────────────────────────────────────────────────────────

def get_candidate_full_report(session_id: str) -> Dict[str, Any]:
    c = _get_client()
    sess = c.table("sessions").select("*").eq("session_id", session_id).execute()
    qs   = c.table("question_responses").select("*").eq("session_id", session_id).execute()
    vs   = c.table("video_signals").select("*").eq("session_id", session_id).execute()
    oc   = c.table("ocean_reports").select("*").eq("session_id", session_id).execute()

    has_responses = bool(qs.data)

    # If candidate never took the interview, wipe any stale ocean_reports row
    if not has_responses and oc.data:
        c.table("ocean_reports").delete().eq("session_id", session_id).execute()

    return {
        "session":              sess.data[0] if sess.data else None,
        "question_responses":   qs.data,
        "video_signals":        vs.data,
        "ocean_report":         oc.data[0] if (has_responses and oc.data) else None,
        "interview_completed":  has_responses,
    }


def list_all_sessions() -> List[Dict[str, Any]]:
    """List every session ordered by creation date, each enriched with its OCEAN summary."""
    c = _get_client()
    r = (
        c.table("sessions")
        .select("session_id,candidate_name,job_opening_id,login_id,job_description,questions,created_at")
        .order("created_at", desc=True)
        .execute()
    )
    sessions = r.data or []
    if not sessions:
        return sessions

    # Batch-check which sessions have real interview responses (single query)
    session_ids = [s["session_id"] for s in sessions]
    resp_check = (
        c.table("question_responses")
        .select("session_id")
        .in_("session_id", session_ids)
        .execute()
    )
    sessions_with_responses = {row["session_id"] for row in (resp_check.data or [])}

    # Batch-fetch ALL OCEAN summaries in one query
    responded_ids = list(sessions_with_responses)
    ocean_map: Dict[str, Any] = {}
    if responded_ids:
        oc_batch = (
            c.table("ocean_reports")
            .select("session_id,job_fit_score,success_prediction")
            .in_("session_id", responded_ids)
            .execute()
        )
        for row in (oc_batch.data or []):
            ocean_map[row["session_id"]] = row

    for s in sessions:
        sid = s["session_id"]
        if sid not in sessions_with_responses:
            s["ocean_summary"] = None
            continue
        s["ocean_summary"] = ocean_map.get(sid)
    return sessions


def update_transcript(
    session_id: str,
    question_id: str,
    transcript: str,
    transcript_flagged: bool,
) -> None:
    c = _get_client()
    c.table("question_responses").update({
        "transcript":        transcript,
        "transcript_flagged": transcript_flagged,
    }).eq("session_id", session_id).eq("question_id", question_id).execute()


def list_sessions_by_opening(job_opening_id: str) -> List[Dict[str, Any]]:
    c = _get_client()
    r = (
        c.table("sessions")
        .select("session_id,candidate_name,job_opening_id,login_id,questions,job_description,created_at")
        .eq("job_opening_id", job_opening_id)
        .order("created_at", desc=True)
        .execute()
    )
    sessions = r.data or []
    if not sessions:
        return sessions

    # Batch-check which sessions have real interview responses (single query)
    session_ids = [s["session_id"] for s in sessions]
    resp_check = (
        c.table("question_responses")
        .select("session_id")
        .in_("session_id", session_ids)
        .execute()
    )
    sessions_with_responses = {row["session_id"] for row in (resp_check.data or [])}

    # Wipe stale ocean_reports for sessions that were never taken
    never_interviewed = [s["session_id"] for s in sessions if s["session_id"] not in sessions_with_responses]
    for sid in never_interviewed:
        c.table("ocean_reports").delete().eq("session_id", sid).execute()

    # Batch-fetch ALL OCEAN summaries in one query
    responded_ids = list(sessions_with_responses)
    ocean_map: Dict[str, Any] = {}
    if responded_ids:
        oc_batch = (
            c.table("ocean_reports")
            .select("session_id,job_fit_score,success_prediction,openness,conscientiousness,extraversion,agreeableness,neuroticism")
            .in_("session_id", responded_ids)
            .execute()
        )
        for row in (oc_batch.data or []):
            ocean_map[row["session_id"]] = row

    # Enrich each session with its OCEAN summary — only if interview was actually taken
    for s in sessions:
        sid = s["session_id"]
        if sid not in sessions_with_responses:
            s["ocean_summary"] = None
            continue
        s["ocean_summary"] = ocean_map.get(sid)
    return sessions


def delete_session(session_id: str) -> None:
    c = _get_client()

    # 1. Get session to build folder prefix for Cloudinary
    sess_row = c.table("sessions").select("login_id").eq("session_id", session_id).execute()
    login_id = (sess_row.data[0].get("login_id") or "unknown") if sess_row.data else "unknown"

    # 2. Delete all Cloudinary media for this session using folder prefix (catches everything)
    folder_prefix = cloudinary_client.build_session_folder(login_id=login_id, session_id=session_id)
    cloudinary_client.delete_by_prefix(prefix=folder_prefix, resource_type="video")
    cloudinary_client.delete_by_prefix(prefix=folder_prefix, resource_type="raw")

    # 3. Belt-and-suspenders: also destroy any individually tracked file IDs
    files = (
        c.table("question_responses")
        .select("video_file_id,audio_file_id")
        .eq("session_id", session_id)
        .execute()
    )
    for row in (files.data or []):
        for pid in (row.get("video_file_id"), row.get("audio_file_id")):
            if pid:
                cloudinary_client.destroy(public_id=pid, resource_type="video")

    # 4. Delete Supabase rows (child-first to respect FK constraints)
    c.table("video_signals").delete().eq("session_id", session_id).execute()
    c.table("ocean_reports").delete().eq("session_id", session_id).execute()
    c.table("question_responses").delete().eq("session_id", session_id).execute()
    c.table("candidate_credentials").delete().eq("session_id", session_id).execute()
    c.table("sessions").delete().eq("session_id", session_id).execute()


# ── Admin: bulk reset ──────────────────────────────────────────────────────────

def truncate_all_tables() -> Dict[str, int]:
    """Delete every row from all tables in FK-safe order.

    Returns a dict of {table_name: rows_deleted} for logging.
    Uses PostgREST filters that match all real rows (no blank/null PKs exist).
    """
    c = _get_client()
    results: Dict[str, int] = {}

    # (table, column_used_as_filter, filter_type)
    # "id_gte0"  → .gte("id", 0)      — works for BIGSERIAL PKs
    # "sid_neq"  → .neq("session_id", "~~reset~~")  — works for TEXT PKs
    specs = [
        ("error_logs",            "id",         "id_gte0"),
        ("video_signals",         "id",         "id_gte0"),
        ("ocean_reports",         "session_id", "sid_neq"),
        ("question_responses",    "id",         "id_gte0"),
        ("candidate_credentials", "id",         "id_gte0"),
        ("sessions",              "session_id", "sid_neq"),
    ]
    for table, col, mode in specs:
        try:
            if mode == "id_gte0":
                r = c.table(table).delete().gte(col, 0).execute()
            else:
                r = c.table(table).delete().neq(col, "~~reset~~").execute()
            results[table] = len(r.data or [])
            logger.info(f"[Examiney][Reset] Truncated {table}: {results[table]} rows deleted")
        except Exception as e:
            logger.error(f"[Examiney][Reset] Failed to truncate {table}: {e}")
            results[table] = -1
    return results


# ── Calibration Data ──────────────────────────────────────────────────────────

def save_calibration_data(session_id: str, data: dict) -> None:
    """Persist calibration result as JSONB on the session row.
    Automatically cleaned up when the session is deleted.
    """
    c = _get_client()
    c.table("sessions").update({"calibration_data": data}).eq("session_id", session_id).execute()


def get_calibration_data(session_id: str) -> dict:
    """Retrieve calibration data for *session_id* from Supabase.
    Raises FileNotFoundError (same contract as the old file-based API) when absent.
    """
    c = _get_client()
    r = c.table("sessions").select("calibration_data").eq("session_id", session_id).execute()
    if r.data and r.data[0].get("calibration_data"):
        return r.data[0]["calibration_data"]
    raise FileNotFoundError(f"No calibration data found for session '{session_id}'.")


# ── Error logging ──────────────────────────────────────────────────────────────

def log_error(
    service: str,
    error_message: str,
    session_id: Optional[str] = None,
) -> None:
    try:
        c = _get_client()
        c.table("error_logs").insert({
            "session_id":    session_id,
            "service":       service,
            "error_message": error_message,
        }).execute()
    except Exception:
        pass  # never let error logging crash the pipeline
