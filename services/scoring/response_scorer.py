import logging
import re
from functools import lru_cache

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from .models import ResponseScore, SentimentScores

logger = logging.getLogger(__name__)

_vader = SentimentIntensityAnalyzer()

# Probe for sentence_transformers at import time
_ST_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer as _ST_class  # noqa: F401
    _ST_AVAILABLE = True
except Exception as _st_err:
    logger.warning(f"[Examiney][Scorer] sentence_transformers unavailable ({_st_err!r}). "
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
    """Jaccard overlap fallback when sentence-transformers is unavailable.

    Uses union denominator (Jaccard) instead of len(ideal) so the score is
    symmetric and doesn't inflate when the transcript parrots the ideal verbatim.
    Stops words shorter than 3 chars to skip articles/prepositions.
    """
    if not ideal.strip():
        return 0.0
    t_words = {w for w in text.lower().split() if len(w) > 2}
    i_words = {w for w in ideal.lower().split() if len(w) > 2}
    if not i_words:
        return 0.0
    intersection = t_words & i_words
    union = t_words | i_words
    return round(len(intersection) / max(len(union), 1), 4)


_EMPTY_MARKERS = {
    "", "[no response]", "[no response — transcription unavailable]",
    "[no response]", "no response", "silence",
    "[no audio recorded]",    # placeholder set when Whisper fails/times out
    "[no audio]",
}

# Known Whisper hallucination phrases — generated on silence or noise
_WHISPER_HALLUCINATIONS = {
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "see you in the next video",
    "don't forget to subscribe",
    "click the bell",
    "in the next episode",
    "music playing",
    "applause",
    "background music",
    "subtitles by",
    "transcribed by",
    "captions by",
    "www.",
    ".com",
    "http",
}


def _is_whisper_hallucination_phrase(text: str) -> bool:
    """Catch known Whisper hallucination phrases beyond mixed-script detection."""
    lower = text.lower().strip()
    return any(phrase in lower for phrase in _WHISPER_HALLUCINATIONS)


def _has_mixed_scripts(text: str) -> bool:
    """Return True if text contains characters from 2+ Unicode script families."""
    scripts = sum([
        bool(re.search(r"[a-zA-Z]",           text)),
        bool(re.search(r"[\u0400-\u04FF]",    text)),   # Cyrillic
        bool(re.search(r"[\u0370-\u03FF]",    text)),   # Greek
        bool(re.search(r"[\u0600-\u06FF]",    text)),   # Arabic
        bool(re.search(r"[\u0900-\u097F]",    text)),   # Devanagari
        bool(re.search(r"[\u4E00-\u9FFF\u3040-\u309F\uAC00-\uD7AF]", text)),  # CJK/JP/KR
        bool(re.search(r"[\u0590-\u05FF]",    text)),   # Hebrew
    ])
    return scripts >= 2


def _depth_penalty(word_count: int, semantic_score: float, stage: str = "") -> float:
    """Apply a depth penalty scaled to the question stage.

    Intro questions are conversational (lower bar).
    Technical/logical/behavioral need substantive depth.

    Thresholds:
      intro      : 20/35/60 words
      other      : 30/50/80 words
    """
    if stage == "intro":
        low, mid, ok = 20, 35, 60
    else:
        low, mid, ok = 30, 50, 80

    if word_count < low:
        return min(semantic_score, 0.30)
    if word_count < mid:
        return semantic_score * 0.70
    if word_count < ok:
        return semantic_score * 0.85
    return semantic_score


def _zero_score(question_id: str, transcript: str) -> ResponseScore:
    """Return a hard-zero ResponseScore for empty/hallucinated/skipped answers."""
    return ResponseScore(
        question_id=question_id,
        transcript=transcript,
        semantic_score=0.0,
        sentiment=SentimentScores(compound=0.0, pos=0.0, neg=0.0, neu=1.0),
        engagement_flag=True,
        combined_score=0.0,
    )


def score_response(question_id: str, transcript: str, ideal_answer: str, stage: str = "") -> ResponseScore:
    """
    Score a candidate's transcript against the ideal answer.

    Hard rules (applied before any ML scoring):
    - Empty transcript or placeholder   -> 0.0/10
    - Word count < 5                    -> 0.0/10
    - Mixed Unicode scripts (Whisper hallucination) -> 0.0/10
    - Known Whisper hallucination phrase -> 0.0/10

    Scoring:
    - semantic_score: cosine similarity via all-MiniLM-L6-v2, or keyword overlap fallback
    - depth_penalty:  caps or scales score for shallow responses (< 80 words)
    - combined_score: semantic (90%) + sentiment nudge (10%, only when content is strong)
      VADER is kept as a tiny signal only — professional interview answers are
      inherently neutral-toned, so sentiment carries very little diagnostic value.
      At 10% weight it adds marginal signal without distorting the semantic score.

    engagement_flag: True when answer is likely weak (< 50 words OR semantic < 0.20)
    """
    transcript = transcript.strip()

    # Hard zero: no real content
    if not transcript or transcript.lower() in _EMPTY_MARKERS:
        return _zero_score(question_id, transcript)

    # Whisper hallucination guard: mixed-script garbage
    if _has_mixed_scripts(transcript):
        logger.warning(f"[Examiney][Scorer] q={question_id} mixed-script hallucination, scoring as 0")
        return _zero_score(question_id, transcript)

    # Whisper hallucination guard: known garbage phrases
    if _is_whisper_hallucination_phrase(transcript):
        logger.warning(f"[Examiney][Scorer] q={question_id} known Whisper hallucination phrase, scoring as 0")
        return _zero_score(question_id, transcript)

    word_count = len([w for w in transcript.split() if len(w) > 1])
    if word_count < 5:
        logger.warning(f"[Examiney][Scorer] q={question_id} too few words ({word_count}), scoring as 0")
        return _zero_score(question_id, transcript)

    # Sentiment (kept for record-keeping and OCEAN signals, minimal scoring weight)
    raw_sentiment = _vader.polarity_scores(transcript)
    sentiment = SentimentScores(
        compound=raw_sentiment["compound"],
        pos=raw_sentiment["pos"],
        neg=raw_sentiment["neg"],
        neu=raw_sentiment["neu"],
    )

    # Semantic similarity
    if _ST_AVAILABLE:
        try:
            model = _get_model()
            embeddings = model.encode([transcript, ideal_answer], convert_to_numpy=True)
            semantic_score = _cosine_similarity(embeddings[0], embeddings[1])
        except Exception as e:
            logger.warning(f"[Examiney][Scorer] SentenceTransformer failed ({e}), using keyword fallback.")
            semantic_score = _keyword_similarity(transcript, ideal_answer)
    else:
        semantic_score = _keyword_similarity(transcript, ideal_answer)

    semantic_score = round(max(0.0, min(1.0, semantic_score)), 4)

    # Depth penalty: shallow answers cannot score high even with good semantic match
    penalised_semantic = _depth_penalty(word_count, semantic_score, stage)

    # Engagement flag: flags genuinely weak responses (recruiter sees this in UI)
    engagement_flag = word_count < 50 or penalised_semantic < 0.20

    # Combined score (0-10):
    # Semantic carries 90% — it is the primary accuracy signal.
    # VADER sentiment carries 10% as a very small confidence nudge,
    # and ONLY when real content exists (semantic >= 0.15) to prevent
    # neutral-sentiment inflation on near-empty answers.
    if penalised_semantic >= 0.15:
        normalised_compound = (sentiment.compound + 1) / 2   # [-1,1] -> [0,1]
        combined_score = (penalised_semantic * 0.90 + normalised_compound * 0.10) * 10
    else:
        combined_score = penalised_semantic * 10

    combined_score = round(max(0.0, min(10.0, combined_score)), 2)

    return ResponseScore(
        question_id=question_id,
        transcript=transcript,
        semantic_score=semantic_score,        # raw (pre-penalty) for OCEAN signal use
        sentiment=sentiment,
        engagement_flag=engagement_flag,
        combined_score=combined_score,        # depth-penalised final score
    )
