"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, Wifi, WifiOff, ChevronRight, Mic, BrainCircuit, AlertTriangle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HEARTBEAT_INTERVAL_MS  = 30_000;
const GAZE_SAMPLE_INTERVAL_MS = 150;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question { id: string; stage: string; question: string; ideal_answer: string; time_window_seconds: number }
interface GazeSample { x: number; y: number }

declare global { interface Window { FaceMesh: unknown } }

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
    return (
        <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-warning/90 text-white px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-warning/30">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <span className="font-ui text-sm font-bold">{msg}</span>
        </motion.div>
    );
}

export default function InterviewPage() {
    const router   = useRouter();
    const [questions, setQuestions]             = useState<Question[]>([]);
    const [sessionId, setSessionId]             = useState("");
    const [currentQ, setCurrentQ]               = useState(0);
    const [timeLeft, setTimeLeft]               = useState(120);
    const [isInterstitial, setIsInterstitial]   = useState(false);
    const [interstitialCount, setInterstitialCount] = useState(5);
    const [showWarning, setShowWarning]         = useState(false);
    const [warningCount, setWarningCount]       = useState(0);
    const [waveHeights, setWaveHeights]         = useState<number[]>(Array(80).fill(4));
    const [submitting, setSubmitting]           = useState(false);
    const [toast, setToast]                     = useState<string | null>(null);
    const [isConnected, setIsConnected]         = useState(true);

    // Recording refs
    const audioRecorderRef  = useRef<MediaRecorder | null>(null);
    const videoRecorderRef  = useRef<MediaRecorder | null>(null);
    const audioChunksRef    = useRef<Blob[]>([]);
    const videoChunksRef    = useRef<Blob[]>([]);
    const streamRef         = useRef<MediaStream | null>(null);
    const analyserRef       = useRef<AnalyserNode | null>(null);
    const waveFrameRef      = useRef<number>(0);

    // Gaze tracking
    const gazeVideoRef      = useRef<HTMLVideoElement>(null);
    const gazeCanvasRef     = useRef<HTMLCanvasElement>(null);
    const faceMeshRef       = useRef<unknown>(null);
    const gazeSamplesRef    = useRef<GazeSample[]>([]);
    const gazeTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

    // Heartbeat
    const heartbeatRef      = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Load session from storage ──────────────────────────────────────────────
    useEffect(() => {
        const raw = sessionStorage.getItem("neurosync_session");
        if (!raw) { router.replace("/portal/login"); return; }
        const sess = JSON.parse(raw);
        setSessionId(sess.session_id);
        setQuestions(sess.questions ?? []);
        if (sess.questions?.[0]) setTimeLeft(sess.questions[0].time_window_seconds ?? 120);
    }, [router]);

    // ── Start AV recording ─────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            streamRef.current = stream;

            // Waveform via Web Audio API
            const ctx     = new AudioContext();
            const src     = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyserRef.current = analyser;

            const drawWave = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const heights = Array.from({ length: 80 }, (_, i) => {
                    const idx = Math.floor(i * data.length / 80);
                    return Math.max(4, (data[idx] / 255) * 56 + 4);
                });
                setWaveHeights(heights);
                waveFrameRef.current = requestAnimationFrame(drawWave);
            };
            drawWave();

            // Audio recorder (WebM/Opus)
            const audioStream = new MediaStream(stream.getAudioTracks());
            audioChunksRef.current = [];
            audioRecorderRef.current = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
            audioRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            audioRecorderRef.current.start(250);

            // Video recorder
            videoChunksRef.current = [];
            videoRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
            videoRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
            videoRecorderRef.current.start(250);

            console.log("[NeuroSync][Recording] started");
        } catch (err) {
            console.error("[NeuroSync][Recording] failed:", err);
            showToast("Camera/microphone access required for the interview.");
        }
    }, []);

    // ── Stop recording + collect blobs ─────────────────────────────────────────
    const stopRecording = useCallback((): Promise<{ audio: Blob; video: Blob }> =>
        new Promise(resolve => {
            cancelAnimationFrame(waveFrameRef.current);
            setWaveHeights(Array(80).fill(4));

            let audioDone = false, videoDone = false;
            let audioBlob: Blob, videoBlob: Blob;

            const checkDone = () => {
                if (audioDone && videoDone) resolve({ audio: audioBlob, video: videoBlob });
            };

            if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
                audioRecorderRef.current.onstop = () => {
                    audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                    audioDone = true;
                    checkDone();
                };
                audioRecorderRef.current.stop();
            } else { audioDone = true; audioBlob = new Blob(); checkDone(); }

            if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
                videoRecorderRef.current.onstop = () => {
                    videoBlob = new Blob(videoChunksRef.current, { type: "video/webm" });
                    videoDone = true;
                    checkDone();
                };
                videoRecorderRef.current.stop();
            } else { videoDone = true; videoBlob = new Blob(); checkDone(); }
        }), []);

    // ── FaceMesh gaze tracking ─────────────────────────────────────────────────
    const initGazeTracking = useCallback(async () => {
        if (!window.FaceMesh) return;
        try {
            const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ video: true });
            if (gazeVideoRef.current) {
                gazeVideoRef.current.srcObject = stream;
                await gazeVideoRef.current.play();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fm = new (window.FaceMesh as any)({
                locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`,
            });
            fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            faceMeshRef.current = fm;

            gazeTimerRef.current = setInterval(async () => {
                if (!gazeVideoRef.current || !gazeCanvasRef.current) return;
                const ctx = gazeCanvasRef.current.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(gazeVideoRef.current, 0, 0, 640, 480);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (faceMeshRef.current as any).onResults((res: any) => {
                    const lms = res?.multiFaceLandmarks?.[0];
                    if (lms && lms.length > 473) {
                        const l = lms[468], r = lms[473];
                        gazeSamplesRef.current.push({ x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 });
                    }
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (faceMeshRef.current as any).send({ image: gazeCanvasRef.current });
            }, GAZE_SAMPLE_INTERVAL_MS);
        } catch (e) {
            console.warn("[NeuroSync][Gaze] could not initialise:", e);
        }
    }, []);

    // ── Heartbeat ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!sessionId) return;
        heartbeatRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API}/session/${sessionId}/health`);
                const data = await res.json();
                setIsConnected(data.status === "healthy");
            } catch {
                setIsConnected(false);
            }
        }, HEARTBEAT_INTERVAL_MS);
        return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
    }, [sessionId]);

    // ── Timer ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isInterstitial || showWarning || submitting || !sessionId) return;
        if (timeLeft <= 0) { handleNext(); return; }
        const t = setInterval(() => setTimeLeft(v => v - 1), 1000);
        return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, isInterstitial, showWarning, submitting, sessionId]);

    // ── Interstitial countdown ─────────────────────────────────────────────────
    useEffect(() => {
        if (!isInterstitial) return;
        if (interstitialCount <= 0) {
            setIsInterstitial(false); setInterstitialCount(5); return;
        }
        const t = setInterval(() => setInterstitialCount(v => v - 1), 1000);
        return () => clearInterval(t);
    }, [isInterstitial, interstitialCount]);

    // ── Start recording on mount ───────────────────────────────────────────────
    useEffect(() => {
        if (!sessionId || questions.length === 0) return;
        startRecording();
    }, [sessionId, questions, startRecording]);

    // ── Submit current answer ──────────────────────────────────────────────────
    const handleNext = useCallback(async () => {
        if (submitting) return;
        setSubmitting(true);

        try {
            const q = questions[currentQ];
            const { audio, video } = await stopRecording();
            const gazeCopy = [...gazeSamplesRef.current];
            gazeSamplesRef.current = [];

            const audioFd = new FormData();
            audioFd.append("session_id", sessionId);
            audioFd.append("question_id", q.id);
            audioFd.append("question_text", q.question);
            audioFd.append("ideal_answer", q.ideal_answer ?? "");
            audioFd.append("question_stage", q.stage ?? "intro");
            if (audio.size > 0) audioFd.append("audio_file", audio, `${q.id}_audio.webm`);
            if (video.size > 0) audioFd.append("video_file", video, `${q.id}_video.webm`);

            const videoFd = new FormData();
            videoFd.append("session_id", sessionId);
            videoFd.append("question_id", q.id);
            videoFd.append("gaze_samples", JSON.stringify(gazeCopy));
            if (video.size > 0) videoFd.append("video_file", video, `${q.id}_video.webm`);

            // Fire both simultaneously
            await Promise.allSettled([
                fetch(`${API}/session/${sessionId}/save-response`, { method: "POST", body: audioFd }),
                fetch(`${API}/video/analyze-chunk`, { method: "POST", body: videoFd }),
            ]);

            console.log(`[NeuroSync][Interview] Q${currentQ + 1} submitted`);

            const isLast = currentQ >= questions.length - 1;
            if (isLast) {
                router.push("/portal/thank-you");
                return;
            }

            // Advance to next question
            const nextQ = currentQ + 1;
            setCurrentQ(nextQ);
            setTimeLeft(questions[nextQ]?.time_window_seconds ?? 120);
            setIsInterstitial(true);
            setInterstitialCount(5);
            await startRecording();
        } catch (err) {
            console.error("[NeuroSync][Interview] submit error:", err);
            showToast("Failed to submit answer — interview will continue.");
        } finally {
            setSubmitting(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQ, questions, sessionId, submitting, stopRecording, startRecording, router]);

    // ── Fullscreen enforcement ─────────────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) {
                setWarningCount(v => v + 1);
                setShowWarning(true);
            } else setShowWarning(false);
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const attemptFullscreen = () => {
        if (warningCount >= 2) { router.push("/portal/terminated"); return; }
        document.documentElement.requestFullscreen().catch(() => {});
    };

    // ── Cleanup ────────────────────────────────────────────────────────────────
    useEffect(() => () => {
        cancelAnimationFrame(waveFrameRef.current);
        if (gazeTimerRef.current)   clearInterval(gazeTimerRef.current);
        if (heartbeatRef.current)   clearInterval(heartbeatRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

    const getTimerColor = () => {
        if (timeLeft <= 10) return "text-danger drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]";
        if (timeLeft <= 30) return "text-warning drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]";
        return "text-primary";
    };

    const totalQuestions = questions.length || 18;
    const currentQuestion = questions[currentQ];

    return (
        <>
            {/* MediaPipe FaceMesh CDN */}
            <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js"
                strategy="afterInteractive" onLoad={initGazeTracking} />

            {/* Hidden gaze capture elements */}
            <video ref={gazeVideoRef} className="hidden" width={640} height={480} muted playsInline />
            <canvas ref={gazeCanvasRef} className="hidden" width={640} height={480} />

            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative select-none overflow-hidden font-body text-white">
                <div className="absolute inset-0 bg-[#0F1117] overflow-hidden pointer-events-none">
                    <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-indigo-950/20 blur-[150px] rounded-full" />
                    <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-slate-900/10 blur-[130px] rounded-full" />
                </div>

                {/* Toast */}
                <AnimatePresence>{toast && <Toast msg={toast} />}</AnimatePresence>

                {/* Reconnecting banner */}
                <AnimatePresence>
                    {!isConnected && (
                        <motion.div initial={{ y: -40 }} animate={{ y: 0 }} exit={{ y: -40 }}
                            className="fixed top-0 inset-x-0 z-50 bg-warning/90 text-white text-center py-3 font-ui text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <WifiOff size={16} /> Reconnecting to server…
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {!isInterstitial && !showWarning && currentQuestion && (
                        <motion.div key="interview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="w-full max-w-5xl h-full flex flex-col items-center relative z-10">
                            {/* Top Bar */}
                            <div className="w-full flex items-center justify-between mb-24 px-10 py-6 border border-white/5 bg-slate-900/50 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl">
                                <div className="flex items-center gap-6">
                                    <span className="font-ui text-xs font-black text-slate-500 uppercase tracking-[0.3em]">
                                        {currentQuestion.stage?.toUpperCase() ?? "MODULE"}
                                    </span>
                                    <div className="h-6 w-px bg-white/10" />
                                    <span className="font-heading text-2xl font-bold italic tracking-tight uppercase">
                                        Q{currentQ + 1} <span className="text-slate-500 font-black tracking-widest text-sm opacity-60">OF {totalQuestions}</span>
                                    </span>
                                </div>

                                {/* Circular timer */}
                                <div className="relative group">
                                    <svg className="w-24 h-24 -rotate-90">
                                        <circle cx="48" cy="48" r="40" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                                        <motion.circle cx="48" cy="48" r="40" fill="transparent"
                                            stroke={timeLeft <= 10 ? "#EF4444" : timeLeft <= 30 ? "#F59E0B" : "#6C63FF"}
                                            strokeWidth="4" strokeDasharray="251"
                                            strokeDashoffset={251 * (1 - timeLeft / (currentQuestion.time_window_seconds ?? 120))}
                                            strokeLinecap="round" className="transition-all duration-1000" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`font-heading text-2xl font-black italic tracking-tighter ${getTimerColor()}`}>{timeLeft}s</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-success animate-pulse" : "bg-danger"}`} />
                                        {isConnected ? <Wifi size={16} className="text-slate-500" /> : <WifiOff size={16} className="text-danger" />}
                                    </div>
                                    <div className="h-6 w-px bg-white/10" />
                                    <span className="font-ui text-[10px] text-slate-500 font-bold uppercase tracking-widest italic opacity-60">NEUROSYNC V3.0</span>
                                </div>
                            </div>

                            {/* Question */}
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.8 }}
                                className="w-full max-w-4xl text-center mb-32">
                                <div className="bg-primary/5 p-4 rounded-2xl mb-12 border border-primary/20 backdrop-blur-md inline-flex items-center gap-4 text-primary">
                                    <BrainCircuit size={24} className="animate-pulse" />
                                    <span className="font-ui text-xs font-black uppercase tracking-[0.3em] italic">Precision Assessment Engine</span>
                                </div>
                                <h2 className="font-heading text-5xl font-black italic leading-[1.3] tracking-tighter shadow-sm mb-12">
                                    {currentQuestion.question}
                                </h2>
                                <div className="flex justify-center gap-1">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                            </motion.div>

                            {/* Bottom bar */}
                            <div className="fixed bottom-12 w-full max-w-5xl flex flex-col items-center gap-10">
                                {/* Waveform */}
                                <div className="flex items-center gap-0.5 h-16 w-full px-20">
                                    {waveHeights.map((h, i) => (
                                        <div key={i} className="flex-1 bg-white/60 rounded-full transition-all duration-75"
                                            style={{ height: `${h}px` }} />
                                    ))}
                                </div>

                                <div className="flex items-center gap-10">
                                    <div className="flex items-center gap-4 bg-slate-900/80 border border-white/5 px-8 py-4 rounded-3xl backdrop-blur-2xl shadow-violet">
                                        <div className="w-3 h-3 bg-danger rounded-full animate-pulse" />
                                        <span className="font-ui text-sm font-black text-white/80 uppercase tracking-widest italic opacity-80">
                                            {submitting ? "Submitting…" : "Recording Response…"}
                                        </span>
                                    </div>
                                    <button onClick={handleNext} disabled={submitting}
                                        className="group bg-white text-black font-heading font-black text-sm uppercase tracking-[0.2em] px-10 py-5 rounded-3xl flex items-center gap-3 transition-all hover:bg-white/90 active:scale-95 shadow-2xl disabled:opacity-50">
                                        {currentQ >= totalQuestions - 1 ? "Finish Interview" : "Next Question"}
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {isInterstitial && (
                        <motion.div key="interstitial" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl text-center px-10">
                            <div className="relative mb-12">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
                                <ShieldAlert className="w-32 h-32 text-primary relative z-10" strokeWidth={1} />
                            </div>
                            <h3 className="font-heading text-5xl font-black mb-6 tracking-tighter">Answer Saved Successfully</h3>
                            <p className="font-body text-slate-400 text-2xl italic mb-16 max-w-2xl opacity-80 leading-relaxed">
                                Prepare for the next module.<br />Assessment recalibrating in…
                            </p>
                            <div className="relative">
                                <span className="font-heading text-[12rem] font-black italic tracking-tighter leading-none opacity-20 select-none">0{interstitialCount}</span>
                                <motion.div key={interstitialCount} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    className="absolute inset-0 flex items-center justify-center font-heading text-[8rem] font-black italic tracking-tighter leading-none text-primary">
                                    {interstitialCount}
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                    {showWarning && (
                        <motion.div key="warning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="fixed inset-0 z-[100] bg-danger/20 backdrop-blur-3xl flex items-center justify-center p-10">
                            <div className="max-w-xl w-full bg-slate-950 border-2 border-danger/50 rounded-[3rem] p-16 shadow-[0_0_100px_rgba(239,68,68,0.3)] text-center relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
                                    <AlertTriangle size={300} className="text-danger" />
                                </div>
                                <div className="w-24 h-24 bg-danger/20 text-danger rounded-[2rem] flex items-center justify-center mx-auto mb-10">
                                    <ShieldAlert size={48} />
                                </div>
                                <h3 className="font-heading text-4xl font-bold mb-6 tracking-tight text-white uppercase italic">Security Violation</h3>
                                <p className="font-body text-slate-300 text-lg mb-12 font-black leading-relaxed italic opacity-80">
                                    {warningCount === 1
                                        ? "Full-screen mode was exited. This is your final warning. Termination will occur on the next violation."
                                        : "Multiple violations detected. Interview session has been locked for review."
                                    }
                                </p>
                                <button onClick={attemptFullscreen}
                                    className="w-full bg-danger text-white font-heading font-black py-6 rounded-2xl flex items-center justify-center gap-4 transition-all hover:bg-danger/90 active:scale-95 shadow-2xl">
                                    <RotateCcw size={24} /> Restore Full-Screen Session
                                </button>
                                <p className="mt-8 font-ui text-[10px] text-slate-600 uppercase tracking-widest font-black">
                                    Violation ID: SEC-SYS-{Math.floor(1000 + Math.random() * 9000)}-{warningCount}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
