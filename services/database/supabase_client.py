"""Supabase client — all database read/write operations for NeuroSync AI."""

import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from services.database import cloudinary_client

load_dotenv()

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
    }
    r = c.table("video_signals").insert(payload).execute()
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
        c.table("video_signals").insert({
            "session_id": session_id,
            "question_id": question_id,
            "gaze_zone_distribution": {},
            "cheat_flags": {},
            "emotion_distribution": {},
            "avg_hrv_rmssd": 0,
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
) -> Dict[str, Any]:
    c = _get_client()
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
    return {
        "session":            sess.data[0] if sess.data else None,
        "question_responses": qs.data,
        "video_signals":      vs.data,
        "ocean_report":       oc.data[0] if oc.data else None,
    }


def list_all_sessions() -> List[Dict[str, Any]]:
    """List every session ordered by creation date, each enriched with its OCEAN summary."""
    c = _get_client()
    r = (
        c.table("sessions")
        .select("session_id,candidate_name,job_opening_id,login_id,job_description,created_at")
        .order("created_at", desc=True)
        .execute()
    )
    sessions = r.data or []
    for s in sessions:
        oc = (
            c.table("ocean_reports")
            .select("job_fit_score,success_prediction")
            .eq("session_id", s["session_id"])
            .execute()
        )
        s["ocean_summary"] = oc.data[0] if oc.data else None
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
        .select("session_id,candidate_name,job_opening_id,login_id,created_at")
        .eq("job_opening_id", job_opening_id)
        .order("created_at", desc=True)
        .execute()
    )
    # Enrich each session with its OCEAN summary
    sessions = r.data or []
    for s in sessions:
        oc = (
            c.table("ocean_reports")
            .select("job_fit_score,success_prediction,openness,conscientiousness,extraversion,agreeableness,neuroticism")
            .eq("session_id", s["session_id"])
            .execute()
        )
        s["ocean_summary"] = oc.data[0] if oc.data else None
    return sessions


def delete_session(session_id: str) -> None:
    c = _get_client()
    # 1. Collect Cloudinary public_ids from question_responses
    files = (
        c.table("question_responses")
        .select("video_file_id,audio_file_id")
        .eq("session_id", session_id)
        .execute()
    )
    for row in (files.data or []):
        for pid in (row.get("video_file_id"), row.get("audio_file_id")):
            if not pid:
                continue
            # Both audio/video are stored under Cloudinary's "video" resource_type.
            cloudinary_client.destroy(public_id=pid, resource_type="video")
    # 2. Delete Supabase rows (child-first to respect FK constraints)
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
            print(f"[VidyaAI][Reset] Truncated {table}: {results[table]} rows deleted")
        except Exception as e:
            print(f"[VidyaAI][Reset] Failed to truncate {table}: {e}")
            results[table] = -1
    return results


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
