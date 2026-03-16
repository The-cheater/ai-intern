"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, CheckCircle, AlertTriangle, RefreshCw, ArrowRight, Camera, SkipForward } from "lucide-react";

interface CalibrationPoint { x: number; y: number }
interface IrisSample       { x: number; y: number }
interface PointMeasurement { screen_x: number; screen_y: number; iris_samples: IrisSample[] }

type Phase = "loading" | "camera_request" | "starting" | "calibrating" | "submitting" | "result";

const SAMPLES_PER_POINT = 40;      // more samples = more stable fit
const COLLECT_DELAY_MS  = 1800;
const POLL_MS           = 66;      // ~15 FPS
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

declare global { interface Window { FaceMesh: unknown } }

export default function CalibrationPage() {
    const router = useRouter();

    const [phase,              setPhase]             = useState<Phase>("loading");
    const [sessionId,          setSessionId]          = useState("");
    const [calibPoints,        setCalibPoints]        = useState<CalibrationPoint[]>([]);
    const [currentPointIdx,    setCurrentPointIdx]    = useState(0);
    const [capturedCount,      setCapturedCount]      = useState(0);
    const [qualityScore,       setQualityScore]       = useState(0);
    const [needsRecalibration, setNeedsRecalibration] = useState(false);
    const [errorMsg,           setErrorMsg]           = useState("");
    const [initStatus,         setInitStatus]         = useState("");
    const [dotCountdown,       setDotCountdown]       = useState(3);
    const [isCollecting,       setIsCollecting]       = useState(false);

    const videoRef         = useRef<HTMLVideoElement>(null);
    const canvasRef        = useRef<HTMLCanvasElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const faceMeshRef      = useRef<any>(null);
    const faceMeshReadyRef = useRef(false);
    const rafRef           = useRef(0);
    const irisBufferRef    = useRef<IrisSample[]>([]);
    const measurementsRef  = useRef<PointMeasurement[]>([]);
    const collectingRef    = useRef(false);
    const collectionSamples= useRef<IrisSample[]>([]);
    const captureTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
    const calibPointsRef    = useRef<CalibrationPoint[]>([]);

    useEffect(() => { calibPointsRef.current = calibPoints; }, [calibPoints]);

    // ── Step 1: fetch session + calibration points ─────────────────────────────
    useEffect(() => {
        const raw = sessionStorage.getItem("neurosync_session");
        const sid: string | null = raw ? (JSON.parse(raw) as { session_id: string }).session_id : null;
        if (sid) setSessionId(sid);
        console.log("[Calibration] Fetching calibration points, session=", sid);
        fetch(`${API_BASE}/calibration/start`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sid ? { session_id: sid } : {}),
        })
            .then(r => r.json())
            .then(data => {
                if (!sid) setSessionId(data.session_id);
                setCalibPoints((data.calibration_points as [number, number][]).map(([x, y]) => ({ x, y })));
                console.log("[Calibration] Got", data.calibration_points.length, "calibration points");
                setPhase("camera_request");
            })
            .catch((err) => {
                console.error("[Calibration] Failed to fetch calibration points:", err);
                setErrorMsg("Failed to connect to the API. Is the backend running?");
            });
    }, []);

    // ── FaceMesh init ─────────────────────────────────────────────────────────
    const initFaceMeshEarly = useCallback(() => {
        if (!window.FaceMesh || faceMeshReadyRef.current) return;
        console.log("[Calibration] Initialising FaceMesh...");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fm = new (window.FaceMesh as any)({
            locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`,
        });
        fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fm.onResults((results: any) => {
            const lm = results.multiFaceLandmarks?.[0];
            if (lm?.length > 473) {
                const iris: IrisSample = { x: (lm[468].x + lm[473].x) / 2, y: (lm[468].y + lm[473].y) / 2 };
                irisBufferRef.current.push(iris);
                if (irisBufferRef.current.length > 120) irisBufferRef.current.shift();
            }
        });
        faceMeshRef.current = fm;
        const warm = document.createElement("canvas"); warm.width = 64; warm.height = 64;
        fm.send({ image: warm }).then(() => {
            faceMeshReadyRef.current = true;
            console.log("[Calibration] FaceMesh ready");
        }).catch(() => { faceMeshReadyRef.current = true; });
    }, []);

    // ── Continuous RAF feed loop ───────────────────────────────────────────────
    const startFeedLoop = useCallback(() => {
        const loop = () => {
            const v = videoRef.current, c = canvasRef.current, fm = faceMeshRef.current;
            if (v && c && fm && !v.paused) {
                const ctx = c.getContext("2d");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (ctx) { ctx.drawImage(v, 0, 0, c.width, c.height); (fm as any).send({ image: c }).catch(() => {}); }
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
    }, []);
    const stopFeedLoop = useCallback(() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    // ── Enable Camera ──────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setPhase("starting"); setInitStatus("Starting camera…");
        console.log("[Calibration] Starting camera...");
        try {
            const [stream] = await Promise.all([
                navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } }),
                new Promise<void>(resolve => {
                    if (faceMeshReadyRef.current) { resolve(); return; }
                    setInitStatus("Loading face tracking AI…");
                    const t = setInterval(() => { if (faceMeshReadyRef.current) { clearInterval(t); resolve(); } }, 100);
                    setTimeout(() => { clearInterval(t); faceMeshReadyRef.current = true; resolve(); }, 5000);
                }),
            ]);
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            console.log("[Calibration] Camera started, beginning calibration");
            setPhase("calibrating");
        } catch (err) {
            console.error("[Calibration] Camera access failed:", err);
            setErrorMsg("Camera access denied. Please allow camera access and reload.");
        }
    }, []);

    useEffect(() => {
        if (phase === "calibrating") { startFeedLoop(); return () => stopFeedLoop(); }
    }, [phase, startFeedLoop, stopFeedLoop]);

    // ── Per-dot: countdown then collect ───────────────────────────────────────
    const runDot = useCallback((pointIdx: number) => {
        irisBufferRef.current = [];
        let cd = 3;
        setDotCountdown(cd);
        setIsCollecting(false);
        setCapturedCount(0);
        console.log(`[Calibration] Dot ${pointIdx + 1} — countdown starting`);

        countdownRef.current = setInterval(() => {
            cd--;
            if (cd <= 0) {
                clearInterval(countdownRef.current!);
                collectingRef.current  = true;
                collectionSamples.current = [];
                setIsCollecting(true);
                console.log(`[Calibration] Dot ${pointIdx + 1} — collecting iris samples`);

                captureTimerRef.current = setInterval(() => {
                    const buf = irisBufferRef.current;
                    const latest = buf.length ? buf[buf.length - 1] : null;
                    if (latest) collectionSamples.current.push(latest);
                    const count = Math.min(collectionSamples.current.length, SAMPLES_PER_POINT);
                    setCapturedCount(count);

                    if (collectionSamples.current.length >= SAMPLES_PER_POINT) {
                        clearInterval(captureTimerRef.current!);
                        collectingRef.current = false;
                        setIsCollecting(false);

                        const pts   = calibPointsRef.current;
                        const point = pts[pointIdx];
                        measurementsRef.current.push({
                            screen_x: point.x, screen_y: point.y,
                            iris_samples: collectionSamples.current.slice(0, SAMPLES_PER_POINT),
                        });
                        console.log(`[Calibration] Dot ${pointIdx + 1} collected ${SAMPLES_PER_POINT} samples`);
                        const next = pointIdx + 1;
                        if (next >= pts.length) setPhase("submitting");
                        else setCurrentPointIdx(next);
                    }
                }, POLL_MS);
            } else {
                setDotCountdown(cd);
            }
        }, 1000);
    }, []);

    useEffect(() => {
        if (phase !== "calibrating" || calibPoints.length === 0) return;
        const t = setTimeout(() => runDot(currentPointIdx), COLLECT_DELAY_MS);
        return () => {
            clearTimeout(t);
            if (countdownRef.current)    clearInterval(countdownRef.current);
            if (captureTimerRef.current) clearInterval(captureTimerRef.current);
            collectingRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, currentPointIdx, calibPoints.length]);

    // ── Submit to backend ─────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "submitting") return;
        stopFeedLoop();
        console.log("[Calibration] Submitting", measurementsRef.current.length, "measurements to backend");
        fetch(`${API_BASE}/calibration/submit`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, measurements: measurementsRef.current }),
        })
            .then(r => r.json())
            .then(data => {
                console.log("[Calibration] Submit result:", data);
                sessionStorage.setItem("neurosync_calibration", JSON.stringify({
                    quality_score: data.calibration_quality_score,
                    needs_recalibration: data.needs_recalibration,
                    measurements: measurementsRef.current,  // save for GazeFollower mapping
                }));
                setQualityScore(data.calibration_quality_score);
                setNeedsRecalibration(data.needs_recalibration);
                setPhase("result");  // Go directly to result — no verification phase
            })
            .catch((err) => {
                console.error("[Calibration] Submit failed:", err);
                // Continue anyway — calibration is optional for the interview
                sessionStorage.setItem("neurosync_calibration", JSON.stringify({ quality_score: 0, skipped: true, measurements: measurementsRef.current }));
                setNeedsRecalibration(false);
                setPhase("result");
            });
    }, [phase, sessionId, stopFeedLoop]);

    const retryCalibration = useCallback(() => {
        measurementsRef.current = []; collectionSamples.current = [];
        collectingRef.current = false; irisBufferRef.current = [];
        if (captureTimerRef.current)  clearInterval(captureTimerRef.current);
        if (countdownRef.current)     clearInterval(countdownRef.current);
        setCurrentPointIdx(0); setCapturedCount(0); setDotCountdown(3); setIsCollecting(false);
        console.log("[Calibration] Retrying calibration");
        setPhase("calibrating");
    }, []);

    useEffect(() => () => {
        stopFeedLoop();
        if (captureTimerRef.current)   clearInterval(captureTimerRef.current);
        if (countdownRef.current)      clearInterval(countdownRef.current);
        if (videoRef.current?.srcObject)
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }, [stopFeedLoop]);

    const dotStyle = (pt: CalibrationPoint) => ({ left: `${pt.x * 86 + 7}%`, top: `${pt.y * 86 + 7}%` });
    const currentPoint = calibPoints[currentPointIdx];
    const progress     = calibPoints.length > 0 ? (currentPointIdx / calibPoints.length) * 100 : 0;
    const pct          = Math.round(qualityScore * 100);

    return (
        <>
            <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js"
                strategy="afterInteractive" onLoad={initFaceMeshEarly} />
            <video  ref={videoRef}  className="hidden" width={320} height={240} muted playsInline />
            <canvas ref={canvasRef} className="hidden" width={320} height={240} />

            {/* Black background for calibration — critical for gaze accuracy */}
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center select-none overflow-hidden">

                <AnimatePresence mode="wait">
                    {errorMsg && (
                        <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="z-50 max-w-md text-center px-10 py-12 bg-zinc-900 border border-red-500/30 rounded-[2rem] shadow-2xl">
                            <AlertTriangle className="mx-auto mb-6 text-red-400" size={48} strokeWidth={1.5} />
                            <p className="text-white/70 text-lg">{errorMsg}</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "loading" && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="w-16 h-16 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin mx-auto mb-6" />
                            <p className="text-white/40 text-sm uppercase tracking-widest">Initialising…</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "camera_request" && (
                        <motion.div key="camera" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="z-10 flex flex-col items-center text-center max-w-lg px-8">
                            <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-8">
                                <Camera size={40} className="text-indigo-400" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-white text-4xl font-black italic tracking-tighter mb-4">Gaze Calibration</h2>
                            <p className="text-white/50 text-lg leading-relaxed mb-3">
                                A dot will appear at{" "}
                                <span className="text-white font-semibold">{calibPoints.length} positions</span>.
                                Look directly at each dot and hold still.
                            </p>
                            <p className="text-white/30 text-sm mb-10">Takes about 60 seconds. Sit upright, face the camera directly. <br/>The black background improves tracking accuracy.</p>
                            <button onClick={startCamera}
                                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-sm uppercase tracking-[0.15em] px-10 py-5 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-indigo-900/40">
                                <Eye size={20} /> Enable Camera &amp; Begin
                            </button>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "starting" && (
                        <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
                            <div className="w-20 h-20 mx-auto relative">
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                            </div>
                            <p className="text-white/70 font-bold text-xl">{initStatus}</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "calibrating" && currentPoint && (
                        <motion.div key="calibrating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0">
                            {/* Top HUD */}
                            <div className="absolute top-6 left-8 right-8 z-20">
                                <div className="flex justify-between mb-2">
                                    <span className="text-white/40 text-[11px] uppercase tracking-widest">
                                        Point {currentPointIdx + 1} / {calibPoints.length}
                                    </span>
                                    <span className="text-white/40 text-[11px] uppercase tracking-widest">
                                        {isCollecting ? `Capturing ${capturedCount}/${SAMPLES_PER_POINT}` : `Ready in ${dotCountdown}s…`}
                                    </span>
                                </div>
                                <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-indigo-400 rounded-full"
                                        animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
                                </div>
                            </div>
                            {/* Bottom instruction */}
                            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                                <div className="bg-white/5 border border-white/10 px-8 py-4 rounded-2xl backdrop-blur-sm">
                                    <p className="text-white/50 text-sm uppercase tracking-widest">
                                        {isCollecting ? "Hold your gaze — capturing…" : "Look at the dot and hold still"}
                                    </p>
                                </div>
                            </div>
                            {/* Calibration dot */}
                            <AnimatePresence mode="wait">
                                <motion.div key={currentPointIdx} style={dotStyle(currentPoint)}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 260, damping: 26 }}>
                                    {/* Pulse ring */}
                                    <motion.div className={`absolute rounded-full ${isCollecting ? "bg-emerald-400/15" : "bg-indigo-400/15"}`}
                                        animate={{ scale: [1, 3, 1], opacity: [0.6, 0, 0.6] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        style={{ width: 40, height: 40, margin: -12 }} />
                                    {/* Core dot */}
                                    <div className={`w-5 h-5 rounded-full transition-colors duration-300 ${
                                        isCollecting
                                            ? "bg-emerald-400 shadow-[0_0_30px_10px_rgba(52,211,153,0.9)]"
                                            : "bg-white shadow-[0_0_30px_10px_rgba(255,255,255,0.6)]"
                                    }`} />
                                    {/* Progress ring */}
                                    <svg className="absolute -rotate-90" width={52} height={52} style={{ top: -16, left: -16 }}>
                                        <circle cx={26} cy={26} r={22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
                                        <motion.circle cx={26} cy={26} r={22} fill="none"
                                            stroke={isCollecting ? "#34d399" : "#818cf8"} strokeWidth={3}
                                            strokeDasharray={`${2 * Math.PI * 22}`}
                                            strokeDashoffset={`${2 * Math.PI * 22 * (1 - (isCollecting ? capturedCount / SAMPLES_PER_POINT : 0))}`}
                                            strokeLinecap="round" className="transition-all duration-100" />
                                    </svg>
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "submitting" && (
                        <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="w-16 h-16 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin mx-auto mb-6" />
                            <p className="text-white/50 text-sm uppercase tracking-widest">Computing your gaze profile…</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "result" && (
                        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="z-10 flex flex-col items-center text-center max-w-md px-8">
                            {needsRecalibration ? (
                                <>
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                                        <AlertTriangle size={36} className="text-amber-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-white text-4xl font-black italic tracking-tighter mb-3">Low Accuracy</h2>
                                    <p className="text-white/50 text-base mb-1">Quality: <span className="text-amber-400 font-semibold">{pct}%</span> <span className="text-white/30">(60% required)</span></p>
                                    <p className="text-white/30 text-sm mb-8">Tip: improve lighting, sit closer, look at the centre of each dot.</p>
                                    <div className="flex flex-col gap-3 w-full">
                                        <button onClick={retryCalibration}
                                            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-sm uppercase tracking-[0.15em] px-10 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                                            <RefreshCw size={18} /> Try Again
                                        </button>
                                        <button onClick={() => router.push("/portal/instructions")}
                                            className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 font-black text-sm uppercase tracking-[0.15em] px-10 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all border border-white/10">
                                            <SkipForward size={18} /> Proceed Anyway
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                                        <CheckCircle size={36} className="text-emerald-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-white text-4xl font-black italic tracking-tighter mb-3">Calibration Complete</h2>
                                    <p className="text-white/50 text-base mb-1">Quality: <span className="text-emerald-400 font-semibold">{pct}%</span></p>
                                    <p className="text-white/30 text-sm mb-10">Gaze tracking is personalised to your eyes and screen.</p>
                                    <button onClick={() => router.push("/portal/instructions")}
                                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-sm uppercase tracking-[0.15em] px-10 py-5 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-indigo-900/40">
                                        Continue to Interview <ArrowRight size={20} />
                                    </button>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
