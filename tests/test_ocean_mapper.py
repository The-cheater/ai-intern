"""Tests for services/scoring/ocean_mapper.py — all Qwen/Ollama calls are mocked."""
import json
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from services.scoring.models import OceanReport, OceanScores, ResponseScore, SentimentScores
from services.scoring.ocean_mapper import (
    _aggregate,
    _cooperative_ratio,
    _extract_signals,
    _interpret,
    _predict_success,
    _sentence_count,
    _stress_score,
    _unique_word_ratio,
    build_ocean_report,
)
from services.question_gen.models import AnswerKey, InterviewScript, Question


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_score(qid: str, transcript: str, semantic: float, compound: float,
                pos: float = 0.1, neg: float = 0.0, neu: float = 0.9,
                engagement: bool = False, combined: float = 5.0) -> ResponseScore:
    return ResponseScore(
        question_id=qid,
        transcript=transcript,
        semantic_score=semantic,
        sentiment=SentimentScores(compound=compound, pos=pos, neg=neg, neu=neu),
        engagement_flag=engagement,
        combined_score=combined,
    )


def _make_question(qid: str, stage: str) -> Question:
    return Question(
        id=qid,
        stage=stage,
        question=f"Question {qid}",
        time_window_seconds=90,
        answer_key=AnswerKey(
            critical_keywords=["keyword"],
            ideal_sentiment="confident",
            rubric="1=poor, 10=excellent",
        ),
        ideal_answer="Gold standard answer here.",
    )


@pytest.fixture
def sample_script() -> InterviewScript:
    return InterviewScript(
        job_title="Software Engineer",
        candidate_name="Test Candidate",
        questions=[
            _make_question("q1", "intro"),
            _make_question("q2", "intro"),
            _make_question("q3", "logical"),
            _make_question("q4", "logical"),
            _make_question("q5", "behavioral"),
            _make_question("q6", "behavioral"),
            _make_question("q7", "situational"),
        ],
    )


STRONG_INTRO = "I have five years leading teams at scale and I am very proud of our collaborative outcomes."
LOGICAL_RESPONSE = "The algorithm uses dynamic programming to solve the subproblem optimally. It runs in O(n log n) time."
BEHAVIORAL_RESPONSE = "We worked together as a team to support our colleagues and I helped coordinate the project."
SITUATIONAL_RESPONSE = "I would first assess the situation. Then I would consult the team. After that I would design a creative solution. Finally I would measure the outcome carefully."


@pytest.fixture
def sample_scores() -> list:
    return [
        _make_score("q1", STRONG_INTRO, 0.75, 0.60, pos=0.25, neg=0.0, engagement=False),
        _make_score("q2", STRONG_INTRO, 0.70, 0.55, pos=0.22, neg=0.0, engagement=False),
        _make_score("q3", LOGICAL_RESPONSE, 0.80, 0.10, pos=0.10, neg=0.0),
        _make_score("q4", LOGICAL_RESPONSE, 0.75, 0.10, pos=0.10, neg=0.0),
        _make_score("q5", BEHAVIORAL_RESPONSE, 0.60, 0.30, pos=0.20, neg=0.05),
        _make_score("q6", BEHAVIORAL_RESPONSE, 0.55, 0.25, pos=0.18, neg=0.05),
        _make_score("q7", SITUATIONAL_RESPONSE, 0.40, 0.20, pos=0.15, neg=0.0),
    ]


MOCK_RECOMMENDATION = (
    "This candidate shows strong logical ability and collaborative tendencies that align well with "
    "the Software Engineer role. Their strongest trait is Conscientiousness while their weakest "
    "is Extraversion, suggesting they excel in focused technical work but may need support in "
    "client-facing communication."
)


def _mock_ollama_response(text: str) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"message": {"content": text}}
    mock_resp.raise_for_status.return_value = None
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    return mock_client


# ── Feature extractor tests ───────────────────────────────────────────────────

def test_unique_word_ratio_all_unique():
    assert _unique_word_ratio("the cat sat on") == 1.0


def test_unique_word_ratio_all_same():
    assert _unique_word_ratio("cat cat cat cat") == 0.25


def test_unique_word_ratio_empty():
    assert _unique_word_ratio("") == 0.0


def test_cooperative_ratio_has_keywords():
    score = _cooperative_ratio("we worked together as a team to support each other")
    assert score > 0.0


def test_cooperative_ratio_no_keywords():
    assert _cooperative_ratio("I solved the problem alone quickly") == 0.0


def test_sentence_count_basic():
    assert _sentence_count("Hello world. How are you? I am fine!") == 3


def test_sentence_count_single():
    assert _sentence_count("No punctuation here") == 1


def test_stress_score_high_neg_sentiment():
    score = _make_score("q1", "t", 0.5, -0.8, neg=0.5, engagement=True)
    s = _stress_score(score)
    assert s > 0.5


def test_stress_score_calm():
    score = _make_score("q1", "t", 0.8, 0.6, neg=0.0, engagement=False)
    s = _stress_score(score)
    assert s < 0.2


# ── Signal extraction per stage ───────────────────────────────────────────────

def test_intro_populates_extraversion_and_neuroticism():
    score = _make_score("q1", STRONG_INTRO, 0.7, 0.6, pos=0.3, engagement=False)
    sig = _extract_signals(score, "intro")
    assert len(sig.extraversion) == 1
    assert len(sig.neuroticism) == 1
    assert len(sig.openness) == 0


def test_intro_low_engagement_reduces_extraversion():
    engaged = _make_score("q1", STRONG_INTRO, 0.7, 0.6, pos=0.3, engagement=False)
    flagged = _make_score("q1", STRONG_INTRO, 0.7, 0.6, pos=0.3, engagement=True)
    sig_e = _extract_signals(engaged, "intro")
    sig_f = _extract_signals(flagged, "intro")
    assert sig_e.extraversion[0] > sig_f.extraversion[0]


def test_logical_populates_conscientiousness_and_openness():
    score = _make_score("q3", LOGICAL_RESPONSE, 0.80, 0.1)
    sig = _extract_signals(score, "logical")
    assert len(sig.conscientiousness) == 1
    assert len(sig.openness) == 1
    assert len(sig.extraversion) == 0


def test_behavioral_populates_agreeableness_and_neuroticism():
    score = _make_score("q5", BEHAVIORAL_RESPONSE, 0.6, 0.3, neg=0.05)
    sig = _extract_signals(score, "behavioral")
    assert len(sig.agreeableness) == 1
    assert len(sig.neuroticism) == 1


def test_behavioral_cooperative_keywords_boost_agreeableness():
    coop = _make_score("q5", BEHAVIORAL_RESPONSE, 0.6, 0.3)
    solo = _make_score("q5", "I fixed the bug by myself quickly and efficiently.", 0.6, 0.3)
    sig_coop = _extract_signals(coop, "behavioral")
    sig_solo = _extract_signals(solo, "behavioral")
    assert sig_coop.agreeableness[0] > sig_solo.agreeableness[0]


def test_situational_populates_openness_and_conscientiousness():
    score = _make_score("q7", SITUATIONAL_RESPONSE, 0.35, 0.2)
    sig = _extract_signals(score, "situational")
    assert len(sig.openness) == 1
    assert len(sig.conscientiousness) == 1


def test_situational_low_similarity_high_wordcount_raises_openness():
    creative = _make_score("q7", SITUATIONAL_RESPONSE * 3, 0.10, 0.2)
    generic = _make_score("q7", SITUATIONAL_RESPONSE, 0.90, 0.2)
    sig_c = _extract_signals(creative, "situational")
    sig_g = _extract_signals(generic, "situational")
    assert sig_c.openness[0] > sig_g.openness[0]


# ── Aggregation ───────────────────────────────────────────────────────────────

def test_aggregate_empty_returns_default():
    assert _aggregate([]) == 0.4


def test_aggregate_single():
    assert _aggregate([0.8]) == 0.8


def test_aggregate_later_values_weighted_higher():
    result = _aggregate([0.2, 0.8])
    assert result > 0.5  # 0.8 gets weight 2, should dominate


def test_aggregate_all_same():
    assert abs(_aggregate([0.5, 0.5, 0.5]) - 0.5) < 0.001


# ── Interpret ─────────────────────────────────────────────────────────────────

def test_interpret_high():
    msg = _interpret("openness", 75.0)
    assert "High" in msg or "Creative" in msg


def test_interpret_low():
    msg = _interpret("conscientiousness", 20.0)
    assert "Low" in msg or "spontan" in msg.lower()


def test_interpret_moderate():
    msg = _interpret("extraversion", 55.0)
    assert "Moderate" in msg or "Balanced" in msg or "Comfortable" in msg


def test_interpret_all_traits():
    for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]:
        for score in [10.0, 50.0, 80.0]:
            msg = _interpret(trait, score)
            assert isinstance(msg, str) and len(msg) > 10


# ── Success prediction ────────────────────────────────────────────────────────

def test_predict_high():
    ocean = OceanScores(openness=70, conscientiousness=72, extraversion=68, agreeableness=70, neuroticism=25)
    assert _predict_success(ocean, 75.0) == "High"


def test_predict_low():
    ocean = OceanScores(openness=20, conscientiousness=18, extraversion=15, agreeableness=20, neuroticism=80)
    assert _predict_success(ocean, 30.0) == "Low"


def test_predict_medium_border():
    ocean = OceanScores(openness=45, conscientiousness=45, extraversion=45, agreeableness=45, neuroticism=55)
    pred = _predict_success(ocean, 55.0)
    assert pred in ("Medium", "High")


# ── build_ocean_report ────────────────────────────────────────────────────────

def test_build_ocean_report_returns_report(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="test01")
    assert isinstance(report, OceanReport)


def test_build_ocean_report_all_ocean_scores_in_range(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="test02")
    for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]:
        val = getattr(report.ocean_scores, trait)
        assert 0.0 <= val <= 100.0, f"{trait}={val} out of range"


def test_build_ocean_report_interpretations_all_traits(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="test03")
    assert set(report.trait_interpretations.keys()) == {
        "openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"
    }


def test_build_ocean_report_success_prediction_valid(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="test04")
    assert report.success_prediction in ("High", "Medium", "Low")


def test_build_ocean_report_saves_json(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="savejson")
    saved = tmp_path / "session_savejson_ocean_report.json"
    assert saved.exists()
    with open(saved) as f:
        data = json.load(f)
    assert data["session_id"] == "savejson"
    assert "ocean_scores" in data
    assert "job_fit_score" in data


def test_build_ocean_report_counts_skipped(sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    scores_with_skip = [
        _make_score("q1", STRONG_INTRO, 0.7, 0.5),
        _make_score("q2", "[NO RESPONSE — candidate was silent]", 0.0, 0.0, engagement=True),
        _make_score("q3", LOGICAL_RESPONSE, 0.8, 0.1),
        _make_score("q4", "", 0.0, 0.0, engagement=True),
        _make_score("q5", BEHAVIORAL_RESPONSE, 0.6, 0.3),
        _make_score("q6", BEHAVIORAL_RESPONSE, 0.55, 0.3),
        _make_score("q7", SITUATIONAL_RESPONSE, 0.4, 0.2),
    ]
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(scores_with_skip, sample_script, session_id="skiptest")
    assert report.questions_skipped == 2
    assert report.questions_scored == 5


def test_build_ocean_report_role_recommendation_string(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, session_id="rectest")
    assert isinstance(report.role_recommendation, str)
    assert len(report.role_recommendation) > 10


def test_build_ocean_report_ollama_failure_graceful(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.side_effect = Exception("Connection refused")
        mock_cls.return_value = mock_client
        report = build_ocean_report(sample_scores, sample_script, session_id="failtest")
    assert "unavailable" in report.role_recommendation.lower()


def test_build_ocean_report_no_job_description(sample_scores, sample_script, tmp_path, monkeypatch):
    monkeypatch.setattr("services.scoring.ocean_mapper.OUTPUTS_DIR", tmp_path)
    with patch("services.scoring.ocean_mapper.httpx.Client") as mock_cls:
        mock_cls.return_value = _mock_ollama_response(MOCK_RECOMMENDATION)
        report = build_ocean_report(sample_scores, sample_script, job_description="", session_id="nojd")
    assert report.job_fit_score == 50.0  # neutral default
