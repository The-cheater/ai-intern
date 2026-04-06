"""
OCEAN Personality Mapper
========================
Maps per-question ResponseScore objects to Big-Five (OCEAN) trait scores,
computes a blended job-fit score (60% semantic + 40% OCEAN role benchmark),
finds top career matches from personality.csv, calls Gemini/Qwen for a role
recommendation, and saves the full report to outputs/.
"""
import csv
import json
import logging
import os
import re
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

import httpx
import numpy as np

from services.question_gen.models import InterviewScript
from services.scoring.models import CareerMatch, OceanReport, OceanScores, ResponseScore, TraitSignals

_PERSONALITY_CSV = Path(__file__).resolve().parents[2] / "personality.csv"

# ── Company-relevant signal keyword banks ────────────────────────────────────

# Agreeableness: cooperative / team-oriented language
_COOPERATIVE_WORDS = {"we", "team", "together", "support", "helped", "collaborated",
                      "shared", "our", "us", "collectively", "coordinated", "assisted",
                      "partnered", "aligned", "contributed", "listened", "empathised"}

# Conscientiousness: structure, detail, reliability, ownership
_STRUCTURED_WORDS  = {"organised", "organized", "planned", "scheduled", "deadline",
                      "prioritised", "prioritized", "systematically", "process",
                      "documented", "tracked", "measured", "delivered", "completed",
                      "accountable", "responsible", "consistent", "thorough"}

# Openness: creativity, learning, adaptability, curiosity
_OPENNESS_WORDS    = {"innovative", "creative", "explored", "researched", "learned",
                      "curious", "experimented", "novel", "alternative", "adapted",
                      "flexible", "diverse", "interdisciplinary", "hypothesised",
                      "discovered", "questioned", "improved"}

# Leadership / Extraversion signal
_LEADERSHIP_WORDS  = {"led", "managed", "coordinated", "directed", "decided",
                      "initiated", "proposed", "presented", "influenced", "delegated",
                      "mentored", "motivated", "convinced", "drove", "championed"}

# Growth mindset: learning from failure, feedback seeking
_GROWTH_WORDS      = {"learned", "improved", "feedback", "mistake", "failed",
                      "grew", "reflection", "iterate", "adjusted", "corrected",
                      "better", "developed", "growth", "challenge", "obstacle",
                      "overcome", "retrospective", "lesson"}

# Resilience / Emotional stability (low neuroticism under pressure)
_RESILIENCE_WORDS  = {"despite", "although", "however", "overcame", "recovered",
                      "persisted", "adapted", "maintained", "stayed", "kept",
                      "handled", "managed", "calmly", "steadily", "continued"}


def _clean_text_markdown(text: str) -> str:
    """Remove markdown formatting from text. """
    if not text:
        return text
    # Remove bold/italic markdown
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"__(.*?)__", r"\1", text)
    text = re.sub(r"_(.*?)_", r"\1", text)
    # Remove code markdown
    text = re.sub(r"`(.*?)`", r"\1", text)
    # Remove heading and bullet markdown
    text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    return text.strip()


OLLAMA_URL    = os.getenv("OLLAMA_URL",   "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY",  "")
GEMINI_API_KEY2 = os.getenv("GEMINI_API_KEY2", "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
_GEMINI_FALLBACKS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"]
_GEMINI_BASE    = "https://generativelanguage.googleapis.com/v1beta/models"

OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "outputs"


# ── Personality benchmark CSV loader ─────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_benchmarks() -> Tuple[List[str], np.ndarray]:
    """Load personality.csv once. Returns (names, vectors) where vectors is (N, 5) float32.
    Column order in CSV: O, C, E, A, N → stored as [O, C, E, A, N].
    Returns empty structures if CSV is missing or malformed.
    """
    names: List[str] = []
    vectors: List[List[float]] = []
    if not _PERSONALITY_CSV.exists():
        logger.warning(f"[Examiney][OceanMapper] personality.csv not found at {_PERSONALITY_CSV} — role matching disabled")
        return names, np.empty((0, 5), dtype=np.float32)
    try:
        with open(_PERSONALITY_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    o = float(row["O"]); c = float(row["C"]); e = float(row["E"])
                    a = float(row["A"]); n = float(row["N"])
                    names.append(row["career_name"].strip())
                    vectors.append([o, c, e, a, n])
                except (KeyError, ValueError):
                    continue
        logger.info(f"[Examiney][OceanMapper] Loaded {len(names)} role benchmarks from personality.csv")
        return names, np.array(vectors, dtype=np.float32)
    except Exception as ex:
        logger.error(f"[Examiney][OceanMapper] Failed to load personality.csv: {ex}")
        return [], np.empty((0, 5), dtype=np.float32)


def _tokenise(text: str) -> set:
    """Lowercase word tokens longer than 3 chars, stripping punctuation."""
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3}


def _find_role_benchmark(job_title_or_description: str) -> Optional[Tuple[str, np.ndarray]]:
    """Find the single best-matching role in the benchmark CSV by keyword overlap
    with the job title/description. Returns (role_name, ocean_01_vector) or None.
    """
    names, vectors = _load_benchmarks()
    if not names:
        return None
    query_tokens = _tokenise(job_title_or_description[:300])
    if not query_tokens:
        return None
    best_idx, best_score = -1, 0.0
    for i, name in enumerate(names):
        role_tokens = _tokenise(name)
        if not role_tokens:
            continue
        overlap = len(query_tokens & role_tokens) / len(role_tokens | query_tokens)
        if overlap > best_score:
            best_score = overlap
            best_idx = i
    # Only accept if there's a meaningful keyword overlap (> 0 shared words)
    if best_idx == -1 or best_score == 0.0:
        return None
    return names[best_idx], vectors[best_idx]


def _ocean_to_01(ocean: OceanScores) -> np.ndarray:
    """Convert OceanScores (0-100 scale) to 0-1 numpy array [O, C, E, A, N]."""
    return np.array([
        ocean.openness, ocean.conscientiousness,
        ocean.extraversion, ocean.agreeableness, ocean.neuroticism,
    ], dtype=np.float32) / 100.0


_MAX_OCEAN_DIST = float(np.sqrt(5))  # max Euclidean distance in 5D unit hypercube


def _distance_to_score(dist: float) -> float:
    """Convert Euclidean distance (0 – sqrt(5)) to a match score (0 – 100)."""
    return round(max(0.0, (1.0 - dist / _MAX_OCEAN_DIST) * 100), 1)


def _compute_ocean_role_fit(ocean: OceanScores, benchmark_vec: np.ndarray) -> float:
    """Return 0-100 score: how closely the candidate's OCEAN matches the role benchmark."""
    candidate_vec = _ocean_to_01(ocean)
    dist = float(np.linalg.norm(candidate_vec - benchmark_vec))
    return _distance_to_score(dist)


def _find_top_career_matches(ocean: OceanScores, n: int = 3) -> List[CareerMatch]:
    """Return the top-n roles from personality.csv whose OCEAN profile is closest
    to the candidate's, sorted by descending match score.
    """
    names, vectors = _load_benchmarks()
    if not names:
        return []
    candidate_vec = _ocean_to_01(ocean)
    # Vectorised distance computation over all 2546 rows at once
    dists = np.linalg.norm(vectors - candidate_vec, axis=1)
    top_indices = np.argsort(dists)[:n]
    return [
        CareerMatch(role=names[i], match_score=_distance_to_score(float(dists[i])))
        for i in top_indices
    ]


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
    """
    Fraction of words that are cooperative keywords (fixed: uses total word
    count, not unique-word-set-intersection-with-itself which was always len(words)).
    Capped at 1.0 with a 3x scale to reward even moderate cooperative language.
    """
    all_words = text.lower().split()
    if not all_words:
        return 0.0
    hits = sum(1 for w in all_words if w in _COOPERATIVE_WORDS)
    return min(1.0, (hits / len(all_words)) * 3)


def _sentence_count(text: str) -> int:
    """Rough sentence count via punctuation."""
    return max(1, len(re.findall(r"[.!?]+", text)))


def _word_count(text: str) -> int:
    return len([w for w in text.split() if len(w) > 1])


def _depth_ratio(text: str) -> float:
    """
    Response depth signal: 0-1.
    Under 40 words = shallow (0.0–0.4), 40-80 = moderate (0.4-0.7), 80+ = deep (0.7-1.0).
    Used to weight how much trust we place in other signals.
    """
    wc = _word_count(text)
    if wc < 20:
        return 0.0
    if wc < 40:
        return 0.2
    if wc < 80:
        return 0.5
    if wc < 150:
        return 0.75
    return 1.0


def _stress_score(score: ResponseScore) -> float:
    """Inverse engagement + negative sentiment = stress signal (0-1)."""
    stress = score.sentiment.neg + (0.3 if score.engagement_flag else 0.0)
    return min(1.0, stress)


# ── Trait → high-signal stage mapping ────────────────────────────────────────
# Stages that provide meaningful signal for each trait.
# "intro" is present in every interview but gives weak signals for most traits.
_TRAIT_STRONG_STAGES: Dict[str, set] = {
    "openness":          {"technical", "logical", "behavioral", "situational"},
    "conscientiousness": {"technical", "logical", "behavioral", "situational"},
    "extraversion":      {"behavioral", "situational"},
    "agreeableness":     {"behavioral", "situational"},
    "neuroticism":       {"behavioral", "situational", "technical", "logical"},
}


def _compute_trait_coverage(
    stages_with_responses: set,
    trait_raw_signal_counts: Dict[str, int],
) -> Dict[str, str]:
    """Return per-trait reliability level.

    full    — 2+ high-signal stage types contributed
    partial — 1 high-signal stage type contributed
    limited — only intro/weak stages contributed (or 1-2 signals only)
    none    — zero signals collected for this trait
    """
    coverage: Dict[str, str] = {}
    for trait, strong_stages in _TRAIT_STRONG_STAGES.items():
        strong_hit = strong_stages & stages_with_responses
        sig_count  = trait_raw_signal_counts.get(trait, 0)
        if sig_count == 0:
            coverage[trait] = "none"
        elif len(strong_hit) >= 2:
            coverage[trait] = "full"
        elif len(strong_hit) == 1:
            coverage[trait] = "partial"
        else:
            # Only intro (or no strong stage present) — signals exist but are weak
            coverage[trait] = "limited"
    return coverage


# ── Per-stage weight multipliers ─────────────────────────────────────────────
# Technical/logical questions are more predictive of job fit and personality
# than intro questions; this prevents the intro from diluting the OCEAN profile.
_STAGE_WEIGHT: Dict[str, float] = {
    "technical":   1.5,
    "logical":     1.3,
    "behavioral":  1.2,
    "situational": 1.2,
    "intro":       0.8,
}


# ── Per-question signal extraction ───────────────────────────────────────────

def _extract_signals(
    score: ResponseScore,
    stage: str,
) -> TraitSignals:
    """
    Return a TraitSignals with 0-1 floats for each relevant trait.
    Signals are depth-weighted so shallow responses don't pollute OCEAN scores.
    
    CRITICAL FIX #4: Comprehensive trait signal extraction across all 5 OCEAN dimensions.
    Each stage extracts all relevant traits instead of just 2-3.
    """
    sig = TraitSignals()
    t = score.transcript
    depth = _depth_ratio(t)
    
    # Common features used across stages
    vocab_richness = _unique_word_ratio(t)
    coop_ratio = _cooperative_ratio(t)
    sent_structure = _sentence_count(t)
    
    if stage == "intro":
        # ✓ Extraversion: positive sentiment + engagement + vocabulary richness
        extraversion_val = (score.sentiment.compound + 1) / 2 * (0.7 if not score.engagement_flag else 0.4)
        sig.extraversion.append(round(extraversion_val * depth, 4))
        
        # ✓ Neuroticism: inverse of stress, only trust if depth
        neuroticism_val = (1.0 - _stress_score(score)) * depth
        sig.neuroticism.append(round(neuroticism_val, 4))
        
        # ✓ Extraversion (alternate): sentence count + expressiveness (more sentences = more expressive)
        expressiveness = min(1.0, sent_structure / 5.0)
        sig.extraversion.append(round(expressiveness * depth, 4))
        
        # ✓ Openness: vocabulary diversity + confidence in self-description
        openness_val = vocab_richness * min(1.0, score.semantic_score)
        sig.openness.append(round(openness_val * depth, 4))
        
        # ✓ Agreeableness: cooperative language + positive sentiment balance
        agree_val = (coop_ratio * 0.5 + ((score.sentiment.compound + 1) / 2) * 0.5)
        sig.agreeableness.append(round(agree_val * depth, 4))
        
        # ✓ Conscientiousness: structured, organized response (multiple sentences)
        intro_structure = min(1.0, sent_structure / 4.0) if sent_structure > 0 else 0.2
        sig.conscientiousness.append(round(intro_structure * depth, 4))

    elif stage in ("technical", "logical"):
        # ✓ Conscientiousness: semantic accuracy + structural organization + detail level
        structure_bonus = min(0.2, sent_structure / 10.0)
        conscientiousness_val = min(1.0, score.semantic_score * 0.8 + structure_bonus * 0.2) * depth
        sig.conscientiousness.append(round(conscientiousness_val, 4))
        
        # ✓ Openness: vocabulary richness + conceptual breadth (diverse word usage)
        sig.openness.append(round(vocab_richness * depth, 4))
        
        # ✓ Neuroticism: uncertainty signals (hedging language) + negative sentiment
        uncertainty_words = sum(1 for w in t.lower().split() if w in {"may", "might", "could", "possibly", "perhaps"})
        uncertainty_signal = min(1.0, uncertainty_words / max(len(t.split()), 1) * 10)
        neuroticism_val = (score.sentiment.neg + uncertainty_signal * 0.3) / 1.3  # Normalize
        sig.neuroticism.append(round(neuroticism_val * depth, 4))
        
        # ✓ Conscientiousness (alternate): detail/specificity (concrete examples, metrics)
        has_numbers = any(c.isdigit() for c in t)
        has_examples = any(w in t.lower() for w in {"example", "such as", "for instance", "specifically"})
        detail_signal = (0.5 if has_numbers else 0.0) + (0.5 if has_examples else 0.0)
        sig.conscientiousness.append(round(detail_signal * depth, 4))

    elif stage == "behavioral":
        words_set = set(t.lower().split())

        # ✓ Agreeableness: cooperative keyword presence + team orientation
        sig.agreeableness.append(round(coop_ratio * depth, 4))

        # ✓ Conscientiousness: STAR method + structured/accountable language
        star_keywords = {"situation", "task", "action", "result", "outcome", "challenge", "resulted"}
        star_hits = len(words_set & star_keywords)
        struct_hits = len(words_set & _STRUCTURED_WORDS)
        star_completeness = min(1.0, star_hits / 4.0)
        struct_bonus = min(0.3, struct_hits / 10.0)
        sig.conscientiousness.append(round((star_completeness * 0.7 + struct_bonus) * depth, 4))

        # ✓ Openness: diversity of experience + openness keyword bank
        open_hits = len(words_set & _OPENNESS_WORDS)
        openness_val = vocab_richness * 0.5 + min(0.5, open_hits / 5.0)
        sig.openness.append(round(openness_val * depth, 4))

        # ✓ Extraversion: leadership language + active confident delivery
        lead_hits = len(words_set & _LEADERSHIP_WORDS)
        leadership_signal = min(1.0, lead_hits / 4.0)
        sig.extraversion.append(round(leadership_signal * depth, 4))

        # ✓ Growth mindset → Conscientiousness/Openness: learning from experience
        growth_hits = len(words_set & _GROWTH_WORDS)
        growth_signal = min(1.0, growth_hits / 5.0)
        sig.conscientiousness.append(round(growth_signal * depth * 0.6, 4))
        sig.openness.append(round(growth_signal * depth * 0.4, 4))

        # ✓ Neuroticism: resilience language reduces neuroticism; negative sentiment raises it
        resilience_hits = len(words_set & _RESILIENCE_WORDS)
        resilience_signal = min(1.0, resilience_hits / 4.0)
        raw_stress = _stress_score(score)
        # High resilience language + low stress sentiment = emotionally stable (low N)
        neuroticism_val = max(0.0, raw_stress - resilience_signal * 0.5) * depth
        sig.neuroticism.append(round(neuroticism_val, 4))

    elif stage == "situational":
        words_set = set(t.lower().split())

        # ✓ Openness: creative problem-solving signals + openness keyword bank
        open_hits = len(words_set & _OPENNESS_WORDS)
        creativity_signal = min(1.0, open_hits / 4.0)
        sig.openness.append(round((vocab_richness * 0.5 + creativity_signal * 0.5) * depth, 4))

        # ✓ Conscientiousness: structured analysis + structured keyword bank
        practical_keywords = {"consider", "analyze", "evaluate", "impact", "feasible", "realistic", "prioritise", "prioritize"}
        practical_hits = len(words_set & practical_keywords)
        struct_hits = len(words_set & _STRUCTURED_WORDS)
        structure = min(1.0, sent_structure / 5.0)
        conscientiousness_val = (
            structure * 0.4 +
            min(0.3, practical_hits / 6.0) +
            min(0.3, struct_hits / 8.0)
        ) * score.semantic_score * depth
        sig.conscientiousness.append(round(conscientiousness_val, 4))

        # ✓ Agreeableness: stakeholder + cooperative consideration
        stakeholder_keywords = {"team", "stakeholder", "customer", "user", "impact", "people", "collaborate", "colleague"}
        stakeholder_hits = len(words_set & stakeholder_keywords)
        stakeholder_signal = min(1.0, stakeholder_hits / 4.0)
        sig.agreeableness.append(round((coop_ratio * 0.5 + stakeholder_signal * 0.5) * depth, 4))

        # ✓ Extraversion: decisiveness + leadership language under pressure
        decisive_keywords = {"will", "should", "must", "clearly", "definitely", "recommend", "propose"}
        decisive_hits = len(words_set & decisive_keywords)
        lead_hits = len(words_set & _LEADERSHIP_WORDS)
        decisiveness_signal = min(1.0, decisive_hits / 4.0) * 0.6 + min(0.4, lead_hits / 4.0)
        sig.extraversion.append(round(decisiveness_signal * depth, 4))

        # ✓ Neuroticism: resilience language reduces stress; composed answer = low N
        resilience_hits = len(words_set & _RESILIENCE_WORDS)
        resilience_signal = min(1.0, resilience_hits / 3.0)
        raw_stress = _stress_score(score)
        neuroticism_val = max(0.0, raw_stress - resilience_signal * 0.5) * depth
        sig.neuroticism.append(round(neuroticism_val, 4))

        # ✓ Growth mindset signals under situational pressure
        growth_hits = len(words_set & _GROWTH_WORDS)
        growth_signal = min(1.0, growth_hits / 4.0)
        sig.conscientiousness.append(round(growth_signal * depth * 0.5, 4))

    return sig


# ── Weighted aggregation ──────────────────────────────────────────────────────

def _aggregate(signals: List[float]) -> Optional[float]:
    """
    Simple arithmetic mean of the signal list.

    Stage-based weighting is handled upstream by repeating signals proportionally
    to the stage weight (see _STAGE_WEIGHT + repeat logic in build_ocean_report).
    A position-based weight here would create unpredictable interactions with that
    repetition scheme, so we use a plain mean to keep the math transparent.

    Returns None when no signals — caller handles this rather than using a fake default.
    """
    if not signals:
        return None
    return sum(signals) / len(signals)


# ── OCEAN confidence ──────────────────────────────────────────────────────────

def _compute_confidence(questions_scored: int) -> str:
    """
    Confidence in the OCEAN profile based on how many questions were actually answered.
    Low  : fewer than 3 scored questions — treat scores with skepticism
    Medium: 3-5 scored questions
    High : 6+ scored questions — reliable profile
    """
    if questions_scored >= 6:
        return "High"
    if questions_scored >= 3:
        return "Medium"
    return "Low"


# ── Job-fit score via SentenceTransformer ────────────────────────────────────

def _compute_job_fit(transcripts: List[str], job_description: str) -> float:
    if not any(t.strip() for t in transcripts):
        return 0.0  # no interview data — cannot compute job fit
    if not job_description.strip():
        return 0.0  # no job description — cannot compute job fit

    combined_transcript = " ".join(t for t in transcripts if t.strip())

    # Primary: SentenceTransformer cosine similarity
    try:
        from services.scoring.response_scorer import _cosine_similarity, _get_model
        model = _get_model()
        embs = model.encode([combined_transcript, job_description], convert_to_numpy=True)
        sim = _cosine_similarity(embs[0], embs[1])
        return round(min(100.0, max(0.0, sim * 100)), 2)
    except Exception as e:
        logger.warning(f"[Examiney][OceanMapper] SentenceTransformer unavailable ({e}) — keyword fallback for job fit")

    # Fallback: keyword overlap (words > 4 chars to skip stop words)
    t_words = set(combined_transcript.lower().split())
    j_words = {w for w in job_description.lower().split() if len(w) > 4}
    if not j_words:
        return 0.0
    overlap = len(t_words & j_words) / len(j_words)
    return round(min(100.0, overlap * 100), 2)


# ── Qwen role recommendation ─────────────────────────────────────────────────

def _get_role_recommendation(
    ocean: OceanScores,
    job_description: str,
    job_fit_score: float,
    confidence: str,
    scores: List["ResponseScore"] = None,
    script: "InterviewScript" = None,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> str:
    from services.question_gen.models import InterviewScript as _IS  # local to avoid circular

    jd_snippet = job_description[:400] if job_description else "Not provided."
    confidence_note = "" if confidence == "High" else f" (confidence is {confidence} — limited response data)"

    # Build Q&A summary for the prompt
    qa_lines: List[str] = []
    if scores and script:
        q_map = {q.id: q for q in script.questions}
        for s in scores:
            q_obj = q_map.get(s.question_id)
            if not q_obj:
                continue
            transcript = s.transcript.strip()
            if not transcript or transcript.upper().startswith(("[NO RESPONSE", "[NO AUDIO")):
                continue
            score_10 = round(s.combined_score, 1)
            # Truncate long transcripts to keep prompt manageable
            answer_snippet = transcript[:300] + ("…" if len(transcript) > 300 else "")
            qa_lines.append(
                f"  Q ({q_obj.stage}): {q_obj.question}\n"
                f"  Answer: {answer_snippet}\n"
                f"  Score: {score_10}/10"
            )

    qa_block = "\n\n".join(qa_lines) if qa_lines else "No interview responses recorded."

    # Determine fit verdict label
    if job_fit_score >= 70:
        fit_verdict = "Recommended"
    elif job_fit_score >= 50:
        fit_verdict = "Recommended with caution"
    else:
        fit_verdict = "Not recommended"

    # Strongest / weakest OCEAN trait
    ocean_dict = {
        "Openness": ocean.openness,
        "Conscientiousness": ocean.conscientiousness,
        "Extraversion": ocean.extraversion,
        "Agreeableness": ocean.agreeableness,
        "Neuroticism": ocean.neuroticism,
    }
    strongest_trait = max(ocean_dict, key=ocean_dict.__getitem__)
    weakest_trait = min(ocean_dict, key=ocean_dict.__getitem__)

    prompt = (
        f"You are a senior talent assessor writing a structured candidate evaluation report.\n\n"
        f"=== INTERVIEW Q&A DATA ===\n{qa_block}\n\n"
        f"=== CONTEXT ===\n"
        f"Role: {jd_snippet}\n"
        f"Job Fit Score: {job_fit_score:.1f}/100 ({confidence_note})\n"
        f"Verdict: {fit_verdict}\n"
        f"OCEAN scores (0-100): Openness={ocean.openness:.1f}, Conscientiousness={ocean.conscientiousness:.1f}, "
        f"Extraversion={ocean.extraversion:.1f}, Agreeableness={ocean.agreeableness:.1f}, Neuroticism={ocean.neuroticism:.1f}\n"
        f"Strongest trait: {strongest_trait} ({ocean_dict[strongest_trait]:.1f})\n"
        f"Weakest trait: {weakest_trait} ({ocean_dict[weakest_trait]:.1f})\n\n"
        "=== OUTPUT FORMAT ===\n"
        "Write a bullet-point evaluation EXACTLY in this order:\n\n"
        "**Answer Quality Assessment:**\n"
        "For EACH question above, output one bullet:\n"
        "• [Question topic] — [Was the answer technically correct / relevant? Rate quality: Poor/Adequate/Good/Excellent (X/10)] — [1-sentence insight on what was right or missing]\n\n"
        "**Personality & Fit Analysis:**\n"
        f"• Strongest trait ({strongest_trait}): [how this helps performance in this role]\n"
        f"• Weakest trait ({weakest_trait}): [how this may hinder performance or what to watch for]\n"
        f"• Job Fit Score ({job_fit_score:.1f}/100): {fit_verdict} — [one sentence reason based on interview performance]\n\n"
        "RULES: Never contradict the verdict label. Be specific and factual. Output plain bullets only — no JSON, no extra headers."
    )
    system_msg = (
        "You are a senior talent assessment AI. Follow the OUTPUT FORMAT exactly. "
        "Use bullet points as instructed. Be concise and factual."
    )

    # Try Gemini (key1 → key2, model fallback chain)
    keys = [k for k in (GEMINI_API_KEY, GEMINI_API_KEY2) if k]
    models = [GEMINI_MODEL] + [m for m in _GEMINI_FALLBACKS if m != GEMINI_MODEL]
    gemini_payload = {
        "system_instruction": {"parts": [{"text": system_msg}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1024},
    }
    for _key in keys:
        for _model in models:
            _url = f"{_GEMINI_BASE}/{_model}:generateContent"
            try:
                with httpx.Client(timeout=20.0) as client:
                    r = client.post(_url, params={"key": _key}, json=gemini_payload)
                    if r.status_code in (400, 404, 429):
                        continue
                    r.raise_for_status()
                    result = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return _clean_text_markdown(result)
            except Exception:
                continue

    # Try Ollama /api/chat
    chat_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user",   "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 1024},
    }
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{ollama_url}/api/chat", json=chat_payload)
            if resp.status_code == 200:
                result = resp.json()["message"]["content"].strip()
                return _clean_text_markdown(result)
            raise RuntimeError(f"HTTP {resp.status_code}")
    except Exception:
        pass

    # Fall back to Ollama /api/generate
    try:
        gen_payload = {
            "model":  model,
            "prompt": f"{system_msg}\n\n{prompt}",
            "stream": False,
            "options": {"temperature": 0.4, "num_predict": 1024},
        }
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{ollama_url}/api/generate", json=gen_payload)
            resp.raise_for_status()
            result = resp.json()["response"].strip()
            return _clean_text_markdown(result)
    except Exception as e:
        # Structured fallback when all LLMs fail
        fit_label = "Recommended" if job_fit_score >= 70 else "Recommended with caution" if job_fit_score >= 50 else "Not recommended"
        ocean_dict = {
            "Openness": ocean.openness, "Conscientiousness": ocean.conscientiousness,
            "Extraversion": ocean.extraversion, "Agreeableness": ocean.agreeableness,
            "Neuroticism": ocean.neuroticism,
        }
        strongest = max(ocean_dict, key=ocean_dict.__getitem__)
        weakest = min(ocean_dict, key=ocean_dict.__getitem__)
        qa_summary_lines = []
        if scores and script:
            q_map = {q.id: q for q in script.questions}
            for s in scores:
                q_obj = q_map.get(s.question_id)
                if not q_obj or not s.transcript.strip():
                    continue
                label = "Excellent" if s.combined_score >= 8 else "Good" if s.combined_score >= 6 else "Adequate" if s.combined_score >= 4 else "Poor"
                qa_summary_lines.append(f"• {q_obj.question[:80]} — {label} ({s.combined_score:.1f}/10)")
        qa_text = "\n".join(qa_summary_lines) if qa_summary_lines else "• No responses recorded."
        return (
            f"**Answer Quality Assessment:**\n{qa_text}\n\n"
            f"**Personality & Fit Analysis:**\n"
            f"• Strongest trait ({strongest}): Score {ocean_dict[strongest]:.1f}/100 — contributes positively to role performance.\n"
            f"• Weakest trait ({weakest}): Score {ocean_dict[weakest]:.1f}/100 — may need development for this role.\n"
            f"• Job Fit Score ({job_fit_score:.1f}/100): {fit_label} — "
            f"{'strong alignment with role requirements.' if job_fit_score >= 65 else 'partial alignment; further assessment advised.' if job_fit_score >= 45 else 'insufficient alignment with role requirements.'}"
        )


# ── Success prediction ────────────────────────────────────────────────────────

def _predict_success(ocean: OceanScores, job_fit_score: float) -> str:
    """
    Stricter thresholds than before.
    High   : job_fit >= 70 AND ocean_balance >= 60
    Medium : job_fit >= 55 OR ocean_balance >= 50   (raised from 50/45)
    Low    : everything else
    """
    ocean_balance = np.mean([
        ocean.openness, ocean.conscientiousness,
        ocean.extraversion, ocean.agreeableness,
        100 - ocean.neuroticism,  # low neuroticism is good
    ])
    if job_fit_score >= 70 and ocean_balance >= 60:
        return "High"
    if job_fit_score >= 55 or ocean_balance >= 50:
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

    # Guard: no interview data — return a clear no-data report
    _no_data_msg = "No interview data available — candidate has not completed the interview."
    _PLACEHOLDER_PREFIXES = ("[NO RESPONSE", "[NO AUDIO", "[no response", "[no audio")
    has_real_data = any(
        s.transcript.strip() and not s.transcript.upper().startswith(("[NO RESPONSE", "[NO AUDIO"))
        for s in scores
    )
    if not has_real_data:
        ocean = OceanScores(
            openness=0.0, conscientiousness=0.0,
            extraversion=0.0, agreeableness=0.0, neuroticism=0.0,
        )
        report = OceanReport(
            session_id=session_id,
            ocean_scores=ocean,
            trait_interpretations={
                t: _no_data_msg
                for t in ["openness", "conscientiousness", "extraversion",
                          "agreeableness", "neuroticism"]
            },
            job_fit_score=0.0,
            semantic_fit_score=0.0,
            ocean_role_fit=None,
            matched_benchmark_role=None,
            career_suggestions=[],
            success_prediction="Low",
            role_recommendation=_no_data_msg,
            questions_scored=0,
            questions_skipped=len(scores),
            ocean_confidence="Low",
        )
        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUTS_DIR / f"session_{session_id}_ocean_report.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report.model_dump(), f, indent=2, ensure_ascii=False)
        return report

    # Build question-id -> stage map
    stage_map = {q.id: q.stage for q in script.questions}

    # Accumulate trait signals
    all_signals = TraitSignals()
    questions_skipped = 0
    stages_with_responses: set = set()
    # Track raw (pre-repetition) signal counts per trait for coverage calculation
    trait_raw_counts: Dict[str, int] = {
        t: 0 for t in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
    }

    for score in scores:
        stage = stage_map.get(score.question_id, "intro")
        if not score.transcript.strip() or score.transcript.upper().startswith(("[NO RESPONSE", "[NO AUDIO")):
            questions_skipped += 1
            continue
        stages_with_responses.add(stage)
        sig = _extract_signals(score, stage)

        # Track raw signal counts (before repetition) for trait_coverage computation
        trait_raw_counts["openness"]          += len(sig.openness)
        trait_raw_counts["conscientiousness"] += len(sig.conscientiousness)
        trait_raw_counts["extraversion"]      += len(sig.extraversion)
        trait_raw_counts["agreeableness"]     += len(sig.agreeableness)
        trait_raw_counts["neuroticism"]       += len(sig.neuroticism)

        # Apply per-stage weight: repeat signals proportionally so higher-weight
        # stages contribute more to the weighted mean (clean, no float rounding).
        weight = _STAGE_WEIGHT.get(stage, 1.0)
        repeat = max(1, round(weight * 2))  # e.g. technical=3, intro=2
        all_signals.openness.extend(sig.openness * repeat)
        all_signals.conscientiousness.extend(sig.conscientiousness * repeat)
        all_signals.extraversion.extend(sig.extraversion * repeat)
        all_signals.agreeableness.extend(sig.agreeableness * repeat)
        all_signals.neuroticism.extend(sig.neuroticism * repeat)

    questions_scored = len(scores) - questions_skipped

    # Aggregate to 0-100 scores
    # _aggregate returns None when no signals for a trait — use 50 as a neutral
    # centre ONLY when there is real data from OTHER traits (not a fake default)
    def _safe_agg(signals: List[float]) -> float:
        val = _aggregate(signals)
        return round(val * 100, 1) if val is not None else 50.0

    ocean = OceanScores(
        openness=_safe_agg(all_signals.openness),
        conscientiousness=_safe_agg(all_signals.conscientiousness),
        extraversion=_safe_agg(all_signals.extraversion),
        agreeableness=_safe_agg(all_signals.agreeableness),
        neuroticism=_safe_agg(all_signals.neuroticism),
    )

    trait_interpretations = {
        trait: _interpret(trait, getattr(ocean, trait))
        for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
    }

    # Semantic job-fit (transcript ↔ JD text)
    transcripts = [s.transcript for s in scores]
    semantic_fit = _compute_job_fit(transcripts, job_description)

    # OCEAN-based role fit (candidate OCEAN ↔ personality.csv benchmark)
    benchmark = _find_role_benchmark(job_description)
    ocean_role_fit: Optional[float] = None
    matched_benchmark_role: Optional[str] = None
    if benchmark is not None:
        matched_benchmark_role, benchmark_vec = benchmark
        ocean_role_fit = _compute_ocean_role_fit(ocean, benchmark_vec)
        logger.info(f"[Examiney][OceanMapper] Matched benchmark role: '{matched_benchmark_role}' → OCEAN fit {ocean_role_fit:.1f}/100")

    # Blended job-fit: 60% semantic + 40% OCEAN role fit (when benchmark available)
    if ocean_role_fit is not None:
        job_fit_score = round(0.6 * semantic_fit + 0.4 * ocean_role_fit, 2)
    else:
        job_fit_score = semantic_fit

    # Top-3 career suggestions from personality.csv
    career_suggestions = _find_top_career_matches(ocean, n=3)

    # OCEAN confidence — tells recruiter how much to trust the profile
    ocean_confidence = _compute_confidence(questions_scored)

    # Per-trait coverage — tells recruiter WHICH traits are reliable
    trait_coverage = _compute_trait_coverage(stages_with_responses, trait_raw_counts)

    # Log any traits with limited/no coverage so it's visible in server logs
    weak = [t for t, c in trait_coverage.items() if c in ("limited", "none")]
    if weak:
        logger.info(
            f"[Examiney][OceanMapper] Traits with limited data coverage: {weak} "
            f"(stages covered: {sorted(stages_with_responses)})"
        )

    # Success prediction
    success_prediction = _predict_success(ocean, job_fit_score)

    # Role recommendation
    role_recommendation = _get_role_recommendation(
        ocean, job_description, job_fit_score, ocean_confidence,
        scores=scores, script=script,
        model=model, ollama_url=ollama_url,
    )

    report = OceanReport(
        session_id=session_id,
        ocean_scores=ocean,
        trait_interpretations=trait_interpretations,
        job_fit_score=job_fit_score,
        semantic_fit_score=semantic_fit,
        ocean_role_fit=ocean_role_fit,
        matched_benchmark_role=matched_benchmark_role,
        career_suggestions=career_suggestions,
        success_prediction=success_prediction,
        role_recommendation=role_recommendation,
        questions_scored=questions_scored,
        questions_skipped=questions_skipped,
        ocean_confidence=ocean_confidence,
        trait_coverage=trait_coverage,
        stages_covered=sorted(stages_with_responses),
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
    print(f"  Questions scored   : {report.questions_scored}")
    print(f"  Questions skipped  : {report.questions_skipped}")
    print(f"  Profile confidence : {report.ocean_confidence}")
    print()

    for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]:
        score = getattr(report.ocean_scores, trait)
        print(f"  {trait.upper():<20} {bar(score)}")
        print(f"  {'':20} {report.trait_interpretations[trait]}")
        print()

    print("-" * 65)
    print(f"  JOB FIT SCORE       : {report.job_fit_score:.1f} / 100  "
          f"(semantic {report.semantic_fit_score:.1f} × 60%"
          + (f" + OCEAN role {report.ocean_role_fit:.1f} × 40%)" if report.ocean_role_fit is not None else ")"))
    if report.matched_benchmark_role:
        print(f"  MATCHED BENCHMARK   : {report.matched_benchmark_role}")
    print(f"  SUCCESS PREDICTION  : {report.success_prediction}")
    if report.career_suggestions:
        print()
        print("  CAREER SUGGESTIONS (by OCEAN fit):")
        for m in report.career_suggestions:
            print(f"    {m.match_score:5.1f}/100  {m.role}")
    print()
    print("  ROLE RECOMMENDATION:")
    for line in report.role_recommendation.split(". "):
        if line.strip():
            print(f"    {line.strip()}.")
    print()
    print(f"  Report saved to: outputs/session_{report.session_id}_ocean_report.json")
    print("=" * 65)
