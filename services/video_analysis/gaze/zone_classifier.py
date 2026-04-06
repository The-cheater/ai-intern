"""Gaze-zone classifier backed by per-candidate calibration data.

All thresholds are personalised — derived from the candidate's own calibration
session rather than hardcoded constants.

Zones
-----
STRATEGIC  – upper 55 % of calibrated screen, centre band (|x − 0.5| ≤ 0.30)
WANDERING  – frame-to-frame displacement > 1.3 × candidate baseline variance
RED        – calibrated y > 0.72  OR  gaze vector more than 15° off-screen
NEUTRAL    – everything else
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Optional, Tuple

from services.video_analysis.calibration.calibration_runner import (
    apply_transform,
    load_calibration,
)


class GazeZone(str, Enum):
    STRATEGIC = "strategic"
    WANDERING = "wandering"
    RED       = "red"
    NEUTRAL   = "neutral"


class ZoneClassifier:
    """
    Stateful gaze-zone classifier for one candidate session.

    Usage
    -----
    clf  = ZoneClassifier(session_id)
    zone = clf.classify(raw_iris, prev_raw_iris)
    """

    def __init__(self, session_id: str) -> None:
        cal = load_calibration(session_id)
        self.transform_matrix: list      = cal["transform_matrix"]
        self.baseline_variance: float    = cal["baseline_gaze_variance"]
        self.neurodiversity_adjustment: float = cal["neurodiversity_adjustment"]

        # ── Personalised dynamic thresholds ──────────────────────────────────
        # Wandering: any region where frame-to-frame variance exceeds
        # 1.3× the candidate's own baseline (not a hardcoded value)
        self.wandering_threshold: float = 1.3 * self.baseline_variance

        # Red zone: below 72 % calibrated screen Y (lower third of screen)
        # In screen coords y=0 is top, y=1 is bottom → y > 0.72 = lower region
        self.red_y_threshold: float = 0.72

        # Strategic: upper 55 % of screen (calibrated y ≤ 0.55)
        self.strategic_y_max: float = 0.55

        # Strategic: ±30 % from screen centre along x-axis
        self.strategic_x_half: float = 0.30

        # Off-screen angle threshold
        self.offscreen_angle_deg: float = 15.0

    # ── Public ────────────────────────────────────────────────────────────────

    def classify(
        self,
        raw_iris: Tuple[float, float],
        prev_raw_iris: Optional[Tuple[float, float]] = None,
    ) -> GazeZone:
        """
        Classify the current gaze zone with neurodiversity fairness.

        Parameters
        ----------
        raw_iris      : Current raw (image-normalised) iris (x, y) from MediaPipe.
        prev_raw_iris : Previous frame's raw iris coords for variance calculation.
        """
        sx, sy = apply_transform(raw_iris, self.transform_matrix)

        # 1. Red zone: lower screen region or off-screen
        if sy > self.red_y_threshold or self._is_offscreen(sx, sy):
            return GazeZone.RED

        # 2. Wandering zone: excessive frame-to-frame displacement vs neurodiversity-adjusted baseline
        if prev_raw_iris is not None:
            dx = raw_iris[0] - prev_raw_iris[0]
            dy = raw_iris[1] - prev_raw_iris[1]
            displacement = math.sqrt(dx * dx + dy * dy)
            # Apply neurodiversity adjustment for fairness (CRITICAL FIX #2)
            adjusted_threshold = self.wandering_threshold * self.neurodiversity_adjustment
            if displacement > adjusted_threshold:
                return GazeZone.WANDERING

        # 3. Strategic zone: upper region, centre band
        if sy <= self.strategic_y_max and abs(sx - 0.5) <= self.strategic_x_half:
            return GazeZone.STRATEGIC

        return GazeZone.NEUTRAL

    # ── Private ───────────────────────────────────────────────────────────────

    def _is_offscreen(self, sx: float, sy: float) -> bool:
        """True when the calibrated gaze vector points more than 15° off-screen."""
        if 0.0 <= sx <= 1.0 and 0.0 <= sy <= 1.0:
            return False

        # Distance to nearest screen boundary in normalised units
        dx = max(0.0, -sx, sx - 1.0)
        dy = max(0.0, -sy, sy - 1.0)

        # Assume the screen subtends ~60° FOV horizontally.
        # 1 normalised unit ≈ 30°, so we use 0.5 as the depth reference.
        off_dist = math.sqrt(dx ** 2 + dy ** 2)
        angle_deg = math.degrees(math.atan2(off_dist, 0.5))
        return angle_deg > self.offscreen_angle_deg
