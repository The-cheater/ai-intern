"""DeepFace-based 8-class emotion analyzer for Examiney.AI video signals.

Signal processing improvements
-------------------------------
- Multi-backend fallback chain: retinaface (most accurate) → ssd → opencv.
  retinaface uses a deep detector so it works on profile or partially lit faces
  that opencv's Haar cascade misses entirely.
- enforce_detection=False on every backend so partially visible faces are not
  discarded; face area gate (≥ 1 % of frame) screens out background noise.
- Confidence gate: only frames where the dominant emotion probability ≥ 20 %
  are used.  Low-confidence frames (ambiguous expressions) would add noise.
- Temporal smoothing: exponential weighted average (α = 0.3) applied per-emotion
  across successive scored frames so a single-frame expression spike does not
  dominate the session average.
- Brightness pre-check: nearly-black frames (mean < 10) skipped before calling
  DeepFace to avoid wasting time on dark/occluded frames.
- Full probability distribution accumulated, not just dominant label.
"""

from typing import Dict, List, Optional, Tuple

_DEFAULT: Dict[str, float] = {"neutral": 1.0}
_ALL_EMOTIONS = ("angry", "disgust", "fear", "happy", "sad", "surprise", "neutral")

# Detector backends tried in order of accuracy.  Fall through on failure.
_BACKENDS = ("retinaface", "ssd", "opencv")

# Exponential smoothing factor: 0 = no smoothing, 1 = no history
_EWM_ALPHA = 0.35

# Minimum dominant-emotion probability to trust the reading
_MIN_CONFIDENCE = 0.20


def analyze_emotions_from_video(
    video_path: str,
    sample_interval_seconds: int = 3,
) -> Dict[str, float]:
    """Sample emotion every *sample_interval_seconds* seconds using DeepFace.

    Returns:
        Dict[emotion_label → fraction] summing to 1.0.
        Falls back to ``{"neutral": 1.0}`` on any fatal error.
    """
    try:
        import cv2
        from deepface import DeepFace
    except ImportError:
        print("[Examiney][EmotionAnalyzer] deepface/cv2 not installed — neutral default.")
        return _DEFAULT.copy()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _DEFAULT.copy()

    # Browser WebM files often report fps=1000 via OpenCV — clamp to sane range.
    _raw_fps  = cap.get(cv2.CAP_PROP_FPS) or 25.0
    fps       = max(1.0, min(_raw_fps, 60.0))
    frame_h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
    frame_w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640

    # Auto-scale interval: short videos (< 10 s) sampled every 1 s so at least
    # several frames are scored; longer videos use the caller-supplied interval.
    total_frames    = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    video_duration  = total_frames / fps if fps > 0 else 0.0
    effective_interval = 1 if video_duration < 10.0 else sample_interval_seconds
    frame_interval = max(1, int(fps * effective_interval))
    min_face_area  = frame_h * frame_w * 0.01  # ≥ 1 % of frame

    # EWM state: running smoothed emotion vector
    ema: Optional[Dict[str, float]] = None
    frames_scored = 0
    frames_skipped = 0
    idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if idx % frame_interval == 0:
            # Quick brightness gate
            if float(frame.mean()) < 10.0:
                frames_skipped += 1
                idx += 1
                continue

            raw_probs = _analyze_frame(frame, DeepFace, min_face_area)
            if raw_probs is None:
                frames_skipped += 1
                idx += 1
                continue

            # Confidence gate: skip if model is uncertain
            dominant_prob = max(raw_probs.values())
            if dominant_prob < _MIN_CONFIDENCE:
                frames_skipped += 1
                idx += 1
                continue

            # Exponential weighted moving average across frames
            if ema is None:
                ema = dict(raw_probs)
            else:
                for emotion in _ALL_EMOTIONS:
                    ema[emotion] = (
                        _EWM_ALPHA * raw_probs.get(emotion, 0.0)
                        + (1.0 - _EWM_ALPHA) * ema.get(emotion, 0.0)
                    )
            frames_scored += 1

        idx += 1

    cap.release()

    print(
        f"[Examiney][EmotionAnalyzer] {frames_scored} frames scored, "
        f"{frames_skipped} skipped"
    )

    if frames_scored == 0 or ema is None:
        return _DEFAULT.copy()

    # Normalise the final EWM state → fractions (drop zero emotions)
    total = sum(ema.values()) or 1.0
    result = {
        emotion: round(val / total, 4)
        for emotion, val in ema.items()
        if val > 0.0
    }
    return result if result else _DEFAULT.copy()


# ── Frame-level analysis with backend fallback ────────────────────────────────

def _analyze_frame(
    frame,
    DeepFace,
    min_face_area: float,
) -> Optional[Dict[str, float]]:
    """Try each backend in order; return normalised probability dict or None."""
    for backend in _BACKENDS:
        try:
            results = DeepFace.analyze(
                frame,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend=backend,
                silent=True,
            )
            probs = _best_face_probs(results, min_face_area)
            if probs is not None:
                return probs
        except Exception:
            continue  # backend failed or not installed — try next
    return None


def _best_face_probs(
    results: List,
    min_face_area: float,
) -> Optional[Dict[str, float]]:
    """Return normalised emotion probabilities from the largest qualifying face."""
    best_area = 0.0
    best_probs: Optional[Dict[str, float]] = None

    for face_result in results:
        region = face_result.get("region", {})
        area   = region.get("w", 0) * region.get("h", 0)
        if area < min_face_area:
            continue

        probs: Dict[str, float] = face_result.get("emotion", {})
        if not probs:
            continue

        if area > best_area:
            best_area  = area
            best_probs = probs

    if best_probs is None:
        return None

    # Normalise to sum = 1
    total = sum(best_probs.values()) or 1.0
    return {
        emotion: best_probs.get(emotion, 0.0) / total
        for emotion in _ALL_EMOTIONS
    }
