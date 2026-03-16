from functools import lru_cache

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from .models import ResponseScore, SentimentScores

_vader = SentimentIntensityAnalyzer()

# Probe for sentence_transformers at import time — avoid crashing on Keras 3 / tf_keras conflict
_ST_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer as _ST_class  # noqa: F401
    _ST_AVAILABLE = True
except Exception as _st_err:
    print(f"[VidyaAI][Scorer] sentence_transformers unavailable ({_st_err!r}). "
          "Using keyword-overlap fallback. Run `pip install tf-keras` to enable semantic scoring.")


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


def _keyword_similarity(text: str, ideal: str) -> float:
    """Keyword overlap fallback when sentence-transformers is unavailable."""
    if not ideal.strip():
        return 0.5
    t_words = set(text.lower().split())
    i_words = set(ideal.lower().split())
    overlap = len(t_words & i_words)
    return round(min(1.0, overlap / max(len(i_words), 1)), 4)


def score_response(question_id: str, transcript: str, ideal_answer: str) -> ResponseScore:
    """
    Score a candidate's transcript against the ideal answer.

    Returns a ResponseScore with:
    - semantic_score: cosine similarity (0-1) via all-MiniLM-L6-v2, or keyword overlap fallback
    - sentiment: VADER compound/pos/neg/neu
    - engagement_flag: True if word count < 30 OR semantic_score < 0.25
    - combined_score: (semantic * 0.6 + normalised_compound * 0.4) scaled to 0-10
    """
    transcript = transcript.strip()

    # --- Sentiment (VADER — always available) ---
    raw_sentiment = _vader.polarity_scores(transcript)
    sentiment = SentimentScores(
        compound=raw_sentiment["compound"],
        pos=raw_sentiment["pos"],
        neg=raw_sentiment["neg"],
        neu=raw_sentiment["neu"],
    )

    # --- Semantic similarity ---
    if _ST_AVAILABLE:
        try:
            model = _get_model()
            embeddings = model.encode([transcript, ideal_answer], convert_to_numpy=True)
            semantic_score = _cosine_similarity(embeddings[0], embeddings[1])
        except Exception as e:
            print(f"[VidyaAI][Scorer] SentenceTransformer encode failed ({e}), using keyword fallback.")
            semantic_score = _keyword_similarity(transcript, ideal_answer)
    else:
        semantic_score = _keyword_similarity(transcript, ideal_answer)

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
