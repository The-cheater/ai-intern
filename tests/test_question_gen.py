import pytest
from unittest.mock import MagicMock, patch

from services.question_gen.generator import generate_questions
from services.question_gen.models import InterviewScript, Question
from services.question_gen.prompts import SYSTEM_PROMPT, build_user_prompt
from tests.conftest import MOCK_OLLAMA_RESPONSE, SAMPLE_JOB_DESCRIPTION, SAMPLE_RESUME_MARKDOWN


# ── Prompt tests ──────────────────────────────────────────────────────────────

def test_build_user_prompt_with_resume_only():
    prompt = build_user_prompt(resume_markdown=SAMPLE_RESUME_MARKDOWN)
    assert "CANDIDATE RESUME" in prompt
    assert "john.doe@email.com" in prompt
    assert "JOB DESCRIPTION" not in prompt


def test_build_user_prompt_with_job_description_only():
    prompt = build_user_prompt(job_description=SAMPLE_JOB_DESCRIPTION)
    assert "JOB DESCRIPTION" in prompt
    assert "Python" in prompt
    assert "CANDIDATE RESUME" not in prompt


def test_build_user_prompt_with_both():
    prompt = build_user_prompt(SAMPLE_RESUME_MARKDOWN, SAMPLE_JOB_DESCRIPTION)
    assert "CANDIDATE RESUME" in prompt
    assert "JOB DESCRIPTION" in prompt


def test_build_user_prompt_empty_raises():
    with pytest.raises(ValueError, match="At least one"):
        build_user_prompt()


def test_build_user_prompt_truncates_long_resume():
    long_resume = "x" * 10000
    prompt = build_user_prompt(resume_markdown=long_resume)
    # Should not exceed truncation limit inside prompt
    assert len(prompt) < 15000


def test_system_prompt_contains_schema():
    assert "questions" in SYSTEM_PROMPT
    assert "answer_key" in SYSTEM_PROMPT
    assert "critical_keywords" in SYSTEM_PROMPT


# ── Generator tests (mocked Ollama) ───────────────────────────────────────────

def _make_mock_client(response_data):
    """Helper: build a mock httpx.Client context manager."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = response_data
    mock_resp.raise_for_status.return_value = None

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    return mock_client


def test_generate_questions_returns_interview_script():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert isinstance(result, InterviewScript)


def test_generate_questions_count():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert len(result.questions) == 9


def test_generate_questions_all_stages_present():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    stages = {q.stage for q in result.questions}
    assert stages == {"intro", "technical", "behavioral"}


def test_generate_questions_intro_count():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert sum(1 for q in result.questions if q.stage == "intro") == 2


def test_generate_questions_technical_count():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert sum(1 for q in result.questions if q.stage == "technical") == 4


def test_generate_questions_behavioral_count():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert sum(1 for q in result.questions if q.stage == "behavioral") == 3


def test_generate_questions_answer_key_populated():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    for q in result.questions:
        assert isinstance(q.answer_key.critical_keywords, list)
        assert len(q.answer_key.critical_keywords) > 0
        assert q.answer_key.ideal_sentiment != ""
        assert q.answer_key.rubric != ""


def test_generate_questions_time_windows():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    for q in result.questions:
        assert 30 <= q.time_window_seconds <= 120


def test_generate_questions_job_description_only():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(job_description=SAMPLE_JOB_DESCRIPTION)

    assert isinstance(result, InterviewScript)


def test_generate_questions_both_inputs():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(
            resume_markdown=SAMPLE_RESUME_MARKDOWN,
            job_description=SAMPLE_JOB_DESCRIPTION,
        )

    assert isinstance(result, InterviewScript)


def test_generate_questions_metadata():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_cls.return_value = _make_mock_client(MOCK_OLLAMA_RESPONSE)
        result = generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)

    assert result.job_title == "Senior Backend Engineer"
    assert result.candidate_name == "John Doe"


def test_generate_questions_no_input_raises():
    with pytest.raises(ValueError):
        generate_questions()


def test_generate_questions_ollama_error_raises():
    with patch("services.question_gen.generator.httpx.Client") as mock_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.side_effect = Exception("Connection refused")
        mock_cls.return_value = mock_client

        with pytest.raises(Exception, match="Connection refused"):
            generate_questions(resume_markdown=SAMPLE_RESUME_MARKDOWN)
