from pydantic import BaseModel
from typing import List, Literal, Optional


class AnswerKey(BaseModel):
    critical_keywords: List[str]
    ideal_sentiment: str
    rubric: str  # "1=poor, 5=adequate, 10=excellent"


class Question(BaseModel):
    id: str
    stage: Literal["intro", "technical", "behavioral", "logical", "situational"]
    question: str
    time_window_seconds: int = 75
    answer_key: AnswerKey
    ideal_answer: str = ""


class InterviewScript(BaseModel):
    job_title: Optional[str] = None
    candidate_name: Optional[str] = None
    questions: List[Question]
