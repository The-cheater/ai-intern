"""
OCEAN Personality Mapper
========================
Maps per-question ResponseScore objects to Big-Five (OCEAN) trait scores,
computes a job-fit cosine similarity score, calls Qwen2.5 for a role
recommendation, and saves the full report to outputs/.
"""
import json
import os
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
import numpy as np

from services.question_gen.models import InterviewScript
from services.scoring.models import OceanReport, OceanScores, ResponseScore, TraitSignals

# ── Cooperative keyword list (Agreeableness signal) ──────────────────────────
_COOPERATIVE_WORDS = {"we", "team", "together", "support", "helped", "collaborated",
                      "shared", "our", "us", "collectively", "coordinated", "assisted"}

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:latest"

OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "outputs"


# ── Trait interpretation thresholds ──────────────────────────────────────────
def _interpret(trait: str, score: float) -> str:
    level = "High" if score >= 65 else "Moderate" if score >= 40 else "Low"
    _LABELS = {
        "openness": {
            "High": "Creative thinker — brings novel ideas and explores problems from multiple angles.",
            "Moderate": "Balanced approach — open to new ideas but prefers proven methods.",
            "Low": "Prefers structure and convention over experimentation.",
        },
        "conscientiousness": {
            "High": "Highly structured, reliable, and detail-oriented.",
            "Moderate": "Generally organised but may lack consistency under pressure.",
            "Low": "Tends toward spontaneity; may struggle with deadlines and detail.",
        },
        "extraversion": {
            "High": "Energetic and expressive communicator; thrives in collaborative settings.",
            "Moderate": "Comfortable in social settings but also values focused solo work.",
            "Low": "Reserved and measured; may need encouragement to speak up.",
        },
        "agreeableness": {
            "High": "Highly cooperative and empathetic — strong team player.",
            "Moderate": "Balances collaboration with assertiveness.",
            "Low": "Competitive or direct; may create friction in team environments.",
        },
        "neuroticism": {
            "High": "Shows signs of stress reactivity — may struggle under interview pressure.",
            "Moderate": "Some anxiety signals present but generally composed.",
            "Low": "Emotionally stable and calm under pressure.",
        },
    }
    return _LABELS[trait][level]


# ── Feature extractors ────────────────────────────────────────────────────────

def _unique_word_ratio(text: str) -> float:
    """Vocabulary richness: unique words / total words."""
    words = text.lower().split()
    if not words:
        return 0.0
    return len(set(words)) / len(words)


def _cooperative_ratio(text: str) -> float:
    """Fraction of words that are cooperative keywords."""
    words = set(text.lower().split())
    hits = len(words & _COOPERATIVE_WORDS)
    return min(1.0, hits / max(1, len(words.intersection(words))) * 3)  # scale up, cap 1


def _sentence_count(text: str) -> int:
    """Rough sentence count via punctuation."""
    import re
    return max(1, len(re.findall(r"[.!?]+", text)))


def _stress_score(score: ResponseScore) -> float:
    """Inverse engagement + negative sentiment = stress signal (0-1)."""
    stress = score.sentiment.neg + (0.3 if score.engagement_flag else 0.0)
    return min(1.0, stress)


# ── Per-question signal extraction ───────────────────────────────────────────

def _extract_signals(
    score: ResponseScore,
    stage: str,
) -> TraitSignals:
    """Return a TraitSignals with 0-1 floats for each relevant trait."""
    sig = TraitSignals()
    t = score.transcript
    compound_norm = (score.sentiment.compound + 1) / 2  # [-1,1] -> [0,1]

    if stage == "intro":
        # Extraversion: positive sentiment + engagement (not flagged)
        extraversion_val = compound_norm * (0.6 if not score.engagement_flag else 0.3)
        sig.extraversion.append(extraversion_val)
        # Neuroticism: inverse of stress
        sig.neuroticism.append(1.0 - _stress_score(score))

    elif stage == "logical":
        # Conscientiousness: semantic accuracy + structured response
        structure_bonus = 0.1 if _sentence_count(t) > 2 else 0.0
        sig.conscientiousness.append(min(1.0, score.semantic_score + structure_bonus))
        # Openness: vocabulary richness
        sig.openness.append(_unique_word_ratio(t))

    elif stage == "behavioral":
        # Agreeableness: cooperative keyword presence + positive sentiment
        coop = _cooperative_ratio(t)
        agree_val = coop * 0.6 + compound_norm * 0.4
        sig.agreeableness.append(agree_val)
        # Neuroticism: negative sentiment signals stress
        sig.neuroticism.append(1.0 - score.sentiment.neg)

    elif stage == "situational":
        # Openness: creative divergence = low similarity but long response
        word_count = len(t.split())
        creative_divergence = (1.0 - score.semantic_score) * min(1.0, word_count / 80)
        sig.openness.append(creative_divergence)
        # Conscientiousness: structured multi-part response (sentence count > 3)
        structure = 1.0 if _sentence_count(t) > 3 else 0.5 if _sentence_count(t) == 3 else 0.2
        sig.conscientiousness.append(structure * score.semantic_score)

    return sig


# ── Weighted aggregation ──────────────────────────────────────────────────────

def _aggregate(signals: List[float], default: float = 0.4) -> float:
    """Weighted mean of signal list; later signals get higher weight."""
    if not signals:
        return default
    weights = list(range(1, len(signals) + 1))
    return sum(s * w for s, w in zip(signals, weights)) / sum(weights)


# ── Job-fit score via SentenceTransformer ────────────────────────────────────

def _compute_job_fit(transcripts: List[str], job_description: str) -> float:
    from sentence_transformers import SentenceTransformer
    from services.scoring.response_scorer import _cosine_similarity, _get_model

    if not job_description.strip() or not any(t.strip() for t in transcripts):
        return 50.0  # neutral default when no JD provided

    model = _get_model()
    combined_transcript = " ".join(t for t in transcripts if t.strip())
    embs = model.encode([combined_transcript, job_description], convert_to_numpy=True)
    sim = _cosine_similarity(embs[0], embs[1])
    return round(min(100.0, max(0.0, sim * 100)), 2)


# ── Qwen role recommendation ─────────────────────────────────────────────────

def _get_role_recommendation(
    ocean: OceanScores,
    job_description: str,
    job_fit_score: float,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> str:
    jd_snippet = job_description[:500] if job_description else "Not provided."
    prompt = (
        f"OCEAN scores (0-100): O={ocean.openness:.1f} C={ocean.conscientiousness:.1f} "
        f"E={ocean.extraversion:.1f} A={ocean.agreeableness:.1f} N={ocean.neuroticism:.1f}\n"
        f"Job Fit Score: {job_fit_score:.1f}/100\n"
        f"Job Description snippet: {jd_snippet}\n\n"
        "In exactly 2 sentences: (1) State whether this candidate fits the role and why. "
        "(2) Name their single strongest trait and single weakest trait with brief impact."
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a concise talent assessment AI. Output plain text only, no JSON."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{ollama_url}/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()["message"]["content"].strip()
    except Exception as e:
        return f"[Recommendation unavailable: {e}]"


# ── Success prediction ────────────────────────────────────────────────────────

def _predict_success(ocean: OceanScores, job_fit_score: float) -> str:
    ocean_balance = np.mean([
        ocean.openness, ocean.conscientiousness,
        ocean.extraversion, ocean.agreeableness,
        100 - ocean.neuroticism,  # low neuroticism is good
    ])
    if job_fit_score >= 70 and ocean_balance >= 60:
        return "High"
    if job_fit_score >= 50 or ocean_balance >= 45:
        return "Medium"
    return "Low"


# ── Main public function ──────────────────────────────────────────────────────

def build_ocean_report(
    scores: List[ResponseScore],
    script: InterviewScript,
    job_description: str = "",
    session_id: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> OceanReport:
    """
    Map ResponseScore list + InterviewScript to a full OceanReport.
    Saves JSON to outputs/session_{id}_ocean_report.json.
    """
    session_id = session_id or str(uuid.uuid4())[:8]

    # Build question-id -> stage map
    stage_map = {q.id: q.stage for q in script.questions}

    # Accumulate trait signals
    all_signals = TraitSignals()
    questions_skipped = 0

    for score in scores:
        stage = stage_map.get(score.question_id, "intro")
        if not score.transcript.strip() or score.transcript.startswith("[NO RESPONSE"):
            questions_skipped += 1
            continue
        sig = _extract_signals(score, stage)
        all_signals.openness.extend(sig.openness)
        all_signals.conscientiousness.extend(sig.conscientiousness)
        all_signals.extraversion.extend(sig.extraversion)
        all_signals.agreeableness.extend(sig.agreeableness)
        all_signals.neuroticism.extend(sig.neuroticism)

    # Aggregate to 0-100 scores
    ocean = OceanScores(
        openness=round(_aggregate(all_signals.openness) * 100, 1),
        conscientiousness=round(_aggregate(all_signals.conscientiousness) * 100, 1),
        extraversion=round(_aggregate(all_signals.extraversion) * 100, 1),
        agreeableness=round(_aggregate(all_signals.agreeableness) * 100, 1),
        neuroticism=round(_aggregate(all_signals.neuroticism) * 100, 1),
    )

    trait_interpretations = {
        trait: _interpret(trait, getattr(ocean, trait))
        for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
    }

    # Job-fit score
    transcripts = [s.transcript for s in scores]
    job_fit_score = _compute_job_fit(transcripts, job_description)

    # Success prediction
    success_prediction = _predict_success(ocean, job_fit_score)

    # Qwen2.5 recommendation
    role_recommendation = _get_role_recommendation(
        ocean, job_description, job_fit_score, model=model, ollama_url=ollama_url
    )

    report = OceanReport(
        session_id=session_id,
        ocean_scores=ocean,
        trait_interpretations=trait_interpretations,
        job_fit_score=job_fit_score,
        success_prediction=success_prediction,
        role_recommendation=role_recommendation,
        questions_scored=len(scores) - questions_skipped,
        questions_skipped=questions_skipped,
    )

    # Save to outputs/
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUTS_DIR / f"session_{session_id}_ocean_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(), f, indent=2, ensure_ascii=False)

    return report


# ── Terminal report printer ───────────────────────────────────────────────────

def print_ocean_report(report: OceanReport) -> None:
    BAR_WIDTH = 40

    def bar(score: float) -> str:
        filled = int(score / 100 * BAR_WIDTH)
        return "[" + "#" * filled + "-" * (BAR_WIDTH - filled) + f"] {score:.1f}"

    print()
    print("=" * 65)
    print(f"  OCEAN PERSONALITY REPORT  |  Session: {report.session_id}")
    print("=" * 65)
    print(f"  Questions scored : {report.questions_scored}")
    print(f"  Questions skipped: {report.questions_skipped}")
    print()

    for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]:
        score = getattr(report.ocean_scores, trait)
        print(f"  {trait.upper():<20} {bar(score)}")
        print(f"  {'':20} {report.trait_interpretations[trait]}")
        print()

    print("-" * 65)
    print(f"  JOB FIT SCORE       : {report.job_fit_score:.1f} / 100")
    print(f"  SUCCESS PREDICTION  : {report.success_prediction}")
    print()
    print("  ROLE RECOMMENDATION:")
    for line in report.role_recommendation.split(". "):
        if line.strip():
            print(f"    {line.strip()}.")
    print()
    print(f"  Report saved to: outputs/session_{report.session_id}_ocean_report.json")
    print("=" * 65)
