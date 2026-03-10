"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, CheckCircle, AlertTriangle, RefreshCw, ArrowRight, Camera } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalibrationPoint { x: number; y: number }
interface IrisSample       { x: number; y: number }
interface PointMeasurement {
    screen_x: number;
    screen_y: number;
    iris_samples: IrisSample[];
}

type Phase =
    | "loading"       // waiting for /calibration/start
    | "camera_request"// prompt user to click Enable Camera
    | "starting"      // camera + facemesh init in parallel (brief)
    | "calibrating"   // walking through dots
    | "submitting"    // POST /calibration/submit
    | "result";       // show quality score

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAMES_PER_POINT = 30;
const CAPTURE_INTERVAL = 100;
const API_BASE         = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        FaceMesh: any;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalibrationPage() {
    const router = useRouter();

    const [phase,              setPhase]             = useState<Phase>("loading");
    const [sessionId,          setSessionId]          = useState<string>("");
    const [calibPoints,        setCalibPoints]        = useState<CalibrationPoint[]>([]);
    const [currentPointIdx,    setCurrentPointIdx]    = useState<number>(0);
    const [capturedCount,      setCapturedCount]      = useState<number>(0);
    const [qualityScore,       setQualityScore]       = useState<number>(0);
    const [needsRecalibration, setNeedsRecalibration] = useState<boolean>(false);
    const [errorMsg,           setErrorMsg]           = useState<string>("");
    const [initStatus,         setInitStatus]         = useState<string>("");

    const videoRef          = useRef<HTMLVideoElement>(null);
    const canvasRef         = useRef<HTMLCanvasElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const faceMeshRef       = useRef<any>(null);
    const faceMeshReadyRef  = useRef<boolean>(false);   // true once FaceMesh warmed up
    const measurementsRef   = useRef<PointMeasurement[]>([]);
    const currentSamplesRef = useRef<IrisSample[]>([]);
    const captureActiveRef  = useRef<boolean>(false);
    const captureTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Step 1: fetch calibration session ─────────────────────────────────────
    useEffect(() => {
        const raw = sessionStorage.getItem("neurosync_session");
        const interviewSessionId: string | null = raw
            ? (JSON.parse(raw) as { session_id: string }).session_id
            : null;
        if (interviewSessionId) setSessionId(interviewSessionId);

        fetch(`${API_BASE}/calibration/start`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(interviewSessionId ? { session_id: interviewSessionId } : {}),
        })
            .then(r => r.json())
            .then(data => {
                if (!interviewSessionId) setSessionId(data.session_id);
                setCalibPoints(
                    (data.calibration_points as [number, number][]).map(([x, y]) => ({ x, y }))
                );
                setPhase("camera_request");
            })
            .catch(() => setErrorMsg("Failed to connect to the API. Is the backend running?"));
    }, []);

    // ── FaceMesh init — called by Script onLoad (runs as soon as JS downloads) ─
    // We init immediately and send a dummy frame to warm up WASM so by the
    // time the user clicks "Enable Camera" it's already hot.
    const initFaceMeshEarly = useCallback(() => {
        if (!window.FaceMesh || faceMeshReadyRef.current) return;

        const fm = new window.FaceMesh({
            locateFile: (file: string) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
        });
        fm.setOptions({
            maxNumFaces:            1,
            refineLandmarks:        true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence:  0.5,
        });
        fm.onResults(() => {});
        faceMeshRef.current = fm;

        // Send a tiny blank canvas frame to trigger WASM compilation now
        const warmCanvas = document.createElement("canvas");
        warmCanvas.width  = 64;
        warmCanvas.height = 64;
        fm.send({ image: warmCanvas }).then(() => {
            faceMeshReadyRef.current = true;
        }).catch(() => {
            // WASM warmup failed silently — first real frame will trigger it
            faceMeshReadyRef.current = true;
        });
    }, []);

    // ── Step 2: user clicks Enable Camera — start camera + facemesh in parallel ─
    const startCamera = useCallback(async () => {
        setPhase("starting");
        setInitStatus("Starting camera…");

        try {
            // Camera request + FaceMesh warm-up run simultaneously
            const [stream] = await Promise.all([
                navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" },
                }),
                // If FaceMesh not yet ready, give it up to 4 s
                new Promise<void>(resolve => {
                    if (faceMeshReadyRef.current) { resolve(); return; }
                    setInitStatus("Loading face tracking AI…");
                    const check = setInterval(() => {
                        if (faceMeshReadyRef.current) { clearInterval(check); resolve(); }
                    }, 100);
                    setTimeout(() => { clearInterval(check); faceMeshReadyRef.current = true; resolve(); }, 4000);
                }),
            ]);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setPhase("calibrating");
        } catch {
            setErrorMsg("Camera access denied. Please allow camera access and reload.");
        }
    }, []);

    // ── Step 3: capture frames for each dot ───────────────────────────────────
    const captureFrame = useCallback(async (): Promise<IrisSample | null> => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !faceMeshRef.current) return null;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return new Promise<IrisSample | null>(resolve => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (faceMeshRef.current as any).onResults((results: any) => {
                if (
                    results.multiFaceLandmarks?.[0]?.length > 473
                ) {
                    const lm    = results.multiFaceLandmarks[0];
                    const left  = lm[468];
                    const right = lm[473];
                    resolve({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });
                } else {
                    resolve({ x: 0.5, y: 0.5 });
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (faceMeshRef.current as any).send({ image: canvas });
        });
    }, []);

    const startCapturing = useCallback((pointIdx: number) => {
        if (captureActiveRef.current) return;
        captureActiveRef.current  = true;
        currentSamplesRef.current = [];
        setCapturedCount(0);

        captureTimerRef.current = setInterval(async () => {
            if (currentSamplesRef.current.length >= FRAMES_PER_POINT) {
                clearInterval(captureTimerRef.current!);
                captureActiveRef.current = false;

                const point = calibPoints[pointIdx];
                measurementsRef.current.push({
                    screen_x:     point.x,
                    screen_y:     point.y,
                    iris_samples: [...currentSamplesRef.current],
                });

                const next = pointIdx + 1;
                if (next >= calibPoints.length) setPhase("submitting");
                else setCurrentPointIdx(next);
                return;
            }
            const sample = await captureFrame();
            if (sample) {
                currentSamplesRef.current.push(sample);
                setCapturedCount(currentSamplesRef.current.length);
            }
        }, CAPTURE_INTERVAL);
    }, [calibPoints, captureFrame]);

    useEffect(() => {
        if (phase !== "calibrating" || calibPoints.length === 0) return;
        const t = setTimeout(() => startCapturing(currentPointIdx), 600);
        return () => clearTimeout(t);
    }, [phase, currentPointIdx, calibPoints, startCapturing]);

    // ── Step 4: submit ────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "submitting") return;
        fetch(`${API_BASE}/calibration/submit`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ session_id: sessionId, measurements: measurementsRef.current }),
        })
            .then(r => r.json())
            .then(data => {
                setQualityScore(data.calibration_quality_score);
                setNeedsRecalibration(data.needs_recalibration);
                setPhase("result");
            })
            .catch(() => setErrorMsg("Submission failed. Please try again."));
    }, [phase, sessionId]);

    const retryCalibration = useCallback(() => {
        measurementsRef.current   = [];
        currentSamplesRef.current = [];
        captureActiveRef.current  = false;
        if (captureTimerRef.current) clearInterval(captureTimerRef.current);
        setCurrentPointIdx(0);
        setCapturedCount(0);
        setPhase("calibrating");
    }, []);

    useEffect(() => {
        return () => {
            if (captureTimerRef.current) clearInterval(captureTimerRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const dotStyle = (pt: CalibrationPoint) => ({
        left: `${pt.x * 90 + 5}%`,
        top:  `${pt.y * 90 + 5}%`,
    });

    const currentPoint = calibPoints[currentPointIdx];
    const progress     = calibPoints.length > 0 ? (currentPointIdx / calibPoints.length) * 100 : 0;

    return (
        <>
            {/* Script loads immediately — initFaceMeshEarly fires as soon as JS downloads */}
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js"
                strategy="afterInteractive"
                onLoad={initFaceMeshEarly}
            />

            <video  ref={videoRef}  className="hidden" width={640} height={480} muted playsInline />
            <canvas ref={canvasRef} className="hidden" width={640} height={480} />

            <div className="fixed inset-0 bg-[#0A0C12] flex flex-col items-center justify-center font-body text-white select-none overflow-hidden">
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-indigo-950/30 blur-[180px] rounded-full" />
                    <div className="absolute bottom-1/4 right-1/4 w-1/3 h-1/3 bg-violet-950/20 blur-[150px] rounded-full" />
                </div>

                <AnimatePresence mode="wait">

                    {errorMsg && (
                        <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="z-50 max-w-md text-center px-10 py-12 bg-slate-900/80 border border-red-500/30 rounded-[2rem] backdrop-blur-xl">
                            <AlertTriangle className="mx-auto mb-6 text-red-400" size={48} strokeWidth={1.5} />
                            <p className="text-slate-300 text-lg leading-relaxed">{errorMsg}</p>
                        </motion.div>
                    )}

                    {!errorMsg && phase === "loading" && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="w-16 h-16 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin mx-auto mb-6" />
                            <p className="text-slate-400 font-ui text-sm uppercase tracking-widest">Initialising session…</p>
                        </motion.div>
                    )}

                    {!errorMsg && phase === "camera_request" && (
                        <motion.div key="camera" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="z-10 flex flex-col items-center text-center max-w-lg px-8">
                            <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-8">
                                <Camera size={40} className="text-indigo-400" strokeWidth={1.5} />
                            </div>
                            <h2 className="font-heading text-4xl font-black italic tracking-tighter mb-4">Eye Calibration</h2>
                            <p className="text-slate-400 text-lg leading-relaxed mb-10">
                                Follow a glowing dot through{" "}
                                <span className="text-white font-semibold">{calibPoints.length} positions</span> to personalise gaze tracking.
                                Takes about 30 seconds.
                            </p>
                            <button onClick={startCamera}
                                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-heading font-black text-sm uppercase tracking-[0.15em] px-10 py-5 rounded-2xl flex items-center gap-3 transition-all shadow-violet">
                                <Eye size={20} />
                                Enable Camera &amp; Begin
                            </button>
                        </motion.div>
                    )}

                    {/* Brief parallel-init screen — usually <1s */}
                    {!errorMsg && phase === "starting" && (
                        <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6">
                            <div className="w-20 h-20 mx-auto relative">
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                                <div className="absolute inset-3 rounded-full border-2 border-violet-500/20 border-b-violet-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
                            </div>
                            <div>
                                <p className="text-white font-heading font-bold text-xl mb-1">{initStatus}</p>
                                <p className="text-slate-500 font-ui text-xs uppercase tracking-widest">Preparing AI model in parallel…</p>
                            </div>
                        </motion.div>
                    )}

                    {!errorMsg && phase === "calibrating" && currentPoint && (
                        <motion.div key="calibrating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0">
                            <div className="absolute top-6 left-8 right-8 z-20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-ui text-[11px] text-slate-500 uppercase tracking-widest">
                                        Point {currentPointIdx + 1} / {calibPoints.length}
                                    </span>
                                    <span className="font-ui text-[11px] text-slate-500 uppercase tracking-widest">
                                        {capturedCount}/{FRAMES_PER_POINT} frames
                                    </span>
                                </div>
                                <div className="h-[2px] bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-indigo-500 rounded-full"
                                        animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                                </div>
                            </div>

                            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                                <div className="bg-slate-900/70 border border-white/5 backdrop-blur-xl px-8 py-4 rounded-2xl">
                                    <p className="text-slate-300 font-ui text-sm uppercase tracking-widest">Look at the dot and hold still</p>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div key={currentPointIdx} style={dotStyle(currentPoint)}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                    <motion.div className="absolute inset-0 rounded-full bg-indigo-400/20"
                                        animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        style={{ width: 32, height: 32, margin: -8 }} />
                                    <div className="w-4 h-4 rounded-full bg-indigo-400 shadow-[0_0_20px_6px_rgba(129,140,248,0.7)]" />
                                    <svg className="absolute -inset-4 -rotate-90" width={40} height={40} style={{ top: -12, left: -12 }}>
                                        <circle cx={20} cy={20} r={16} fill="none" stroke="#312e81" strokeWidth={2} />
                                        <motion.circle cx={20} cy={20} r={16} fill="none" stroke="#818cf8" strokeWidth={2}
                                            strokeDasharray={`${2 * Math.PI * 16}`}
                                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - capturedCount / FRAMES_PER_POINT)}`}
                                            strokeLinecap="round" className="transition-all duration-100" />
                                    </svg>
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {!errorMsg && phase === "submitting" && (
                        <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="w-16 h-16 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin mx-auto mb-6" />
                            <p className="text-slate-400 font-ui text-sm uppercase tracking-widest">Computing calibration…</p>
                        </motion.div>
                    )}

                    {!errorMsg && phase === "result" && (
                        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="z-10 flex flex-col items-center text-center max-w-md px-8">
                            {needsRecalibration ? (
                                <>
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8">
                                        <AlertTriangle size={36} className="text-amber-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="font-heading text-4xl font-black italic tracking-tighter mb-3">Calibration Low</h2>
                                    <p className="text-slate-400 text-base leading-relaxed mb-2">
                                        Quality score:{" "}
                                        <span className="text-amber-400 font-semibold">{(qualityScore * 100).toFixed(0)}%</span>
                                        {" "}(minimum 60% required)
                                    </p>
                                    <p className="text-slate-500 text-sm mb-10">
                                        Ensure your face is well-lit, centred, and look directly at each dot.
                                    </p>
                                    <button onClick={retryCalibration}
                                        className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-heading font-black text-sm uppercase tracking-[0.15em] px-10 py-5 rounded-2xl flex items-center gap-3 transition-all">
                                        <RefreshCw size={18} /> Recalibrate
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8">
                                        <CheckCircle size={36} className="text-emerald-400" strokeWidth={1.5} />
                                    </div>
                                    <h2 className="font-heading text-4xl font-black italic tracking-tighter mb-3">Calibration Complete</h2>
                                    <p className="text-slate-400 text-base leading-relaxed mb-2">
                                        Quality score:{" "}
                                        <span className="text-emerald-400 font-semibold">{(qualityScore * 100).toFixed(0)}%</span>
                                    </p>
                                    <p className="text-slate-500 text-sm mb-10">
                                        Gaze tracking is personalised to your session. You may now begin the interview.
                                    </p>
                                    <button onClick={() => router.push("/portal/interview")}
                                        className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-heading font-black text-sm uppercase tracking-[0.15em] px-10 py-5 rounded-2xl flex items-center gap-3 transition-all shadow-violet">
                                        Begin Interview <ArrowRight size={20} />
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
