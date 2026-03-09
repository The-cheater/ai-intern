import pytest
from services.scoring.response_scorer import score_response
from services.scoring.models import ResponseScore, SentimentScores

IDEAL = (
    "I led the compression algorithm team at Pied Piper, achieving a world-record Weisman Score. "
    "We optimized both length-limited and adaptive lossless schemas, reducing file sizes by 40%. "
    "I measured success using benchmarked compression ratios and real-time throughput metrics."
)

STRONG_TRANSCRIPT = (
    "At Pied Piper I personally designed the lossless compression algorithm that set the world record "
    "Weisman Score. I optimized the adaptive variant, reducing file sizes by 40 percent and improving "
    "throughput by 3x. I measured every change with benchmarked compression ratios and latency profiling."
)

WEAK_TRANSCRIPT = "I worked on compression stuff. It was good."

SHORT_TRANSCRIPT = "compression algorithm"


# ── Return type ───────────────────────────────────────────────────────────────

def test_returns_response_score():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert isinstance(result, ResponseScore)


def test_question_id_preserved():
    result = score_response("q42", STRONG_TRANSCRIPT, IDEAL)
    assert result.question_id == "q42"


def test_transcript_preserved():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert result.transcript == STRONG_TRANSCRIPT


# ── Semantic score ────────────────────────────────────────────────────────────

def test_semantic_score_range():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert 0.0 <= result.semantic_score <= 1.0


def test_strong_answer_higher_semantic_than_weak():
    strong = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    weak = score_response("q1", WEAK_TRANSCRIPT, IDEAL)
    assert strong.semantic_score > weak.semantic_score


def test_identical_transcript_and_ideal_high_semantic():
    result = score_response("q1", IDEAL, IDEAL)
    assert result.semantic_score >= 0.95


def test_unrelated_transcript_low_semantic():
    unrelated = "I enjoy cooking pasta and hiking on weekends with my dog."
    result = score_response("q1", unrelated, IDEAL)
    assert result.semantic_score < 0.5


# ── Sentiment ─────────────────────────────────────────────────────────────────

def test_sentiment_fields_present():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert isinstance(result.sentiment, SentimentScores)
    assert hasattr(result.sentiment, "compound")
    assert hasattr(result.sentiment, "pos")
    assert hasattr(result.sentiment, "neg")
    assert hasattr(result.sentiment, "neu")


def test_sentiment_compound_range():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert -1.0 <= result.sentiment.compound <= 1.0


def test_positive_text_positive_compound():
    positive = "I am excellent at building great systems and I love solving problems efficiently."
    result = score_response("q1", positive, IDEAL)
    assert result.sentiment.compound > 0


def test_negative_text_negative_compound():
    negative = "Everything was terrible. The project failed miserably and everyone was angry and frustrated."
    result = score_response("q1", negative, IDEAL)
    assert result.sentiment.compound < 0


def test_sentiment_scores_sum_to_one():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    s = result.sentiment
    total = round(s.pos + s.neg + s.neu, 5)
    assert abs(total - 1.0) < 0.01  # VADER pos+neg+neu ≈ 1


# ── Engagement flag ───────────────────────────────────────────────────────────

def test_short_transcript_flags_engagement():
    result = score_response("q1", SHORT_TRANSCRIPT, IDEAL)
    assert result.engagement_flag is True


def test_low_semantic_flags_engagement():
    unrelated = " ".join(["cooking", "pasta", "hiking"] * 15)  # long but off-topic
    result = score_response("q1", unrelated, IDEAL)
    assert result.engagement_flag is True


def test_strong_answer_no_engagement_flag():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert result.engagement_flag is False


def test_word_count_boundary_29_words_flagged():
    transcript = " ".join(["compression"] * 29)
    result = score_response("q1", transcript, IDEAL)
    assert result.engagement_flag is True


def test_word_count_boundary_30_words_not_flagged_by_length():
    # 30 words of on-topic content — flag depends only on semantic_score now
    transcript = " ".join(["lossless", "compression", "algorithm", "Weisman", "score"] * 6)
    result = score_response("q1", transcript, IDEAL)
    # length condition is NOT triggered; engagement_flag driven by semantic only
    word_count = len(transcript.split())
    assert word_count >= 30
    if result.semantic_score >= 0.25:
        assert result.engagement_flag is False


# ── Combined score ────────────────────────────────────────────────────────────

def test_combined_score_range():
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    assert 0.0 <= result.combined_score <= 10.0


def test_strong_answer_higher_combined_than_weak():
    strong = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    weak = score_response("q1", WEAK_TRANSCRIPT, IDEAL)
    assert strong.combined_score > weak.combined_score


def test_combined_score_formula():
    """Verify the formula: (semantic*0.6 + norm_compound*0.4) * 10."""
    result = score_response("q1", STRONG_TRANSCRIPT, IDEAL)
    norm_compound = (result.sentiment.compound + 1) / 2
    expected = round((result.semantic_score * 0.6 + norm_compound * 0.4) * 10, 2)
    assert abs(result.combined_score - expected) < 0.01


def test_perfect_score_ceiling():
    result = score_response("q1", IDEAL, IDEAL)
    assert result.combined_score <= 10.0


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_whitespace_only_transcript_stripped():
    result = score_response("q1", "   ", IDEAL)
    assert result.transcript == ""


def test_unicode_transcript():
    transcript = "La compression sans perte est très efficace dans notre système d'IA."
    result = score_response("q1", transcript, IDEAL)
    assert isinstance(result, ResponseScore)
    assert 0.0 <= result.combined_score <= 10.0
