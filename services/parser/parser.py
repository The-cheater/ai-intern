import re
from pathlib import Path
from typing import Union

from .models import ParsedResume, Experience, Project


def parse_pdf(file_path: Union[str, Path]) -> ParsedResume:
    """Parse a PDF resume using IBM Docling."""
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        raise ImportError("Install docling: pip install docling")

    converter = DocumentConverter()
    result = converter.convert(str(file_path))
    markdown = result.document.export_to_markdown()
    return _extract_from_markdown(markdown)


def parse_text(text: str) -> ParsedResume:
    """Parse plain text/markdown resume."""
    return _extract_from_markdown(text)


def _extract_from_markdown(markdown: str) -> ParsedResume:
    resume = ParsedResume(raw_markdown=markdown)

    # Email
    m = re.search(r"\b[\w.+\-]+@[\w\-]+\.\w+\b", markdown)
    if m:
        resume.email = m.group()

    # Phone
    m = re.search(r"(?:\+\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}", markdown)
    if m:
        resume.phone = m.group().strip()

    # Name: first non-empty line that looks like a heading
    for line in markdown.splitlines():
        line = line.strip().lstrip("#").strip()
        if line and not re.search(r"[@|:]", line) and len(line.split()) <= 5:
            resume.name = line
            break

    # Skills section
    skills_match = re.search(
        r"(?:skills?|technologies?|tech\s*stack)[:\s]*\n+(.*?)(?=\n## |\Z)",
        markdown,
        re.IGNORECASE | re.DOTALL,
    )
    if skills_match:
        raw = skills_match.group(1)
        items = re.split(r"[,\|•\n\-\*]+", raw)
        resume.skills = [s.strip() for s in items if s.strip() and len(s.strip()) > 1]

    # Use \n## (exactly 2 hashes) as section boundary to avoid matching ### sub-headings
    _SECTION_END = r"(?=\n## |\Z)"

    # Education section (simple line extraction)
    edu_match = re.search(
        r"(?:education)[:\s]*\n+(.*?)" + _SECTION_END,
        markdown,
        re.IGNORECASE | re.DOTALL,
    )
    if edu_match:
        lines = [l.strip() for l in edu_match.group(1).splitlines() if l.strip()]
        resume.education = lines[:5]  # cap at 5

    # Experience section
    exp_match = re.search(
        r"(?:experience|work\s*history)[:\s]*\n+(.*?)" + _SECTION_END,
        markdown,
        re.IGNORECASE | re.DOTALL,
    )
    if exp_match:
        resume.experience = _parse_experience_block(exp_match.group(1))

    # Projects section
    proj_match = re.search(
        r"(?:projects?)[:\s]*\n+(.*?)" + _SECTION_END,
        markdown,
        re.IGNORECASE | re.DOTALL,
    )
    if proj_match:
        resume.projects = _parse_projects_block(proj_match.group(1))

    return resume


def _parse_experience_block(text: str) -> list[Experience]:
    experiences = []
    # Prepend \n so the first ### is also caught by the split pattern
    blocks = re.split(r"\n#{2,3}\s+|\n\*\*", "\n" + text)
    for block in blocks:
        if not block.strip():
            continue
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            continue
        title_line = lines[0].lstrip("#").strip().rstrip("*")
        company, title, duration = "", title_line, ""

        # "Role — Company (Date)" pattern
        m = re.match(r"(.+?)\s*[—\-–]+\s*(.+?)(?:\s*\((.+?)\))?$", title_line)
        if m:
            title = m.group(1).strip()
            company = m.group(2).strip()
            duration = m.group(3) or ""

        desc = " ".join(lines[1:])
        experiences.append(Experience(title=title, company=company, duration=duration, description=desc))

    return experiences[:6]  # cap


def _parse_projects_block(text: str) -> list[Project]:
    projects = []
    blocks = re.split(r"\n#{2,3}\s+|\n\*\*", "\n" + text)
    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            continue
        name = lines[0].lstrip("#").strip().rstrip("*")
        desc = ""
        techs = []

        # Look for "Technologies:" line
        for line in lines[1:]:
            tech_m = re.match(r"[Tt]echnolog(?:y|ies)[:\s]+(.+)", line)
            if tech_m:
                techs = [t.strip() for t in re.split(r"[,\|]", tech_m.group(1))]
            else:
                desc = line if not desc else desc

        projects.append(Project(name=name, description=desc, technologies=techs))

    return projects[:6]
