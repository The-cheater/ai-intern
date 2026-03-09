from functools import lru_cache

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from .models import ResponseScore, SentimentScores

_vader = SentimentIntensityAnalyzer()


@lru_cache(maxsize=1)
def _get_model():
    """Load SentenceTransformer once and cache it."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def score_response(question_id: str, transcript: str, ideal_answer: str) -> ResponseScore:
    """
    Score a candidate's transcript against the ideal answer.

    Returns a ResponseScore with:
    - semantic_score: cosine similarity (0-1) via all-MiniLM-L6-v2
    - sentiment: VADER compound/pos/neg/neu
    - engagement_flag: True if word count < 30 OR semantic_score < 0.25
    - combined_score: (semantic * 0.6 + normalised_compound * 0.4) scaled to 0-10
    """
    transcript = transcript.strip()

    # --- Sentiment (VADER) ---
    raw_sentiment = _vader.polarity_scores(transcript)
    sentiment = SentimentScores(
        compound=raw_sentiment["compound"],
        pos=raw_sentiment["pos"],
        neg=raw_sentiment["neg"],
        neu=raw_sentiment["neu"],
    )

    # --- Semantic similarity (SentenceTransformer) ---
    model = _get_model()
    embeddings = model.encode([transcript, ideal_answer], convert_to_numpy=True)
    semantic_score = _cosine_similarity(embeddings[0], embeddings[1])
    semantic_score = round(max(0.0, min(1.0, semantic_score)), 4)

    # --- Engagement flag ---
    word_count = len(transcript.split())
    engagement_flag = word_count < 30 or semantic_score < 0.25

    # --- Combined score (0-10) ---
    normalised_compound = (sentiment.compound + 1) / 2  # maps [-1,1] → [0,1]
    combined_score = (semantic_score * 0.6 + normalised_compound * 0.4) * 10
    combined_score = round(max(0.0, min(10.0, combined_score)), 2)

    return ResponseScore(
        question_id=question_id,
        transcript=transcript,
        semantic_score=semantic_score,
        sentiment=sentiment,
        engagement_flag=engagement_flag,
        combined_score=combined_score,
    )
