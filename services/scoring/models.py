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


class CareerMatch(BaseModel):
    """A single career role match from the personality benchmark CSV."""
    role: str
    match_score: float = Field(..., ge=0.0, le=100.0, description="OCEAN proximity score 0-100")


class OceanReport(BaseModel):
    session_id: str
    ocean_scores: OceanScores
    trait_interpretations: Dict[str, str]
    job_fit_score: float = Field(..., ge=0.0, le=100.0)
    semantic_fit_score: float = Field(0.0, ge=0.0, le=100.0, description="Transcript-vs-JD semantic similarity")
    ocean_role_fit: Optional[float] = Field(None, ge=0.0, le=100.0, description="OCEAN distance to matched role benchmark")
    matched_benchmark_role: Optional[str] = Field(None, description="Closest role name from personality.csv")
    career_suggestions: List[CareerMatch] = Field(default_factory=list, description="Top 3 best-fit roles by OCEAN profile")
    success_prediction: Literal["High", "Medium", "Low"]
    role_recommendation: str
    questions_scored: int
    questions_skipped: int
    ocean_confidence: Literal["High", "Medium", "Low"] = "Low"
    # Per-trait data reliability: "full" | "partial" | "limited" | "none"
    # "full"    = 2+ high-signal stage types contributed (e.g. behavioral + technical)
    # "partial" = 1 high-signal stage type contributed
    # "limited" = only intro questions contributed (weak signals)
    # "none"    = zero signals (no questions of any relevant type answered)
    trait_coverage: Dict[str, str] = Field(
        default_factory=lambda: {
            t: "none" for t in
            ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
        },
        description="Reliability level per OCEAN trait based on question-stage mix",
    )
    # Which question stage types were actually answered in this session
    stages_covered: List[str] = Field(
        default_factory=list,
        description="Distinct question stages that had at least one answered question",
    )
