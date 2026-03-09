from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional


class SentimentScores(BaseModel):
    compound: float
    pos: float
    neg: float
    neu: float


class ResponseScore(BaseModel):
    question_id: str
    transcript: str
    semantic_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity vs ideal_answer")
    sentiment: SentimentScores
    engagement_flag: bool = Field(..., description="True if response is too short or semantically weak")
    combined_score: float = Field(..., ge=0.0, le=10.0, description="Weighted score 0-10")


class OceanScores(BaseModel):
    openness: float = Field(..., ge=0.0, le=100.0)
    conscientiousness: float = Field(..., ge=0.0, le=100.0)
    extraversion: float = Field(..., ge=0.0, le=100.0)
    agreeableness: float = Field(..., ge=0.0, le=100.0)
    neuroticism: float = Field(..., ge=0.0, le=100.0)


class TraitSignals(BaseModel):
    """Raw signal values collected per trait before final aggregation."""
    openness: List[float] = []
    conscientiousness: List[float] = []
    extraversion: List[float] = []
    agreeableness: List[float] = []
    neuroticism: List[float] = []


class OceanReport(BaseModel):
    session_id: str
    ocean_scores: OceanScores
    trait_interpretations: Dict[str, str]
    job_fit_score: float = Field(..., ge=0.0, le=100.0)
    success_prediction: Literal["High", "Medium", "Low"]
    role_recommendation: str
    questions_scored: int
    questions_skipped: int
