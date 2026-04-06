"""Pydantic models representing Supabase table rows for Examiney.AI."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SessionRecord(BaseModel):
    session_id: str
    candidate_name: str
    job_opening_id: str
    interviewer_id: str
    login_id: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None
    job_description: Optional[str] = None
    calibration_data: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None


class QuestionResponse(BaseModel):
    id: Optional[int] = None
    session_id: str
    question_id: str
    question_text: str
    ideal_answer: str
    transcript: str
    transcript_flagged: bool = False
    semantic_score: float
    sentiment: Dict[str, float]        # JSONB: {compound, pos, neg, neu}
    combined_score: float
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    behavioral_score: Optional[float] = None
    engagement_score: Optional[float] = None
    authenticity_score: Optional[float] = None
    video_file_id: Optional[str] = None
    audio_file_id: Optional[str] = None
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    llm_verdict: Optional[str] = None          # "Strong" | "Adequate" | "Weak" | "Off-topic"
    llm_verdict_reason: Optional[str] = None
    llm_key_gaps: List[str] = []
    llm_strengths: List[str] = []
    created_at: Optional[str] = None


class VideoSignalsRecord(BaseModel):
    id: Optional[int] = None
    session_id: str
    question_id: str
    gaze_zone_distribution: Dict[str, float] = {}
    cheat_flags: Dict[str, Any] = {}
    emotion_distribution: Dict[str, float] = {}
    avg_hrv_rmssd: Optional[float] = None      # None when rPPG data is unavailable
    hr_bpm: Optional[float] = None
    gaze_metrics: Dict[str, Any] = {}
    stress_spike_detected: bool = False
    created_at: Optional[str] = None


class OceanReport(BaseModel):
    id: Optional[int] = None
    session_id: str
    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float
    job_fit_score: float
    success_prediction: str            # "High" | "Medium" | "Low"
    role_recommendation: str
    ocean_confidence: str = "Low"      # "High" | "Medium" | "Low"
    trait_coverage: Dict[str, str] = {}   # {trait: "full"|"partial"|"limited"|"none"}
    stages_covered: List[str] = []        # ["intro", "technical", ...]
    created_at: Optional[str] = None
