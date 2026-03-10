"""LLM-based per-dimension response marker using Qwen2.5 via Ollama.

Produces technical / communication / behavioral / engagement / authenticity
scores (0-10) plus raw OCEAN personality signals (0-1) for every question
response during an interview session.
"""

import json
import os
from typing import Dict

import httpx
from dotenv import load_dotenv

load_dotenv()

_OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")

_SYSTEM = (
    "You are an expert interview evaluator. "
    "Analyse the candidate's response and reply with a single JSON object only. "
    "No prose, no markdown, just raw JSON."
)

_SCHEMA_EXAMPLE = (
    '{"technical":7,"communication":8,"behavioral":6,"engagement":7,"authenticity":8,'
    '"ocean_signals":{"openness":0.7,"conscientiousness":0.6,"extraversion":0.5,'
    '"agreeableness":0.8,"neuroticism":0.3}}'
)


def mark_response(
    question_text: str,
    ideal_answer: str,
    transcript: str,
    stage: str,
    model: str = _MODEL,
    ollama_url: str = _OLLAMA_URL,
) -> Dict:
    """Score a transcript on 5 dimensions and extract raw OCEAN signals.

    Args:
        question_text: The interview question asked.
        ideal_answer:  The benchmark ideal answer.
        transcript:    The candidate's spoken response (from Whisper).
        stage:         Question stage (intro/technical/behavioral/logical/situational).

    Returns:
        {
            "technical": 0-10,
            "communication": 0-10,
            "behavioral": 0-10,
            "engagement": 0-10,
            "authenticity": 0-10,
            "ocean_signals": {
                "openness": 0-1,
                "conscientiousness": 0-1,
                "extraversion": 0-1,
                "agreeableness": 0-1,
                "neuroticism": 0-1,
            }
        }
    """
    prompt = (
        f"Question type: {stage}\n"
        f"Question: {question_text}\n"
        f"Ideal answer (first 300 chars): {ideal_answer[:300]}\n"
        f"Candidate response: {transcript}\n\n"
        "Score on these 5 dimensions (0–10 each):\n"
        "  technical       — factual accuracy and depth\n"
        "  communication   — clarity, structure, vocabulary\n"
        "  behavioral      — use of examples / STAR method\n"
        "  engagement      — enthusiasm and energy\n"
        "  authenticity    — genuine, natural delivery\n\n"
        "Also provide OCEAN personality signals (0.0–1.0 each):\n"
        "  openness        — creative, curious, novel thinking\n"
        "  conscientiousness — organised, detail-oriented\n"
        "  extraversion    — assertive, expressive, social\n"
        "  agreeableness   — cooperative, empathetic\n"
        "  neuroticism     — stress, anxiety indicators (high = stressed)\n\n"
        f"Reply with this exact JSON schema (no other text):\n{_SCHEMA_EXAMPLE}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "format": "json",
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(f"{ollama_url}/api/chat", json=payload)
            resp.raise_for_status()
            raw = resp.json()["message"]["content"]
            data = json.loads(raw)
            return _normalise(data)
    except Exception as exc:
        print(f"[NeuroSync][LLMMarker] mark_response failed: {exc}")
        return _defaults()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamp(val, lo: float, hi: float) -> float:
    try:
        return float(min(hi, max(lo, float(val))))
    except (TypeError, ValueError):
        return (lo + hi) / 2.0


def _normalise(data: dict) -> dict:
    sig = data.get("ocean_signals", {})
    return {
        "technical":     _clamp(data.get("technical", 5),     0, 10),
        "communication": _clamp(data.get("communication", 5), 0, 10),
        "behavioral":    _clamp(data.get("behavioral", 5),    0, 10),
        "engagement":    _clamp(data.get("engagement", 5),    0, 10),
        "authenticity":  _clamp(data.get("authenticity", 5),  0, 10),
        "ocean_signals": {
            "openness":          _clamp(sig.get("openness", 0.5),          0, 1),
            "conscientiousness": _clamp(sig.get("conscientiousness", 0.5), 0, 1),
            "extraversion":      _clamp(sig.get("extraversion", 0.5),      0, 1),
            "agreeableness":     _clamp(sig.get("agreeableness", 0.5),     0, 1),
            "neuroticism":       _clamp(sig.get("neuroticism", 0.5),       0, 1),
        },
    }


def _defaults() -> dict:
    return {
        "technical": 5.0, "communication": 5.0, "behavioral": 5.0,
        "engagement": 5.0, "authenticity": 5.0,
        "ocean_signals": {
            "openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5,
            "agreeableness": 0.5, "neuroticism": 0.5,
        },
    }
