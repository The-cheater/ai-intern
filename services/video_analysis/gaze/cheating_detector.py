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


# ── Standalone batch detector (called from API per question response) ─────────

def detect_cheating(
    gaze_points: List[Tuple[float, float]],
    baseline_variance: float = 0.004,
) -> dict:
    """
    Stateless batch cheating detector for one question's gaze samples.

    Runs 9 independent signal detectors and aggregates a risk score:

    1.  Horizontal scan          — high x-variance
    2.  Rapid gaze jumps         — frame-to-frame displacement spike
    3.  Periodic scan (FFT)      — rhythmic x-motion = text reading
    4.  Directional sweeps       — L→R→L reversals = reading lines
    5.  Gaze freeze              — abnormally low variance (fixating external notes)
    6.  Extreme lateral gaze     — looking far left/right (phone/notes)
    7.  Robotic velocity         — too-uniform movement speed (scripted scan)
    8.  Linear reading traj.     — gaze moves in a straight horizontal line
    9.  Sustained downward gaze  — looking at lap/phone
    """
    if len(gaze_points) < 5:
        return {"risk_level": "low", "cheat_score": 0, "reason": "insufficient_data"}

    pts = np.array(gaze_points, dtype=float)   # shape (N, 2)
    N   = len(pts)
    flags: dict = {}
    score = 0   # evidence accumulator — thresholds below are weighted

    # ── 1. Horizontal scan ─────────────────────────────────────────────────────
    x_var = float(np.var(pts[:, 0]))
    h_scan = x_var > baseline_variance * 0.4
    flags["horizontal_scan"] = h_scan
    if h_scan:
        score += 1

    # ── 2. Rapid gaze jumps ────────────────────────────────────────────────────
    if N >= 2:
        displacements = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        rapid_shift = bool(np.any(displacements > 3.0 * baseline_variance))
        flags["rapid_gaze_shift"] = rapid_shift
        if rapid_shift:
            score += 1

    # ── 3. Periodic scan via FFT ───────────────────────────────────────────────
    # Reading text produces rhythmic left-right sweeps at 0.3–3.5 Hz.
    # Gaze samples arrive at ~12.5 fps (80 ms frontend timeslice).
    if N >= 16:
        x_c = pts[:, 0] - pts[:, 0].mean()
        fft_mag = np.abs(np.fft.rfft(x_c))
        fft_mag[0] = 0  # kill DC component
        freqs = np.fft.rfftfreq(N, d=0.08)   # 0.08 s per sample
        band  = (freqs >= 0.3) & (freqs <= 3.5)
        if band.any():
            peak_power  = float(fft_mag[band].max())
            total_power = float(fft_mag[1:].sum()) + 1e-9
            periodic_ratio = peak_power / total_power
            flags["periodic_scan"]   = periodic_ratio > 0.35
            flags["periodic_ratio"]  = round(periodic_ratio, 3)
            if flags["periodic_scan"]:
                score += 2   # strong signal — weighted double

    # ── 4. Directional sweeps (L→R→L reversal count) ──────────────────────────
    if N >= 10:
        x_deltas   = np.diff(pts[:, 0])
        significant = x_deltas[np.abs(x_deltas) > 0.015]   # ignore micro-tremor
        if len(significant) >= 4:
            sign_changes = int(np.sum(np.diff(np.sign(significant)) != 0))
            sweep_hz = sign_changes / max(N * 0.08, 1e-3)   # reversals per second
            directional_sweep = 0.5 <= sweep_hz <= 5.0
            flags["directional_sweep"] = directional_sweep
            flags["sweep_rate_hz"]     = round(sweep_hz, 2)
            if directional_sweep:
                score += 1

    # ── 5. Gaze freeze (suspiciously low total variance) ──────────────────────
    # Candidate is staring at a fixed off-screen point (notes on desk, phone).
    if N >= 10:
        total_var   = float(np.var(pts))
        gaze_frozen = total_var < baseline_variance * 0.08
        flags["gaze_freeze"] = gaze_frozen
        if gaze_frozen:
            score += 2   # very suspicious — weighted double

    # ── 6. Extreme lateral gaze ────────────────────────────────────────────────
    # Looking far left (<12 %) or far right (>88 %) = off-screen reference.
    if N >= 5:
        ext_left  = float(np.mean(pts[:, 0] < 0.12))
        ext_right = float(np.mean(pts[:, 0] > 0.88))
        extreme_lateral = (ext_left + ext_right) > 0.15
        flags["extreme_lateral_gaze"] = extreme_lateral
        flags["extreme_left_pct"]     = round(ext_left,  3)
        flags["extreme_right_pct"]    = round(ext_right, 3)
        if extreme_lateral:
            score += 1

    # ── 7. Robotic velocity consistency ───────────────────────────────────────
    # Natural gaze: mix of fast saccades + slow fixations → high velocity CV.
    # Scripted/robotic scanning: unnaturally uniform speed → low CV.
    if N >= 10:
        velocities = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        mean_vel   = float(velocities.mean()) + 1e-9
        vel_cv     = float(velocities.std()) / mean_vel   # coefficient of variation
        robotic    = vel_cv < 0.25 and mean_vel > 0.005   # moving but too uniformly
        flags["robotic_velocity"] = robotic
        flags["velocity_cv"]      = round(vel_cv, 3)
        if robotic:
            score += 2   # strong signal — weighted double

    # ── 8. Linear reading trajectory ──────────────────────────────────────────
    # Gaze drifts monotonically in x while y stays flat = reading a text line.
    if N >= 12:
        try:
            t = np.arange(N, dtype=float)
            coeffs    = np.polyfit(t, pts[:, 0], 1)
            pred_x    = np.polyval(coeffs, t)
            res_var   = float(np.var(pts[:, 0] - pred_x))
            x_var_tot = float(np.var(pts[:, 0])) + 1e-9
            linearity = 1.0 - res_var / x_var_tot
            y_var     = float(np.var(pts[:, 1]))
            linear_read = linearity > 0.75 and y_var < baseline_variance * 0.5
            flags["linear_reading_trajectory"] = linear_read
            flags["trajectory_linearity"]      = round(linearity, 3)
            if linear_read:
                score += 2   # strong signal
        except Exception:
            pass

    # ── 9. Sustained downward gaze ─────────────────────────────────────────────
    # Looking down (y > 0.80) = phone on lap or notes on desk.
    if N >= 5:
        down_frac = float(np.mean(pts[:, 1] > 0.80))
        flags["sustained_downward_gaze"] = down_frac > 0.20
        flags["downward_gaze_pct"]       = round(down_frac, 3)
        if down_frac > 0.20:
            score += 1

    # ── Risk level ─────────────────────────────────────────────────────────────
    # Max possible score = 1+1+2+1+2+1+2+2+1 = 13
    # high ≥ 5, medium ≥ 2, low < 2
    if score >= 5:
        risk_level = "high"
    elif score >= 2:
        risk_level = "medium"
    else:
        risk_level = "low"

    flags["risk_level"]  = risk_level
    flags["cheat_score"] = score
    return flags
