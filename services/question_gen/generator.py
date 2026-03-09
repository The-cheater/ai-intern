import json
import httpx

from .models import InterviewScript
from .prompts import SYSTEM_PROMPT, build_user_prompt

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:7b"


def generate_questions(
    resume_markdown: str = "",
    job_description: str = "",
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> InterviewScript:
    """Generate interview questions from resume and/or job description via Ollama."""
    user_prompt = build_user_prompt(resume_markdown, job_description)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "format": "json",
    }

    with httpx.Client(timeout=300.0) as client:
        response = client.post(f"{ollama_url}/api/chat", json=payload)
        response.raise_for_status()
        data = response.json()

    content = data["message"]["content"]
    raw = json.loads(content)

    # Normalise stage values (LLMs sometimes use variants)
    _STAGE_MAP = {
        "behavioural": "behavioral",
        "technical questions": "technical",
        "logical reasoning": "logical",
        "logical questions": "logical",
        "situational questions": "situational",
        "scenario": "situational",
    }
    for q in raw.get("questions", []):
        q["stage"] = _STAGE_MAP.get(q.get("stage", "").lower(), q.get("stage", ""))

    return InterviewScript(**raw)
