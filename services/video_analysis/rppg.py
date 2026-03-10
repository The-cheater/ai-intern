"""CHROM rPPG algorithm for non-contact heart rate and HRV estimation.

Reference: De Haan & Jeanne (2013) — Robust Pulse Rate From Chrominance-Based
rPPG.  We extract per-frame mean RGB from the face region, apply the CHROM
decomposition, bandpass to the cardiac band (0.75–3 Hz), locate R-peaks and
compute RMSSD as the HRV proxy.
"""

from typing import Dict, Tuple

import numpy as np

_DEFAULTS: Dict = {"avg_hrv_rmssd": 42.0, "hr_bpm": 72.0, "stress_spike_detected": False}


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_rppg_from_video(video_path: str) -> Dict:
    """Run CHROM rPPG on *video_path*.

    Returns:
        {"avg_hrv_rmssd": float, "hr_bpm": float, "stress_spike_detected": bool}
    """
    try:
        import cv2
    except ImportError:
        print("[NeuroSync][rPPG] cv2 not installed — returning defaults.")
        return _DEFAULTS.copy()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _DEFAULTS.copy()

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    rgb_signals: list = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        rgb = _mean_face_rgb(frame)
        if rgb is not None:
            rgb_signals.append(rgb)

    cap.release()

    if len(rgb_signals) < int(fps * 5):
        return _DEFAULTS.copy()

    try:
        rmssd, hr_bpm, stress = _chrom(np.array(rgb_signals, dtype=np.float64), fps)
        return {"avg_hrv_rmssd": rmssd, "hr_bpm": hr_bpm, "stress_spike_detected": stress}
    except Exception as exc:
        print(f"[NeuroSync][rPPG] CHROM failed: {exc}")
        return _DEFAULTS.copy()


# ── Private helpers ───────────────────────────────────────────────────────────

def _mean_face_rgb(frame: np.ndarray) -> np.ndarray | None:
    """Return mean [R, G, B] of the central face region."""
    h, w = frame.shape[:2]
    roi = frame[int(h * 0.2): int(h * 0.7), int(w * 0.2): int(w * 0.8)]
    if roi.size == 0:
        return None
    bgr = roi.reshape(-1, 3).mean(axis=0)
    return bgr[::-1].copy()  # BGR → RGB


def _chrom(rgb: np.ndarray, fps: float) -> Tuple[float, float, bool]:
    """CHROM algorithm → (rmssd_ms, hr_bpm, stress_spike)."""
    means = rgb.mean(axis=0)
    means = np.where(means == 0, 1e-6, means)
    norm = rgb / means                     # channel-normalised

    R, G, B = norm[:, 0], norm[:, 1], norm[:, 2]
    Xs = 3 * R - 2 * G
    Ys = 1.5 * R + G - 1.5 * B
    alpha = Xs.std() / (Ys.std() or 1e-6)
    S = Xs - alpha * Ys                    # pulse signal

    N = len(S)
    freqs = np.fft.fftfreq(N, d=1.0 / fps)
    F = np.fft.fft(S)

    # Zero out non-cardiac frequencies
    mask = (np.abs(freqs) < 0.75) | (np.abs(freqs) > 3.0)
    F[mask] = 0

    pos = (freqs > 0.75) & (freqs < 3.0)
    if not pos.any():
        return 42.0, 72.0, False

    hr_freq = freqs[pos][np.abs(F[pos]).argmax()]
    hr_bpm = float(hr_freq * 60.0)

    # RMSSD from R-peak intervals
    sig_filt = np.real(np.fft.ifft(F))
    try:
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(sig_filt, distance=int(fps * 0.4))
        if len(peaks) > 2:
            rr_ms = np.diff(peaks) / fps * 1000
            rmssd = float(np.sqrt(np.mean(np.diff(rr_ms) ** 2)))
        else:
            rmssd = 42.0
    except Exception:
        rmssd = 42.0

    stress = bool(rmssd < 20.0 or hr_bpm > 100.0)
    return round(rmssd, 2), round(hr_bpm, 2), stress
