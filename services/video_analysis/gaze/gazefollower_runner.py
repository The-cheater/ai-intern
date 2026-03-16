"""GazeFollower post-session video processor.

Processes recorded interview videos to extract accurate gaze metrics.
GazeFollower is an appearance-based model (no per-user calibration at inference).

Install: pip install gazefollower
"""

from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional, Tuple

# ── Try importing GazeFollower ────────────────────────────────────────────────
_GF_AVAILABLE = False
try:
    from gazefollower import GazeFollower as _GazeFollower
    _GF_AVAILABLE = True
    print("[VidyaAI][GazeFollower] Library loaded OK")
except Exception as _gf_err:
    print(f"[VidyaAI][GazeFollower] Not available ({_gf_err}) — install with: pip install gazefollower")

_gf_instance: Optional[Any] = None


def _get_gf():
    global _gf_instance
    if _GF_AVAILABLE and _gf_instance is None:
        try:
            _gf_instance = _GazeFollower()
            print("[VidyaAI][GazeFollower] Model instance created")
        except Exception as e:
            print(f"[VidyaAI][GazeFollower] Failed to instantiate model: {e}")
    return _gf_instance


def _extract_frames_cv2(video_path: str, every_n: int = 3) -> List[Any]:
    """Extract frames from video using OpenCV."""
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[VidyaAI][GazeFollower] OpenCV cannot open: {video_path}")
            return []
        frames = []
        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % every_n == 0:
                frames.append(frame)
            idx += 1
        cap.release()
        print(f"[VidyaAI][GazeFollower] Extracted {len(frames)} frames from {os.path.basename(video_path)}")
        return frames
    except Exception as e:
        print(f"[VidyaAI][GazeFollower] Frame extraction failed: {e}")
        return []


def _classify_zone(x: float, y: float) -> str:
    """Simple screen-zone classifier."""
    if y > 0.72:
        return "red"         # looking down (notes)
    if y <= 0.55 and abs(x - 0.5) <= 0.30:
        return "strategic"   # upper-center (thinking)
    return "neutral"


def _detect_robotic_reading(gaze_points: List[Tuple[float, float]]) -> Dict[str, Any]:
    """Detect systematic left-right scanning patterns typical of reading from notes."""
    if len(gaze_points) < 10:
        return {"detected": False, "confidence": 0.0}

    # Count direction reversals in X
    xs = [p[0] for p in gaze_points]
    reversals = 0
    for i in range(2, len(xs)):
        d1 = xs[i-1] - xs[i-2]
        d2 = xs[i]   - xs[i-1]
        if d1 * d2 < 0 and abs(d1) > 0.05 and abs(d2) > 0.05:
            reversals += 1

    reversal_rate = reversals / max(len(gaze_points), 1)
    # Robotic reading: high reversal rate AND consistent row height (small Y variance)
    import statistics
    ys = [p[1] for p in gaze_points]
    y_stdev = statistics.stdev(ys) if len(ys) > 1 else 1.0
    is_robotic = reversal_rate > 0.15 and y_stdev < 0.08
    return {
        "detected":       bool(is_robotic),
        "confidence":     round(min(reversal_rate * 5, 1.0), 3),
        "reversal_rate":  round(reversal_rate, 4),
        "y_stdev":        round(y_stdev, 4),
    }


def run_gazefollower_on_video(
    video_path: str,
    session_id: Optional[str] = None,
    calibration_data: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Analyze a recorded interview video with GazeFollower.

    Returns a structured dict with gaze metrics, zone distribution, and cheat flags.
    Falls back to a placeholder if GazeFollower is not installed.
    """
    print(f"[VidyaAI][GazeFollower] Processing video: {os.path.basename(video_path)}, session={session_id}")

    if not os.path.exists(video_path):
        print(f"[VidyaAI][GazeFollower] Video file not found: {video_path}")
        return {"provider": "gazefollower", "status": "missing_video"}

    if not _GF_AVAILABLE:
        print("[VidyaAI][GazeFollower] Not installed — returning placeholder. Run: pip install gazefollower")
        return {
            "provider":   "gazefollower",
            "status":     "not_installed",
            "install":    "pip install gazefollower",
        }

    gf = _get_gf()
    if gf is None:
        return {"provider": "gazefollower", "status": "model_init_failed"}

    frames = _extract_frames_cv2(video_path, every_n=3)
    if not frames:
        return {"provider": "gazefollower", "status": "no_frames"}

    gaze_points: List[Tuple[float, float]] = []
    failed_frames = 0

    for frame in frames:
        try:
            result = gf.predict(frame)
            if result is not None:
                h, w = frame.shape[:2]
                gx = max(0.0, min(1.0, float(result[0]) / max(w, 1)))
                gy = max(0.0, min(1.0, float(result[1]) / max(h, 1)))
                gaze_points.append((gx, gy))
        except Exception:
            failed_frames += 1

    print(f"[VidyaAI][GazeFollower] Got {len(gaze_points)} gaze points ({failed_frames} frames failed)")

    if not gaze_points:
        return {"provider": "gazefollower", "status": "no_gaze_detected", "failed_frames": failed_frames}

    # Zone distribution
    zone_counts: Dict[str, int] = {}
    for x, y in gaze_points:
        z = _classify_zone(x, y)
        zone_counts[z] = zone_counts.get(z, 0) + 1
    total = len(gaze_points)
    zone_distribution = {z: round(c / total, 4) for z, c in zone_counts.items()}

    # Robotic reading detection
    robotic = _detect_robotic_reading(gaze_points)

    # Cheating detection (9-signal FFT-based)
    cheat_flags: Dict[str, Any] = {"risk_level": "low"}
    try:
        from services.video_analysis.gaze.cheating_detector import detect_cheating
        baseline_var = (calibration_data or {}).get("baseline_gaze_variance", 0.004)
        cheat_flags = detect_cheating(gaze_points, baseline_variance=baseline_var)
        print(f"[VidyaAI][GazeFollower] Cheat detection: risk_level={cheat_flags.get('risk_level')}")
    except Exception as e:
        print(f"[VidyaAI][GazeFollower] Cheat detection failed: {e}")

    result_dict = {
        "provider":          "gazefollower",
        "status":            "ok",
        "gaze_points_count": len(gaze_points),
        "failed_frames":     failed_frames,
        "zone_distribution": zone_distribution,
        "robotic_reading":   robotic,
        "cheat_flags":       cheat_flags,
        "offscreen_ratio":   round(zone_distribution.get("red", 0), 4),
    }
    print(f"[VidyaAI][GazeFollower] Result: zones={zone_distribution} robotic={robotic['detected']}")
    return result_dict
