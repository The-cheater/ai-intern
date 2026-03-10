import json
import os
import re
import time

import httpx

from .models import AnswerKey, InterviewScript, Question
from .prompts import SYSTEM_PROMPT, build_batch_prompt

OLLAMA_URL    = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")

# Batch sizes kept small so the tiny model can reliably fill the schema
_BATCHES = [
    ("intro",       3),
    ("technical",   4),
    ("technical",   3),
    ("behavioral",  4),
    ("logical",     4),
]


def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers the model sometimes adds."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json(text: str) -> dict:
    """Try direct parse; fall back to extracting the first {...} block."""
    text = _strip_fences(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # find the outermost { ... }
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"No JSON object found in response: {text[:200]}")


def _default_question(stage: str, idx: int, resume_snippet: str = "", jd_snippet: str = "") -> Question:
    """Fallback question used when a batch fails after retries."""
    context = (resume_snippet or jd_snippet or "the candidate's background")[:80]
    return Question(
        id=f"q{idx}",
        stage=stage,  # type: ignore[arg-type]
        question=f"Tell me about your experience relevant to {context}.",
        time_window_seconds={"intro": 60, "technical": 90, "behavioral": 90, "logical": 60}.get(stage, 75),
        ideal_answer="Describe specific examples with measurable outcomes.",
        answer_key=AnswerKey(
            critical_keywords=["experience", "outcome"],
            ideal_sentiment="confident",
            rubric="1=vague, 5=adequate, 10=specific with outcomes",
        ),
    )


def _call_ollama(
    system: str,
    user: str,
    model: str,
    ollama_url: str,
    retries: int = 3,
) -> dict:
    chat_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "stream": False,
        # No "format":"json" — 0.5b model returns 500 with it on longer prompts
        "options": {"temperature": 0.4, "num_predict": 1500},
    }
    # Fallback payload for older Ollama builds that don't support /api/chat
    gen_payload = {
        "model":  model,
        "prompt": f"{system}\n\n{user}",
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 1500},
    }
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=120.0) as client:
                r = client.post(f"{ollama_url}/api/chat", json=chat_payload)
                if r.status_code == 404:
                    # Fall back to /api/generate
                    r = client.post(f"{ollama_url}/api/generate", json=gen_payload)
                r.raise_for_status()
                data = r.json()
                # /api/chat returns data["message"]["content"]
                # /api/generate returns data["response"]
                content = data.get("message", {}).get("content") or data.get("response", "")
                return _extract_json(content)
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Ollama call failed after {retries} attempts: {e}") from e
    raise RuntimeError("Unreachable")


def _coerce_question(raw: dict, stage: str, idx: int) -> Question:
    """Build a Question from raw dict, filling in missing fields with safe defaults."""
    ak_raw = raw.get("answer_key") or {}
    answer_key = AnswerKey(
        critical_keywords=ak_raw.get("critical_keywords") or [],
        ideal_sentiment=ak_raw.get("ideal_sentiment") or "confident",
        rubric=ak_raw.get("rubric") or "1=poor, 5=adequate, 10=excellent",
    )
    return Question(
        id=raw.get("id") or f"q{idx}",
        stage=raw.get("stage") or stage,  # type: ignore[arg-type]
        question=raw.get("question") or raw.get("text") or f"Question {idx}",
        time_window_seconds=int(raw.get("time_window_seconds") or
                                {"intro": 60, "technical": 90, "behavioral": 90, "logical": 60}.get(stage, 75)),
        ideal_answer=raw.get("ideal_answer") or "",
        answer_key=answer_key,
    )


def generate_questions(
    resume_markdown: str = "",
    job_description: str = "",
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> InterviewScript:
    """Generate 18 questions in small batches to keep the tiny model reliable."""
    all_questions: list[Question] = []
    q_idx = 1

    for stage, count in _BATCHES:
        user_prompt = build_batch_prompt(
            stage=stage,
            count=count,
            id_start=q_idx,
            resume_snippet=resume_markdown,
            job_snippet=job_description,
        )
        try:
            data  = _call_ollama(SYSTEM_PROMPT, user_prompt, model, ollama_url)
            raws  = data.get("questions") or []
            # accept dicts or nested lists
            for raw in raws[:count]:
                if isinstance(raw, dict):
                    all_questions.append(_coerce_question(raw, stage, q_idx))
                    q_idx += 1
            # pad if model returned fewer than requested
            while len(all_questions) < q_idx - 1 + (count - len(raws[:count])):
                all_questions.append(_default_question(stage, q_idx, resume_markdown, job_description))
                q_idx += 1
        except Exception as e:
            print(f"[NeuroSync][Generator] batch {stage}×{count} failed: {e} — using fallbacks")
            for _ in range(count):
                all_questions.append(_default_question(stage, q_idx, resume_markdown, job_description))
                q_idx += 1

    # best-effort job title / name extraction from the first successful call
    return InterviewScript(
        job_title=None,
        candidate_name=None,
        questions=all_questions,
    )
