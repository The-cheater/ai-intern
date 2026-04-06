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
        const raw = sessionStorage.getItem("examiney_session");
        const sid: string | null = raw ? (JSON.parse(raw) as { session_id: string }).session_id : null;
        if (sid) setSessionId(sid);
        console.log("[Calibration] Fetching calibration points, session=", sid);
        fetch(`${API_BASE}/calibration/start`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sid ? { session_id: sid } : {}),
        })
            .then(r => r.json())
            .then(data => {
                if (!sid) {
                    // Backend assigned a new session — persist it so page reloads don't lose it
                    setSessionId(data.session_id);
                    const existing = sessionStorage.getItem("examiney_session");
                    const parsed   = existing ? JSON.parse(existing) : {};
                    sessionStorage.setItem("examiney_session", JSON.stringify({ ...parsed, session_id: data.session_id }));
                }
                setCalibPoints((data.calibration_points as [number, number][]).map(([x, y]) => ({ x, y })));
                console.log("[Calibration] Got", data.calibration_points.length, "calibration points");
                setPhase("camera_request");
            })
            .catch((err) => {
                console.error("[Calibration] Failed to fetch calibration points:", err);
                setErrorMsg("Unable to connect. Please check your internet connection and try again.");
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
                sessionStorage.setItem("examiney_calibration", JSON.stringify({
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
                sessionStorage.setItem("examiney_calibration", JSON.stringify({ quality_score: 0, skipped: true, measurements: measurementsRef.current }));
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
                            className="z-50 max-w-sm text-center px-8 py-10 bg-zinc-900 border border-red-500/20 rounded-2xl">
                            <AlertTriangle className="mx-auto mb-4 text-red-400" size={32} strokeWidth={1.5} />
                            <p className="text-white/70 text-sm leading-relaxed">{errorMsg}</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "loading" && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white/30 text-sm">Loading…</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "camera_request" && (
                        <motion.div key="camera" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className="z-10 flex flex-col items-center text-center max-w-md px-8">
                            <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                                <Camera size={28} className="text-white/60" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-white text-2xl font-semibold mb-3">Eye Tracking Setup</h2>
                            <p className="text-white/50 text-sm leading-relaxed mb-2">
                                A dot will appear at <span className="text-white font-medium">{calibPoints.length} positions</span> on screen.
                                Look directly at each one and stay still.
                            </p>
                            <p className="text-white/30 text-xs mb-8 leading-relaxed">Takes about 60 seconds. Sit upright and face the camera.</p>
                            <button onClick={startCamera}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all">
                                <Eye size={16} /> Start Setup
                            </button>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "starting" && (
                        <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                            <div className="w-10 h-10 mx-auto border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                            <p className="text-white/50 text-sm">{initStatus}</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "calibrating" && currentPoint && (
                        <motion.div key="calibrating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0">
                            {/* Top progress bar */}
                            <div className="absolute top-6 left-8 right-8 z-20">
                                <div className="flex justify-between mb-2">
                                    <span className="text-white/30 text-xs">
                                        Step {currentPointIdx + 1} of {calibPoints.length}
                                    </span>
                                    <span className="text-white/30 text-xs">
                                        {isCollecting ? "Hold still…" : `Starting in ${dotCountdown}s`}
                                    </span>
                                </div>
                                <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-indigo-400 rounded-full"
                                        animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
                                </div>
                            </div>
                            {/* Bottom instruction */}
                            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                                <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl">
                                    <p className="text-white/40 text-xs">
                                        {isCollecting ? "Keep looking at the dot…" : "Look at the dot and hold still"}
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
                                        isCollecting ? "bg-emerald-400" : "bg-white"
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
                            <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white/30 text-sm">Almost ready…</p>
                        </motion.div>
                    )}
                    {!errorMsg && phase === "result" && (
                        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="z-10 flex flex-col items-center text-center max-w-sm px-8">
                            {needsRecalibration ? (
                                <>
                                    <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                                        <AlertTriangle size={28} className="text-amber-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-white text-xl font-semibold mb-2">Setup Needs Improvement</h2>
                                    <p className="text-white/40 text-sm mb-6 leading-relaxed">Try improving your lighting, sitting a bit closer, and looking directly at the centre of each dot.</p>
                                    <div className="flex flex-col gap-2 w-full">
                                        <button onClick={retryCalibration}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                                            <RefreshCw size={15} /> Try Again
                                        </button>
                                        <button onClick={() => router.push("/portal/instructions")}
                                            className="bg-white/5 hover:bg-white/10 text-white/50 font-medium text-sm px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10">
                                            <SkipForward size={15} /> Continue Anyway
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
                                        <CheckCircle size={28} className="text-emerald-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="text-white text-xl font-semibold mb-2">Setup Complete</h2>
                                    <p className="text-white/40 text-sm mb-8">You&apos;re all set. Your interview is ready to begin.</p>
                                    <button onClick={() => router.push("/portal/instructions")}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-8 py-3 rounded-xl flex items-center gap-2 transition-all">
                                        Continue <ArrowRight size={16} />
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
