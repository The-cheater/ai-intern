"""GazeFollower post-session video processor.

Processes recorded interview videos to extract accurate gaze metrics.

Primary model: GazeFollower (appearance-based, no per-user calibration at inference).
  Install: pip install gazefollower

Fallback model: MediaPipe FaceMesh iris landmarks (landmarks 468 & 473), mapped
  through the candidate's affine calibration transform when available.  This gives
  reliable, personalized gaze estimation on any machine without GazeFollower.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# ── Try importing GazeFollower ────────────────────────────────────────────────
_GF_AVAILABLE = False
try:
    from gazefollower import GazeFollower as _GazeFollower
    _GF_AVAILABLE = True
    print("[Examiney][GazeFollower] Library loaded OK")
except Exception as _gf_err:
    print(
        f"[Examiney][GazeFollower] Not available ({_gf_err}) — "
        "MediaPipe iris fallback will be used.  "
        "Install GazeFollower with: pip install gazefollower"
    )

# ── Try importing MediaPipe (used as fallback) ────────────────────────────────
_MP_AVAILABLE = False
try:
    import mediapipe as _mp  # noqa: F401
    _MP_AVAILABLE = True
    print("[Examiney][GazeFollower] MediaPipe available for fallback gaze estimation")
except Exception:
    print("[Examiney][GazeFollower] MediaPipe not available — install with: pip install mediapipe")

_gf_instance: Optional[Any] = None


def _get_gf():
    global _gf_instance
    if _GF_AVAILABLE and _gf_instance is None:
        try:
            _gf_instance = _GazeFollower()
            print("[Examiney][GazeFollower] Model instance created")
        except Exception as e:
            print(f"[Examiney][GazeFollower] Failed to instantiate model: {e}")
    return _gf_instance


# ── Frame extraction ──────────────────────────────────────────────────────────

def _extract_frames_cv2(video_path: str, every_n: int = 3) -> List[Any]:
    """Extract frames using OpenCV.

    Browser recordings (VP8/VP9 WebM) may not decode on Windows without ffmpeg.
    When OpenCV reads 0 frames we attempt a conversion via ffmpeg subprocess.
    """
    import cv2

    def _read_with_cv2(path: str) -> List[Any]:
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return []
        frames: List[Any] = []
        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % every_n == 0:
                frames.append(frame)
            idx += 1
        cap.release()
        return frames

    try:
        frames = _read_with_cv2(video_path)
        if frames:
            print(
                f"[Examiney][GazeFollower] Extracted {len(frames)} frames "
                f"from {os.path.basename(video_path)}"
            )
            return frames

        # 0 frames — try ffmpeg VP8/VP9 → H.264 conversion
        print(
            f"[Examiney][GazeFollower] 0 frames via OpenCV — "
            f"attempting ffmpeg conversion for {os.path.basename(video_path)}"
        )
        mp4_path = video_path + "_gf_converted.mp4"
        try:
            import subprocess
            proc = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-crf", "23",
                    "-an",
                    mp4_path,
                ],
                capture_output=True,
                timeout=120,
            )
            if proc.returncode != 0:
                err = proc.stderr.decode(errors="replace")[-300:]
                print(f"[Examiney][GazeFollower] ffmpeg failed (rc={proc.returncode}): {err}")
                return []
            frames = _read_with_cv2(mp4_path)
            print(f"[Examiney][GazeFollower] ffmpeg→OpenCV: {len(frames)} frames")
            return frames
        except FileNotFoundError:
            print("[Examiney][GazeFollower] ffmpeg not in PATH — install ffmpeg to decode VP8/VP9 WebM")
            return []
        except Exception as fe:
            print(f"[Examiney][GazeFollower] ffmpeg error: {fe}")
            return []
        finally:
            try:
                if os.path.exists(mp4_path):
                    os.unlink(mp4_path)
            except Exception:
                pass

    except Exception as e:
        print(f"[Examiney][GazeFollower] Frame extraction failed: {e}")
        return []


# ── MediaPipe iris fallback ───────────────────────────────────────────────────

def _mediapipe_gaze_from_frames(
    frames: List[Any],
    calibration_data: Optional[Dict] = None,
) -> List[Tuple[float, float]]:
    """Estimate gaze using MediaPipe FaceMesh iris landmarks (468 & 473).

    Improvements vs. first version:
    - static_image_mode=False: processes frames sequentially, enabling MediaPipe
      tracking between frames (much faster, fewer false negatives).
    - Blink exclusion: frames where the eye aspect ratio falls below a threshold
      (eyelid occludes iris) are skipped to avoid corrupt gaze estimates.
    - Kalman filter smoothing: 1D position Kalman applied to x and y independently
      to suppress high-frequency jitter while preserving true gaze shifts.

    Applies the candidate's affine calibration transform when available.
    Returns a list of (x, y) tuples in [0, 1] screen coordinates.
    """
    if not _MP_AVAILABLE or not frames:
        return []

    import cv2
    import mediapipe as mp

    _apply_transform = None
    transform_matrix = (calibration_data or {}).get("transform_matrix")
    if transform_matrix:
        try:
            from services.video_analysis.calibration.calibration_runner import apply_transform
            _apply_transform = apply_transform
        except Exception:
            pass

    mp_face_mesh = mp.solutions.face_mesh
    raw_points: List[Tuple[float, float]] = []
    failed = 0
    blinks = 0

    # Landmark indices for eye aspect ratio (EAR) blink detection
    # Left eye: 33, 159, 145, 133; Right eye: 362, 386, 374, 263
    _LEFT_TOP, _LEFT_BOT   = 159, 145
    _RIGHT_TOP, _RIGHT_BOT = 386, 374
    _LEFT_INNER, _LEFT_OUTER   = 133, 33
    _RIGHT_INNER, _RIGHT_OUTER = 263, 362
    _EAR_THRESHOLD = 0.18   # below this → blink / squint → unreliable iris

    with mp_face_mesh.FaceMesh(
        static_image_mode=False,          # tracking mode: faster, more stable
        max_num_faces=1,
        refine_landmarks=True,            # enables iris landmarks 468-477
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        for frame in frames:
            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = face_mesh.process(rgb)
                if not result.multi_face_landmarks:
                    failed += 1
                    continue

                lm = result.multi_face_landmarks[0].landmark
                if len(lm) <= 473:
                    failed += 1
                    continue

                # ── Blink detection via eye aspect ratio ──────────────────
                def _dist(a, b) -> float:
                    return ((lm[a].x - lm[b].x) ** 2 + (lm[a].y - lm[b].y) ** 2) ** 0.5

                left_ear  = _dist(_LEFT_TOP, _LEFT_BOT)   / (_dist(_LEFT_INNER, _LEFT_OUTER) + 1e-9)
                right_ear = _dist(_RIGHT_TOP, _RIGHT_BOT) / (_dist(_RIGHT_INNER, _RIGHT_OUTER) + 1e-9)
                ear = (left_ear + right_ear) / 2.0
                if ear < _EAR_THRESHOLD:
                    blinks += 1
                    continue   # eye closed or squinting — skip frame

                # ── Iris centre (average of left 468 and right 473) ───────
                lx = (lm[468].x + lm[473].x) / 2.0
                ly = (lm[468].y + lm[473].y) / 2.0
                raw = (lx, ly)

                if _apply_transform is not None and transform_matrix:
                    try:
                        mapped = _apply_transform(raw, transform_matrix)
                        gx = max(0.0, min(1.0, float(mapped[0])))
                        gy = max(0.0, min(1.0, float(mapped[1])))
                        raw_points.append((gx, gy))
                    except Exception:
                        raw_points.append((max(0.0, min(1.0, lx)), max(0.0, min(1.0, ly))))
                else:
                    raw_points.append((max(0.0, min(1.0, lx)), max(0.0, min(1.0, ly))))

            except Exception:
                failed += 1

    # ── Kalman filter smoothing ───────────────────────────────────────────────
    gaze_points = _kalman_smooth(raw_points)

    print(
        f"[Examiney][MediaPipeGaze] {len(gaze_points)} gaze points, "
        f"{blinks} blinks excluded, {failed} frames failed"
    )
    return gaze_points


def _kalman_smooth(
    points: List[Tuple[float, float]],
    process_noise: float = 1e-4,
    measurement_noise: float = 1e-2,
) -> List[Tuple[float, float]]:
    """Apply a simple 1D Kalman filter to x and y gaze coordinates independently.

    Models each axis as a constant-position system:
      State  : position
      Process: slow drift (process_noise)
      Measure: noisy observation (measurement_noise)

    Suppresses high-frequency jitter while preserving deliberate gaze shifts.
    """
    if len(points) < 3:
        return points

    xs = np.array([p[0] for p in points])
    ys = np.array([p[1] for p in points])

    def _filter_1d(obs: np.ndarray) -> np.ndarray:
        n = len(obs)
        x_est = obs[0]
        p_est = 1.0
        q = process_noise
        r = measurement_noise
        out = np.empty(n)
        for i in range(n):
            # Predict
            x_pred = x_est
            p_pred = p_est + q
            # Update
            k      = p_pred / (p_pred + r)
            x_est  = x_pred + k * (obs[i] - x_pred)
            p_est  = (1.0 - k) * p_pred
            out[i] = x_est
        return out

    xs_smooth = _filter_1d(xs)
    ys_smooth = _filter_1d(ys)
    return [
        (max(0.0, min(1.0, float(x))), max(0.0, min(1.0, float(y))))
        for x, y in zip(xs_smooth, ys_smooth)
    ]


# ── Zone classifier ───────────────────────────────────────────────────────────

def _classify_zone(x: float, y: float, calibration_data: Optional[Dict] = None) -> str:
    """Classify gaze into 4 screen zones using calibration-derived thresholds.

    Zones:
      red       — looking down (notes / phone)
      strategic — upper-centre (thinking / recall)
      wandering — high frame-to-frame displacement (unfocused)
      neutral   — everything else
    """
    cal = calibration_data or {}
    red_y      = cal.get("red_y_threshold",  0.72)
    upper_y    = cal.get("upper_y_threshold", 0.55)
    lat_margin = cal.get("lateral_x_margin",  0.30)

    if y > red_y:
        return "red"
    if y <= upper_y and abs(x - 0.5) <= lat_margin:
        return "strategic"
    return "neutral"


def _classify_zone_with_motion(
    x: float,
    y: float,
    prev: Optional[Tuple[float, float]],
    baseline_variance: float,
    calibration_data: Optional[Dict] = None,
) -> str:
    """Zone classification that includes a 'wandering' zone for high-motion frames."""
    base = _classify_zone(x, y, calibration_data)
    if base != "neutral" or prev is None:
        return base
    # Wandering: frame-to-frame displacement > 1.3× baseline_variance
    import math
    disp = math.hypot(x - prev[0], y - prev[1])
    if disp > 1.3 * (baseline_variance ** 0.5):
        return "wandering"
    return "neutral"


# ── Robotic reading detector ──────────────────────────────────────────────────

def _detect_robotic_reading(
    gaze_points: List[Tuple[float, float]],
    baseline_variance: float = 0.004,
) -> Dict[str, Any]:
    """Detect systematic left-right scanning patterns typical of reading from notes.

    Adaptive thresholds: reversal magnitude and y-spread scaled by
    sqrt(baseline_variance) to avoid false-positives on naturally low-range gaze.
    """
    if len(gaze_points) < 10:
        return {"detected": False, "confidence": 0.0}

    reversal_threshold = max(0.03, (baseline_variance ** 0.5) * 1.5)
    y_spread_threshold = max(0.06, (baseline_variance ** 0.5) * 2.0)

    xs = [p[0] for p in gaze_points]
    reversals = 0
    for i in range(2, len(xs)):
        d1 = xs[i - 1] - xs[i - 2]
        d2 = xs[i] - xs[i - 1]
        if d1 * d2 < 0 and abs(d1) > reversal_threshold and abs(d2) > reversal_threshold:
            reversals += 1

    reversal_rate = reversals / max(len(gaze_points), 1)
    import statistics
    ys = [p[1] for p in gaze_points]
    y_stdev = statistics.stdev(ys) if len(ys) > 1 else 1.0
    is_robotic = reversal_rate > 0.15 and y_stdev < y_spread_threshold
    return {
        "detected":      bool(is_robotic),
        "confidence":    round(min(reversal_rate * 5, 1.0), 3),
        "reversal_rate": round(reversal_rate, 4),
        "y_stdev":       round(y_stdev, 4),
    }


# ── Shared post-processing (reused by both GazeFollower & MediaPipe paths) ────

def _build_result(
    gaze_points: List[Tuple[float, float]],
    provider: str,
    session_id: Optional[str],
    calibration_data: Optional[Dict],
    failed_frames: int = 0,
    offscreen_count: int = 0,
) -> Dict[str, Any]:
    """Compute zone distribution, robotic-reading flag, and cheat detection."""
    baseline_var = (calibration_data or {}).get("baseline_gaze_variance", 0.004)
    total = len(gaze_points)
    offscreen_ratio_raw = round(offscreen_count / max(total, 1), 4)

    # Zone distribution with motion-aware wandering detection
    zone_counts: Dict[str, int] = {}
    prev: Optional[Tuple[float, float]] = None
    for x, y in gaze_points:
        z = _classify_zone_with_motion(x, y, prev, baseline_var, calibration_data)
        zone_counts[z] = zone_counts.get(z, 0) + 1
        prev = (x, y)
    zone_distribution = {z: round(c / total, 4) for z, c in zone_counts.items()}

    robotic = _detect_robotic_reading(gaze_points, baseline_variance=baseline_var)

    cheat_flags: Dict[str, Any] = {"risk_level": "low"}
    try:
        from services.video_analysis.gaze.cheating_detector import detect_cheating
        neuro_adj = float((calibration_data or {}).get("neurodiversity_adjustment", 1.0))
        cheat_flags = detect_cheating(
            gaze_points,
            baseline_variance=baseline_var,
            neurodiversity_adjustment=neuro_adj,
        )
        print(f"[Examiney][{provider}] Cheat detection: risk_level={cheat_flags.get('risk_level')}")
    except Exception as e:
        print(f"[Examiney][{provider}] Cheat detection failed: {e}")

    result = {
        "provider":            provider,
        "status":              "ok",
        "gaze_points_count":   total,
        "failed_frames":       failed_frames,
        "zone_distribution":   zone_distribution,
        "robotic_reading":     robotic,
        "cheat_flags":         cheat_flags,
        "offscreen_ratio":     round(zone_distribution.get("red", 0), 4),
        "offscreen_ratio_raw": offscreen_ratio_raw,
    }
    print(
        f"[Examiney][{provider}] Result: zones={zone_distribution} "
        f"robotic={robotic['detected']}"
    )
    return result


# ── Public API ────────────────────────────────────────────────────────────────

def run_gazefollower_on_video(
    video_path: str,
    session_id: Optional[str] = None,
    calibration_data: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Analyze a recorded interview video.

    Tries GazeFollower first; falls back to MediaPipe iris landmarks automatically.
    Returns a structured dict with gaze metrics, zone distribution, and cheat flags.
    """
    print(
        f"[Examiney][GazeFollower] Processing: {os.path.basename(video_path)}, "
        f"session={session_id}"
    )

    if not os.path.exists(video_path):
        print(f"[Examiney][GazeFollower] Video not found: {video_path}")
        return {"provider": "gazefollower", "status": "missing_video"}

    frames = _extract_frames_cv2(video_path, every_n=3)
    if not frames:
        return {"provider": "gazefollower", "status": "no_frames"}

    # ── Path A: GazeFollower ──────────────────────────────────────────────────
    if _GF_AVAILABLE:
        gf = _get_gf()
        if gf is not None:
            import cv2 as _cv2
            gaze_points: List[Tuple[float, float]] = []
            failed_frames = 0
            offscreen_count = 0

            _gf_broken = False
            for frame in frames:
                if _gf_broken:
                    failed_frames += 1
                    continue
                try:
                    rgb_frame = _cv2.cvtColor(frame, _cv2.COLOR_BGR2RGB)
                    result = gf.predict(rgb_frame)
                    if result is not None:
                        h, w = frame.shape[:2]
                        raw_gx = float(result[0]) / max(w, 1)
                        raw_gy = float(result[1]) / max(h, 1)
                        if raw_gx < 0.0 or raw_gx > 1.0 or raw_gy < 0.0 or raw_gy > 1.0:
                            offscreen_count += 1
                        gx = max(0.0, min(1.0, raw_gx))
                        gy = max(0.0, min(1.0, raw_gy))
                        gaze_points.append((gx, gy))
                except AttributeError as _e:
                    # GazeFollower API mismatch (e.g. no 'predict' method) — bail out
                    # immediately and let MediaPipe handle all frames.
                    print(f"[Examiney][GazeFollower] API error, switching to MediaPipe: {_e}")
                    _gf_broken = True
                    failed_frames += 1
                except Exception as _e:
                    if failed_frames == 0:
                        print(f"[Examiney][GazeFollower] First frame error: {_e}")
                    failed_frames += 1

            print(
                f"[Examiney][GazeFollower] {len(gaze_points)} gaze points "
                f"({failed_frames} failed, {offscreen_count} off-screen)"
            )

            if gaze_points:
                return _build_result(
                    gaze_points, "gazefollower", session_id, calibration_data,
                    failed_frames, offscreen_count,
                )

            print("[Examiney][GazeFollower] No gaze points from GazeFollower — trying MediaPipe fallback")

    # ── Path B: MediaPipe iris fallback ───────────────────────────────────────
    if _MP_AVAILABLE:
        print("[Examiney][GazeFollower] Using MediaPipe iris landmark fallback")
        gaze_points = _mediapipe_gaze_from_frames(frames, calibration_data)
        if gaze_points:
            return _build_result(
                gaze_points, "mediapipe_iris", session_id, calibration_data,
            )
        print("[Examiney][GazeFollower] MediaPipe produced no gaze points")

    # ── No usable model ───────────────────────────────────────────────────────
    print(
        "[Examiney][GazeFollower] No gaze model available. "
        "Install GazeFollower (pip install gazefollower) or MediaPipe (pip install mediapipe)."
    )
    return {
        "provider": "none",
        "status":   "no_model",
        "install":  "pip install gazefollower  # or: pip install mediapipe",
    }
