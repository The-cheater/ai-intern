import pytest
from services.parser.parser import parse_text, _extract_from_markdown
from services.parser.models import ParsedResume
from tests.conftest import SAMPLE_RESUME_MARKDOWN


def test_parse_text_returns_parsed_resume():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert isinstance(result, ParsedResume)


def test_parse_text_extracts_email():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert result.email == "john.doe@email.com"


def test_parse_text_extracts_phone():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert result.phone is not None
    assert "555" in result.phone


def test_parse_text_extracts_name():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert result.name == "John Doe"


def test_parse_text_extracts_skills():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert len(result.skills) > 0
    skill_text = " ".join(result.skills).lower()
    assert "python" in skill_text


def test_parse_text_extracts_education():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert len(result.education) > 0
    assert any("MIT" in e for e in result.education)


def test_parse_text_preserves_raw_markdown():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert result.raw_markdown == SAMPLE_RESUME_MARKDOWN


def test_parse_text_no_email():
    result = parse_text("# Jane Smith\nSoftware Engineer with 5 years experience")
    assert result.email is None


def test_parse_text_no_phone():
    result = parse_text("# Jane Smith\njane@example.com")
    assert result.phone is None


def test_parse_empty_string():
    result = parse_text("")
    assert isinstance(result, ParsedResume)
    assert result.skills == []
    assert result.experience == []


def test_parse_experience_count():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert len(result.experience) >= 2


def test_parse_experience_fields():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    exp = result.experience[0]
    assert "Software Engineer" in exp.title or "Engineer" in exp.title


def test_parse_projects():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    assert len(result.projects) >= 1
    assert result.projects[0].name != ""


def test_parse_project_technologies():
    result = parse_text(SAMPLE_RESUME_MARKDOWN)
    proj = result.projects[0]
    assert len(proj.technologies) > 0
    tech_text = " ".join(proj.technologies).lower()
    assert "python" in tech_text or "fastapi" in tech_text


def test_parse_multiple_skills_comma_separated():
    md = "# Test\n## Skills\nGo, Rust, C++, TypeScript"
    result = parse_text(md)
    assert "Go" in result.skills or "Rust" in result.skills


def test_extract_from_markdown_without_sections():
    md = "Alice Johnson\nalice@company.org\nExperienced developer"
    result = _extract_from_markdown(md)
    assert result.email == "alice@company.org"
