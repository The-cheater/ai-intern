"""LLM-based per-dimension response marker and correctness judge.

Two entry points:
  judge_response()  — PRIMARY: determines if answer is correct / partially_correct /
                      can_be_better / incorrect / not_attempted. Uses Gemini Flash (primary)
                      or Qwen (fallback). Evaluation criteria vary by question stage.
  mark_response()   — SECONDARY: scores 5 dimensions + OCEAN signals via Gemini/Qwen.
"""

import json
import logging
import os
import re
from typing import Dict, Optional, Union

import httpx

logger = logging.getLogger(__name__)

_OLLAMA_URL: str  = os.getenv("OLLAMA_URL",    "http://localhost:11434")
_MODEL: str       = os.getenv("OLLAMA_MODEL",  "qwen2.5:0.5b")
_GEMINI_KEY: str  = os.getenv("GEMINI_API_KEY",  "")
_GEMINI_KEY2: str = os.getenv("GEMINI_API_KEY2", "")
_GEMINI_MODEL     = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
_GEMINI_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"]
_GEMINI_BASE      = "https://generativelanguage.googleapis.com/v1beta/models"

# ── Verdict constants ─────────────────────────────────────────────────────────
VERDICT_CORRECT           = "correct"
VERDICT_PARTIALLY_CORRECT = "partially_correct"
VERDICT_CAN_BE_BETTER     = "can_be_better"
VERDICT_INCORRECT         = "incorrect"
VERDICT_NOT_ATTEMPTED     = "not_attempted"

# Stricter verdict → score mapping (0-10).
# Previously can_be_better=4.0 was too close to partially_correct=6.0.
# Now the spread is wider to better discriminate answer quality.
VERDICT_SCORE: Dict[str, float] = {
    VERDICT_CORRECT:           9.5,   # near-perfect but allows minor gaps
    VERDICT_PARTIALLY_CORRECT: 6.5,   # right idea, missing important points
    VERDICT_CAN_BE_BETTER:     3.5,   # correct in spirit but too shallow
    VERDICT_INCORRECT:         1.0,   # wrong or off-topic
    VERDICT_NOT_ATTEMPTED:     0.0,   # silence or irrelevant
}

# ── Stage-specific evaluation criteria ───────────────────────────────────────
_STAGE_CRITERIA = {
    "intro": (
        "Evaluate for: clarity of self-introduction, motivation fit for the role, "
        "communication fluency, and whether the candidate makes a confident professional impression. "
        "Do NOT penalise for technical gaps at this stage."
    ),
    "technical": (
        "Evaluate for: factual accuracy against the ideal answer, depth of technical knowledge, "
        "use of correct terminology, and ability to explain concepts clearly. "
        "Be strict — vague or generic answers that lack specifics must be marked 'can_be_better' or lower."
    ),
    "logical": (
        "Evaluate for: structured step-by-step reasoning, correct problem decomposition, "
        "and whether the candidate reaches a sound conclusion. "
        "Penalise guessing or jumping to conclusions without justification."
    ),
    "behavioral": (
        "Evaluate for: use of the STAR method (Situation, Task, Action, Result). "
        "Answers that lack a concrete example or real past experience must be 'can_be_better' or lower. "
        "Generic responses like 'I would...' instead of 'I did...' are a red flag."
    ),
    "situational": (
        "Evaluate for: decision-making framework, consideration of trade-offs, "
        "and practicality of the proposed approach. "
        "Penalise answers that are overly theoretical or fail to consider real constraints."
    ),
}

_DEFAULT_CRITERIA = "Evaluate for factual accuracy, depth, and relevance to the question."


def judge_response(
    question_text: str,
    ideal_answer: str,
    transcript: str,
    stage: str,
) -> Dict:
    """PRIMARY evaluator: determine whether the candidate's answer is correct.

    Returns:
      {
        "verdict":        "correct" | "partially_correct" | "can_be_better"
                          | "incorrect" | "not_attempted",
        "verdict_reason": "One sentence explaining why.",
        "score":          0-10 float derived from verdict,
        "key_gaps":       ["gap1", "gap2"],   # what was missing
        "strengths":      ["str1"],            # what was good
      }
    """
    if not transcript or not transcript.strip():
        return {
            "verdict":        VERDICT_NOT_ATTEMPTED,
            "verdict_reason": "No response was given.",
            "score":          0.0,
            "key_gaps":       ["Complete response required"],
            "strengths":      [],
        }

    stage_criteria = _STAGE_CRITERIA.get(stage, _DEFAULT_CRITERIA)

    system_msg = (
        "You are a strict and precise interview assessor. "
        "Evaluate the candidate's answer against the benchmark. "
        "Output ONLY valid JSON — no prose, no markdown, no explanation outside the JSON."
    )

    schema = (
        '{"verdict":"correct|partially_correct|can_be_better|incorrect|not_attempted",'
        '"verdict_reason":"one sentence — specific, not generic",'
        '"key_gaps":["specific missing point 1","specific missing point 2"],'
        '"strengths":["specific good point 1"]}'
    )

    verdict_guide = (
        "Verdict definitions (apply strictly):\n"
        "  correct           — addresses ALL key points in the ideal answer accurately and specifically\n"
        "  partially_correct — right direction but misses at least one important point\n"
        "  can_be_better     — correct in spirit but too vague, shallow, or lacking concrete evidence\n"
        "  incorrect         — factually wrong, completely off-topic, or contradicts the ideal answer\n"
        "  not_attempted     — candidate said nothing relevant to the question\n\n"
        "Be strict. A response that is technically correct but provides no depth or specifics "
        "should be 'can_be_better', not 'correct'.\n"
    )

    prompt = (
        f"Question type: {stage}\n"
        f"Stage evaluation criteria: {stage_criteria}\n\n"
        f"Question: {question_text}\n\n"
        f"Benchmark ideal answer: {ideal_answer[:600]}\n\n"
        f"Candidate's actual response: {transcript}\n\n"
        f"{verdict_guide}"
        f"Reply with ONLY this JSON (no other text):\n{schema}"
    )

    raw = _call_llm_judge(system_msg, prompt)
    if raw is None:
        return _heuristic_verdict(transcript, ideal_answer)

    verdict = raw.get("verdict", VERDICT_INCORRECT)
    if verdict not in VERDICT_SCORE:
        verdict = VERDICT_INCORRECT

    # Clean markdown from text fields
    verdict_reason = str(raw.get("verdict_reason", "")).strip()[:400]
    verdict_reason = _clean_markdown(verdict_reason)

    key_gaps = raw.get("key_gaps", [])[:5]
    key_gaps = [_clean_markdown(str(g)) for g in key_gaps]

    strengths = raw.get("strengths", [])[:5]
    strengths = [_clean_markdown(str(s)) for s in strengths]

    return {
        "verdict":        verdict,
        "verdict_reason": verdict_reason,
        "score":          VERDICT_SCORE[verdict],
        "key_gaps":       key_gaps,
        "strengths":      strengths,
    }


def _clean_markdown(text: str) -> str:
    """Remove markdown formatting from text for plain-text display.

    Removes:
    - **bold** → bold
    - *italic* → italic
    - - bullet → bullet (keep as plain text)
    - # headers → headers
    - `code` → code
    """
    if not text:
        return text
    # Remove bold/italic markdown
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)  # **text** → text
    text = re.sub(r"\*(.*?)\*", r"\1", text)      # *text* → text
    text = re.sub(r"__(.*?)__", r"\1", text)      # __text__ → text
    text = re.sub(r"_(.*?)_", r"\1", text)        # _text_ → text
    # Remove code markdown
    text = re.sub(r"`(.*?)`", r"\1", text)        # `code` → code
    # Remove heading markdown (keep content)
    text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)  # ### Header → Header
    # Clean up bullet points but keep the content
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # - item → item
    return text.strip()


def _extract_json_robust(text: str) -> dict:
    """Extract JSON from LLM output that may have prose, markdown fences, or whitespace.
    Tries: direct parse → strip fences → find first {...} block (non-greedy scan).
    """
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    text_clean = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text_clean = re.sub(r"\s*```\s*$", "", text_clean).strip()
    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        pass
    # Find the first balanced { ... } block by scanning character-by-character
    depth = 0
    start = -1
    for i, ch in enumerate(text_clean):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    return json.loads(text_clean[start:i + 1])
                except json.JSONDecodeError:
                    start = -1  # try next block
    raise ValueError(f"No valid JSON found in: {text[:200]}")


def _call_gemini_llm(system_msg: str, prompt: str, max_tokens: int = 512, temperature: float = 0.1) -> Optional[dict]:
    """Call Gemini with key1 → key2 fallback, model fallback chain. Returns parsed dict or None."""
    keys = [k for k in (_GEMINI_KEY, _GEMINI_KEY2) if k]
    models = [_GEMINI_MODEL] + [m for m in _GEMINI_FALLBACKS if m != _GEMINI_MODEL]
    payload = {
        "system_instruction": {"parts": [{"text": system_msg}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    for key in keys:
        for model in models:
            url = f"{_GEMINI_BASE}/{model}:generateContent"
            try:
                with httpx.Client(timeout=25.0) as client:
                    r = client.post(url, params={"key": key}, json=payload)
                    if r.status_code in (400, 404, 429):
                        continue
                    r.raise_for_status()
                    text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return _extract_json_robust(text)
            except Exception as e:
                logger.debug(f"[Examiney][LLMJudge] Gemini {model} failed: {e}")
    return None


def _call_llm_judge(system_msg: str, prompt: str):
    """Try Gemini (key1→key2, model fallback) then Ollama /api/chat → /api/generate."""
    result = _call_gemini_llm(system_msg, prompt, max_tokens=512, temperature=0.1)
    if result is not None:
        return result

    # Ollama /api/chat
    try:
        payload = {
            "model": _MODEL,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": prompt},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1, "num_predict": 512},
        }
        with httpx.Client(timeout=45.0) as client:
            r = client.post(f"{_OLLAMA_URL}/api/chat", json=payload)
            if r.status_code == 200:
                return json.loads(r.json()["message"]["content"])
    except Exception as e:
        logger.debug(f"[Examiney][LLMJudge] Ollama chat failed: {e}")

    # Ollama /api/generate
    try:
        payload = {
            "model":  _MODEL,
            "prompt": f"{system_msg}\n\n{prompt}",
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1, "num_predict": 512},
        }
        with httpx.Client(timeout=45.0) as client:
            r = client.post(f"{_OLLAMA_URL}/api/generate", json=payload)
            r.raise_for_status()
            return json.loads(r.json()["response"])
    except Exception as e:
        logger.warning(f"[Examiney][LLMJudge] All LLM backends failed: {e}")

    return None


def _heuristic_verdict(transcript: str, ideal_answer: str) -> Dict:
    """Fallback when LLM is unavailable — keyword overlap as rough proxy.
    
    CRITICAL FIX #3: Improved logic to avoid unreachable code paths and be more fair.
    Thresholds:
    - 60%+ overlap + depth → CORRECT 
    - 45%+ overlap + depth → PARTIALLY_CORRECT
    - 20%+ overlap + minimal depth → CAN_BE_BETTER
    - <20% overlap or too shallow → INCORRECT/NOT_ATTEMPTED
    """
    t_words = set(transcript.lower().split())
    i_words = set(w for w in ideal_answer.lower().split() if len(w) > 4)
    word_count = len(transcript.split())

    if not i_words:
        # No ideal answer to compare against
        return {
            "verdict":        VERDICT_NOT_ATTEMPTED,
            "verdict_reason": f"No ideal answer provided for comparison.",
            "score":          VERDICT_SCORE[VERDICT_NOT_ATTEMPTED],
            "key_gaps":       [],
            "strengths":      [],
        }

    overlap = len(t_words & i_words) / len(i_words)
    has_depth = word_count >= 50  # Minimum depth for quality assessment

    # Clear decision tree with no unreachable paths
    if overlap >= 0.60 and has_depth:
        verdict = VERDICT_CORRECT
        reason = f"Strong overlap ({overlap:.0%}) with sufficient depth ({word_count} words)."
    elif overlap >= 0.45 and has_depth:
        verdict = VERDICT_PARTIALLY_CORRECT
        reason = f"Good overlap ({overlap:.0%}) but could be more comprehensive."
    elif overlap >= 0.20 and word_count >= 20:
        verdict = VERDICT_CAN_BE_BETTER
        reason = f"Basic understanding present ({overlap:.0%}) but lacks depth ({word_count} words)."
    elif overlap >= 0.10:
        verdict = VERDICT_INCORRECT
        reason = f"Limited overlap ({overlap:.0%}) — response misses key points."
    elif word_count >= 5:
        verdict = VERDICT_INCORRECT
        reason = f"Response off-topic or not addressing the question sufficiently."
    else:
        verdict = VERDICT_NOT_ATTEMPTED
        reason = "Response too short or empty."

    return {
        "verdict":        verdict,
        "verdict_reason": reason + " (LLM judge unavailable — heuristic fallback.)",
        "score":          VERDICT_SCORE[verdict],
        "key_gaps":       [],
        "strengths":      [],
    }


# ── Multi-dimension marker ────────────────────────────────────────────────────

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
    Tries Gemini Flash first (fast), falls back to Ollama.

    Returns:
        {
            "technical": 0-10,
            "communication": 0-10,
            "behavioral": 0-10,
            "engagement": 0-10,
            "authenticity": 0-10,
            "ocean_signals": {
                "openness": 0-1, "conscientiousness": 0-1, "extraversion": 0-1,
                "agreeableness": 0-1, "neuroticism": 0-1,
            }
        }
    """
    stage_criteria = _STAGE_CRITERIA.get(stage, _DEFAULT_CRITERIA)
    prompt = (
        f"Question type: {stage}\n"
        f"Stage criteria: {stage_criteria}\n"
        f"Question: {question_text}\n"
        f"Ideal answer (first 400 chars): {ideal_answer[:400]}\n"
        f"Candidate response: {transcript}\n\n"
        "Score on these 5 dimensions (0-10 each, be strict):\n"
        "  technical       — factual accuracy and depth\n"
        "  communication   — clarity, structure, vocabulary\n"
        "  behavioral      — use of examples / STAR method\n"
        "  engagement      — enthusiasm and energy\n"
        "  authenticity    — genuine, natural delivery\n\n"
        "Also extract OCEAN personality signals (0.0-1.0 each):\n"
        "  openness        — creative, curious, novel thinking\n"
        "  conscientiousness — organised, structured, detail-oriented\n"
        "  extraversion    — assertive, expressive, confident\n"
        "  agreeableness   — cooperative, empathetic, team-oriented\n"
        "  neuroticism     — stress/anxiety indicators (high = stressed)\n\n"
        f"Reply with this exact JSON schema (no other text):\n{_SCHEMA_EXAMPLE}"
    )

    # Gemini (key1 → key2, model fallback)
    result = _call_gemini_llm(_SYSTEM, prompt, max_tokens=300, temperature=0.2)
    if result is not None:
        return _normalise(result)

    # Ollama /api/chat
    try:
        chat_payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": prompt},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2, "num_predict": 300},
        }
        with httpx.Client(timeout=40.0) as client:
            resp = client.post(f"{ollama_url}/api/chat", json=chat_payload)
            if resp.status_code == 200:
                return _normalise(json.loads(resp.json()["message"]["content"]))
    except Exception as e:
        logger.debug(f"[Examiney][LLMMarker] Ollama chat failed: {e}")

    # Ollama /api/generate
    try:
        gen_payload = {
            "model":  model,
            "prompt": f"{_SYSTEM}\n\n{prompt}",
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2, "num_predict": 300},
        }
        with httpx.Client(timeout=40.0) as client:
            resp = client.post(f"{ollama_url}/api/generate", json=gen_payload)
            resp.raise_for_status()
            return _normalise(json.loads(resp.json()["response"]))
    except Exception as exc:
        logger.error(f"[Examiney][LLMMarker] mark_response all backends failed: {exc}")
        logger.info(f"[Examiney][LLMMarker] Using heuristic dimension scoring for fallback")
        return _heuristic_dimension_scores(transcript, ideal_answer, stage)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamp(val, lo: float, hi: float) -> float:
    try:
        return float(min(hi, max(lo, float(val))))
    except (TypeError, ValueError):
        return (lo + hi) / 2.0


def _normalise(data: dict) -> dict:
    sig = data.get("ocean_signals", {})
    return {
        "technical":     _clamp(data.get("technical", 0),     0, 10),
        "communication": _clamp(data.get("communication", 0), 0, 10),
        "behavioral":    _clamp(data.get("behavioral", 0),    0, 10),
        "engagement":    _clamp(data.get("engagement", 0),    0, 10),
        "authenticity":  _clamp(data.get("authenticity", 0),  0, 10),
        "ocean_signals": {
            "openness":          _clamp(sig.get("openness", 0.0),          0, 1),
            "conscientiousness": _clamp(sig.get("conscientiousness", 0.0), 0, 1),
            "extraversion":      _clamp(sig.get("extraversion", 0.0),      0, 1),
            "agreeableness":     _clamp(sig.get("agreeableness", 0.0),     0, 1),
            "neuroticism":       _clamp(sig.get("neuroticism", 0.0),       0, 1),
        },
    }


def _defaults() -> dict:
    """Return zero-scores when LLM is unavailable — never fake middle-ground values."""
    return {
        "technical": 0.0, "communication": 0.0, "behavioral": 0.0,
        "engagement": 0.0, "authenticity": 0.0,
        "ocean_signals": {
            "openness": 0.0, "conscientiousness": 0.0, "extraversion": 0.0,
            "agreeableness": 0.0, "neuroticism": 0.0,
        },
    }


def _heuristic_dimension_scores(transcript: str, ideal_answer: str, stage: str = "") -> dict:
    """Fallback dimension scoring when LLM is unavailable.

    Uses transcript analysis to estimate dimension scores:
    - Word count and depth coverage
    - Keyword overlap with ideal answer
    - Stage-specific expectations

    Returns scores in 0-10 range for all dimensions.
    """
    word_count = len([w for w in transcript.split() if len(w) > 1])

    # Calculate keyword overlap (only count words of 3+ chars to avoid noise)
    t_words = {w.lower() for w in transcript.split() if len(w) > 2}
    i_words = {w.lower() for w in ideal_answer.split() if len(w) > 2}

    if not i_words:
        overlap = 0.5  # Neutral score if ideal answer is empty
    else:
        overlap = len(t_words & i_words) / len(i_words)

    # Stage-specific depth expectations
    if stage == "intro":
        min_words, target_words = 20, 60
    elif stage == "behavioral":
        min_words, target_words = 60, 150
    else:
        min_words, target_words = 40, 100

    # Calculate depth score (0-1)
    if word_count < min_words:
        depth = 0.0
    elif word_count >= target_words:
        depth = 1.0
    else:
        depth = (word_count - min_words) / (target_words - min_words)

    # Base scores from overlap and depth (weighted)
    # Greater weight to depth for assessing thoroughness
    base_score = (overlap * 0.4 + depth * 0.6) * 10
    base_score = max(0.0, min(10.0, base_score))

    # Dimension-specific adjustments
    technical = base_score * (0.9 + overlap * 0.1)  # Influenced by keyword match
    communication = base_score * (0.95 + depth * 0.05)  # More about breadth/detail
    behavioral = base_score if stage == "behavioral" else (base_score * 0.8)  # Downweight if not behavioral stage
    engagement = 4.0 + (depth * 3.0)  # 4.0-7.0 range based on depth
    authenticity = base_score * 0.9  # Slightly below base (hard to assess from text)

    # Clamp all to 0-10
    technical = max(0.0, min(10.0, technical))
    communication = max(0.0, min(10.0, communication))
    behavioral = max(0.0, min(10.0, behavioral))
    engagement = max(0.0, min(10.0, engagement))
    authenticity = max(0.0, min(10.0, authenticity))

    # OCEAN signals: neutral baseline, influenced by depth and word count
    ocean_signal = 0.5 + (depth * 0.3)  # 0.5-0.8 range

    return {
        "technical": round(technical, 1),
        "communication": round(communication, 1),
        "behavioral": round(behavioral, 1),
        "engagement": round(engagement, 1),
        "authenticity": round(authenticity, 1),
        "ocean_signals": {
            "openness": round(0.5 + (overlap * 0.3), 1),
            "conscientiousness": round(0.5 + (depth * 0.35), 1),
            "extraversion": round(ocean_signal, 1),
            "agreeableness": round(0.6 + min(word_count / 300.0, 0.3), 1),
            "neuroticism": round(0.4 - (depth * 0.2), 1),
        },
    }
