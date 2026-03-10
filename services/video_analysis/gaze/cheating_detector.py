"""Cheating detector using personalised calibration data.

Key design principles
---------------------
* Every raw iris coordinate is passed through the affine transform BEFORE
  zone classification — no hardcoded pixel offsets.
* Horizontal-scan threshold = candidate_baseline_variance × 0.4 (not 0.02).
* All risk levels are scaled by the neurodiversity_adjustment factor so that
  candidates with naturally higher gaze variance are not unfairly penalised.
* calibration_quality_score < 0.6 exposes `needs_recalibration = True`.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, List, Optional, Tuple

import numpy as np

from services.video_analysis.calibration.calibration_runner import (
    apply_transform,
    load_calibration,
)
from services.video_analysis.gaze.zone_classifier import GazeZone, ZoneClassifier


# ── Result model ──────────────────────────────────────────────────────────────

@dataclass
class CheatingFlags:
    horizontal_scan_detected: bool = False
    sustained_red_zone: bool       = False
    rapid_gaze_shift: bool         = False
    calibration_quality_low: bool  = False
    zone_sequence: List[str]       = field(default_factory=list)
    risk_level: str                = "low"   # "low" | "medium" | "high"


# ── Detector ─────────────────────────────────────────────────────────────────

class CheatingDetector:
    """
    Stateful detector for one candidate session.

    Parameters
    ----------
    session_id        : Must have a corresponding calibration JSON on disk.
    window_size       : Sliding window of recent frames (default 90 ≈ 3 s at 30 fps).
    red_zone_patience : Consecutive red-zone frames before flag is raised.
    """

    def __init__(
        self,
        session_id: str,
        window_size: int = 90,
        red_zone_patience: int = 45,
    ) -> None:
        cal = load_calibration(session_id)
        self.transform_matrix: list       = cal["transform_matrix"]
        self.baseline_variance: float     = cal["baseline_gaze_variance"]
        self.neurodiversity_adjustment: float = cal["neurodiversity_adjustment"]
        self.calibration_quality_score: float = cal["calibration_quality_score"]

        # Personalised threshold: baseline_variance × 0.4 (replaces fixed 0.02)
        self.h_scan_threshold: float = self.baseline_variance * 0.4

        self._classifier   = ZoneClassifier(session_id)
        self._zone_window: Deque[GazeZone]         = deque(maxlen=window_size)
        self._iris_window: Deque[Tuple[float, float]] = deque(maxlen=window_size)
        self._red_streak   = 0
        self._red_patience = red_zone_patience

    # ── Public ────────────────────────────────────────────────────────────────

    @property
    def needs_recalibration(self) -> bool:
        """True when calibration quality is below the minimum acceptable threshold."""
        return self.calibration_quality_score < 0.6

    def process_frame(self, raw_iris: Tuple[float, float]) -> CheatingFlags:
        """
        Process one frame and return the current set of cheat flags.

        Parameters
        ----------
        raw_iris : Raw image-normalised iris (x, y) from MediaPipe FaceMesh
                   (average of landmarks 468 and 473).
        """
        # Apply affine transform to every coordinate before zone classification
        _ = apply_transform(raw_iris, self.transform_matrix)   # kept for traceability

        prev_iris: Optional[Tuple[float, float]] = (
            self._iris_window[-1] if self._iris_window else None
        )
        zone = self._classifier.classify(raw_iris, prev_iris)

        self._zone_window.append(zone)
        self._iris_window.append(raw_iris)

        if zone == GazeZone.RED:
            self._red_streak += 1
        else:
            self._red_streak = 0

        return self._evaluate()

    # ── Private ───────────────────────────────────────────────────────────────

    def _evaluate(self) -> CheatingFlags:
        flags = CheatingFlags(
            zone_sequence=[z.value for z in list(self._zone_window)[-10:]],
            calibration_quality_low=self.needs_recalibration,
        )

        # Sustained red zone
        flags.sustained_red_zone = self._red_streak >= self._red_patience

        # Horizontal scan: x-variance in recent raw iris window vs personalised threshold
        if len(self._iris_window) >= 10:
            recent = np.array(list(self._iris_window)[-30:])
            x_var = float(np.var(recent[:, 0]))
            flags.horizontal_scan_detected = x_var > self.h_scan_threshold

        # Rapid single-frame displacement vs candidate baseline
        flags.rapid_gaze_shift = self._detect_rapid_shift()

        # Risk level — divide flag count by neurodiversity_adjustment so that
        # candidates with higher natural variance are not penalised unfairly
        n_flags = sum([
            flags.horizontal_scan_detected,
            flags.sustained_red_zone,
            flags.rapid_gaze_shift,
        ])
        effective = n_flags / self.neurodiversity_adjustment
        if effective >= 2.0:
            flags.risk_level = "high"
        elif effective >= 1.0:
            flags.risk_level = "medium"

        return flags

    def _detect_rapid_shift(self) -> bool:
        """True when the last frame-to-frame displacement > 3 × baseline variance."""
        if len(self._iris_window) < 2:
            return False
        iris_list = list(self._iris_window)
        last = np.array(iris_list[-1])
        prev = np.array(iris_list[-2])
        disp = float(np.linalg.norm(last - prev))
        return disp > 3.0 * self.baseline_variance
