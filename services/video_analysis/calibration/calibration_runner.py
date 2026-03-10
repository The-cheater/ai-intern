"""Screen calibration runner for gaze-tracking interviews.

Implements a 15-point calibration sequence.  The frontend displays one dot at a
time, captures 30 frames of iris landmark data per dot via MediaPipe FaceMesh
(landmarks 468 and 473) in the browser, and sends averaged iris coordinates to
this module.  We then fit a personal affine transform (numpy.linalg.lstsq) that
maps raw iris coords → actual screen coords, compute per-candidate baseline
stats, and persist everything to outputs/calibration/{session_id}_calibration.json.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import List, Tuple

import numpy as np

# ── Calibration point layout (normalised screen fractions x, y) ──────────────
# (0,0) = top-left corner; (1,1) = bottom-right corner
CALIBRATION_POINTS: List[Tuple[float, float]] = [
    (0.0,  0.0),   # top-left
    (1.0,  0.0),   # top-right
    (0.0,  1.0),   # bottom-left
    (1.0,  1.0),   # bottom-right
    (0.5,  0.0),   # top-center
    (0.5,  1.0),   # bottom-center
    (0.0,  0.5),   # left-center
    (1.0,  0.5),   # right-center
    (0.5,  0.5),   # center
    (0.25, 0.25),  # upper-left-inner
    (0.75, 0.25),  # upper-right-inner
    (0.25, 0.75),  # lower-left-inner
    (0.75, 0.75),  # lower-right-inner
    (0.25, 0.5),   # mid-left-inner
    (0.75, 0.5),   # mid-right-inner
]

FRAMES_PER_POINT = 30
BLINK_THRESHOLD = 0.004          # normalised vertical iris displacement
NEURODIVERSITY_VARIANCE_THRESHOLD = 0.06
NEURODIVERSITY_SCALE = 1.4

# outputs/calibration/ lives at the repo root
OUTPUTS_DIR = Path(__file__).resolve().parents[3] / "outputs" / "calibration"


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class IrisSample:
    """One frame's worth of iris data (both eyes averaged into one x,y)."""
    x: float   # raw iris x, normalised to image width  [0, 1]
    y: float   # raw iris y, normalised to image height [0, 1]


@dataclass
class PointMeasurement:
    """30 iris samples captured while the candidate looked at one dot."""
    screen_x: float              # calibration dot x, normalised [0, 1]
    screen_y: float              # calibration dot y, normalised [0, 1]
    iris_samples: List[IrisSample]   # exactly FRAMES_PER_POINT samples


@dataclass
class CalibrationResult:
    session_id: str
    transform_matrix: List[List[float]]   # 3×2 affine (row-vector form)
    baseline_gaze_variance: float         # mean frame-to-frame iris displacement
    baseline_blink_rate: float            # blinks per minute
    neurodiversity_adjustment: float      # 1.0 or 1.4
    calibration_quality_score: float      # 0.0 – 1.0
    needs_recalibration: bool
    calibration_points: List[List[float]] # [[sx, sy], …] for each of 15 dots
    timestamp: float = field(default_factory=time.time)


# ── Private helpers ───────────────────────────────────────────────────────────

def _average_iris(samples: List[IrisSample]) -> np.ndarray:
    """Mean [x, y] across all samples in a single-dot cluster."""
    if not samples:
        return np.array([0.0, 0.0])
    return np.array([
        float(np.mean([s.x for s in samples])),
        float(np.mean([s.y for s in samples])),
    ])


def _cluster_variance(samples: List[IrisSample]) -> float:
    """Mean frame-to-frame Euclidean iris displacement within one cluster."""
    if len(samples) < 2:
        return 0.0
    xs = np.array([s.x for s in samples])
    ys = np.array([s.y for s in samples])
    dx = np.diff(xs)
    dy = np.diff(ys)
    return float(np.mean(np.sqrt(dx ** 2 + dy ** 2)))


def _fit_affine_transform(
    iris_coords: np.ndarray,    # shape (N, 2) – raw iris averages
    screen_coords: np.ndarray,  # shape (N, 2) – target screen positions
) -> np.ndarray:
    """
    Fit affine map using least-squares:
        screen ≈ [iris_x, iris_y, 1] @ A
    Returns A with shape (3, 2).
    Apply: screen_point = np.array([ix, iy, 1.0]) @ A
    """
    N = iris_coords.shape[0]
    iris_h = np.hstack([iris_coords, np.ones((N, 1))])        # (N, 3)
    A, _, _, _ = np.linalg.lstsq(iris_h, screen_coords, rcond=None)  # (3, 2)
    return A


def _calibration_quality(measurements: List[PointMeasurement]) -> float:
    """
    Quality score in [0, 1].
    Tight, consistent iris clusters per dot → score close to 1.
    A mean cluster variance of 0.05 maps to 0 quality.
    """
    if not measurements:
        return 0.0
    variances = [_cluster_variance(m.iris_samples) for m in measurements]
    mean_var = float(np.mean(variances))
    quality = max(0.0, 1.0 - mean_var / 0.05)
    return round(quality, 4)


def _baseline_gaze_variance(measurements: List[PointMeasurement]) -> float:
    """Mean frame-to-frame iris displacement across ALL calibration clusters."""
    if not measurements:
        return 0.0
    return round(float(np.mean([_cluster_variance(m.iris_samples) for m in measurements])), 6)


def _baseline_blink_rate(measurements: List[PointMeasurement]) -> float:
    """
    Estimate blinks-per-minute from iris y-trajectory.
    A blink manifests as a large downward–upward jump in iris y when the eyelid
    briefly occludes the iris; we proxy this as consecutive iris-y differences
    exceeding BLINK_THRESHOLD.  Assumes ~30 fps capture.
    """
    blink_count = 0
    total_frames = 0
    for m in measurements:
        ys = np.array([s.y for s in m.iris_samples])
        diffs = np.abs(np.diff(ys))
        blink_count += int(np.sum(diffs > BLINK_THRESHOLD))
        total_frames += len(m.iris_samples)

    if total_frames < 2:
        return 0.0
    seconds = total_frames / 30.0
    return round(blink_count / (seconds / 60.0), 2)


def _persist(result: CalibrationResult) -> None:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS_DIR / f"{result.session_id}_calibration.json"
    with path.open("w") as f:
        json.dump(asdict(result), f, indent=2)


# ── Public API ────────────────────────────────────────────────────────────────

def get_calibration_points() -> List[Tuple[float, float]]:
    """Return the ordered list of calibration point (x, y) coordinates."""
    return list(CALIBRATION_POINTS)


def run_calibration(
    session_id: str,
    measurements: List[PointMeasurement],
) -> CalibrationResult:
    """
    Fit the affine transform and compute all baseline statistics.

    Parameters
    ----------
    session_id   : Unique interview session identifier.
    measurements : One PointMeasurement per calibration dot (15 expected),
                   each containing FRAMES_PER_POINT IrisSample objects.

    Returns
    -------
    CalibrationResult written to
        outputs/calibration/{session_id}_calibration.json
    """
    if not measurements:
        raise ValueError("No calibration measurements provided.")

    iris_coords = np.array([_average_iris(m.iris_samples) for m in measurements])
    screen_coords = np.array([[m.screen_x, m.screen_y] for m in measurements])

    A = _fit_affine_transform(iris_coords, screen_coords)

    quality = _calibration_quality(measurements)
    variance = _baseline_gaze_variance(measurements)
    blink_rate = _baseline_blink_rate(measurements)
    neuro_adj = NEURODIVERSITY_SCALE if variance > NEURODIVERSITY_VARIANCE_THRESHOLD else 1.0

    result = CalibrationResult(
        session_id=session_id,
        transform_matrix=A.tolist(),          # 3×2 nested list
        baseline_gaze_variance=variance,
        baseline_blink_rate=blink_rate,
        neurodiversity_adjustment=neuro_adj,
        calibration_quality_score=quality,
        needs_recalibration=quality < 0.6,
        calibration_points=[[sx, sy] for sx, sy in CALIBRATION_POINTS],
    )

    _persist(result)
    return result


def load_calibration(session_id: str) -> dict:
    """Load a previously saved calibration JSON for *session_id*."""
    path = OUTPUTS_DIR / f"{session_id}_calibration.json"
    if not path.exists():
        raise FileNotFoundError(f"No calibration found for session '{session_id}'.")
    with path.open() as f:
        return json.load(f)


def apply_transform(
    raw_iris: Tuple[float, float],
    transform_matrix: List[List[float]],
) -> Tuple[float, float]:
    """
    Map one raw iris coordinate through the 3×2 affine matrix.

    Parameters
    ----------
    raw_iris         : (x, y) normalised iris coordinate from MediaPipe.
    transform_matrix : The 3×2 matrix stored in CalibrationResult.

    Returns
    -------
    (screen_x, screen_y) in normalised screen coordinates.
    """
    A = np.array(transform_matrix)                          # (3, 2)
    iris_h = np.array([raw_iris[0], raw_iris[1], 1.0])     # (3,)
    screen = iris_h @ A                                     # (2,)
    return (float(screen[0]), float(screen[1]))
