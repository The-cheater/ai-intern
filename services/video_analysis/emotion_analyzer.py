"""DeepFace-based 8-class emotion analyzer for NeuroSync AI video signals."""

from typing import Dict

_DEFAULT: Dict[str, float] = {"neutral": 1.0}


def analyze_emotions_from_video(
    video_path: str,
    sample_interval_seconds: int = 3,
) -> Dict[str, float]:
    """Sample emotion every *sample_interval_seconds* seconds using DeepFace.

    Falls back to ``{"neutral": 1.0}`` if DeepFace / cv2 is unavailable or
    the video cannot be opened — so the interview pipeline never crashes.

    Returns:
        Dict[emotion_label → fraction] where all fractions sum to 1.0.
    """
    try:
        import cv2
        from deepface import DeepFace  # noqa: F401 (lazy import)
    except ImportError:
        print("[NeuroSync][EmotionAnalyzer] deepface/cv2 not installed — neutral default.")
        return _DEFAULT.copy()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _DEFAULT.copy()

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(fps * sample_interval_seconds))

    counts: Dict[str, int] = {}
    idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % frame_interval == 0:
            try:
                results = DeepFace.analyze(
                    frame,
                    actions=["emotion"],
                    enforce_detection=False,
                    silent=True,
                )
                dominant: str = results[0]["dominant_emotion"]
                counts[dominant] = counts.get(dominant, 0) + 1
            except Exception:
                pass  # graceful fallback — frame skipped
        idx += 1

    cap.release()

    if not counts:
        return _DEFAULT.copy()

    total = sum(counts.values())
    return {k: round(v / total, 4) for k, v in counts.items()}
