"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    Mic,
    CheckCircle2,
    ShieldAlert,
    AlertTriangle,
    ArrowRight,
    XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type PermState = "idle" | "granted" | "denied";

export default function PermissionGate() {
    const [cameraState, setCameraState] = useState<PermState>("idle");
    const [micState,    setMicState]    = useState<PermState>("idle");
    const [errorMsg,    setErrorMsg]    = useState<string>("");
    const router = useRouter();

    // Request real camera + mic permissions on mount
    useEffect(() => {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setCameraState("granted");
                setMicState("granted");
                // Stop the test stream immediately — interview page will open its own
                stream.getTracks().forEach(t => t.stop());
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
                    setCameraState("denied");
                    setMicState("denied");
                    setErrorMsg("Camera and microphone access were denied. Please allow access in your browser settings and reload.");
                } else {
                    setCameraState("denied");
                    setMicState("denied");
                    setErrorMsg(`Device error: ${msg}`);
                }
            }
        })();
    }, []);

    const isReady = cameraState === "granted" && micState === "granted";

    const handleStart = () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {
                console.error("Fullscreen error:", e);
            });
        }
        router.push("/portal/calibration");
    };

    const StateIcon = ({ state }: { state: PermState }) => {
        if (state === "granted") return <CheckCircle2 size={32} className="text-emerald-400" />;
        if (state === "denied")  return <XCircle      size={32} className="text-danger" />;
        return <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />;
    };

    return (
        <div className="min-h-screen bg-[#f5f1eb] flex flex-col items-center justify-center p-6 space-y-12 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-primary/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[30%] right-[30%] w-[30%] h-[30%] bg-emerald-200/20 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl relative z-10"
            >
                <div className="text-center mb-16">
                    <h1 className="font-heading text-6xl font-black mb-4 tracking-tighter">Secure Initialization</h1>
                    <p className="font-body text-foreground/50 text-xl italic font-medium">
                        Verify your environment and grant necessary permissions to proceed.
                    </p>
                </div>

                <AnimatePresence>
                    {errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 bg-danger/10 border border-danger/30 text-danger px-6 py-4 rounded-2xl mb-8"
                        >
                            <AlertTriangle size={20} className="flex-shrink-0" />
                            <p className="font-ui text-sm font-bold">{errorMsg}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {/* Camera */}
                    <div className={`p-10 rounded-[2.5rem] border shadow-2xl transition-all ${
                        cameraState === "granted" ? "bg-emerald-500/5 border-emerald-500/20"
                        : cameraState === "denied" ? "bg-danger/5 border-danger/20"
                        : "bg-white border-border shadow-sm"
                    }`}>
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-3xl ${
                                cameraState === "granted" ? "bg-emerald-500/20 text-emerald-400"
                                : cameraState === "denied" ? "bg-danger/20 text-danger"
                                : "bg-gray-100 text-foreground/40"
                            }`}>
                                <Camera size={32} strokeWidth={1.5} />
                            </div>
                            <StateIcon state={cameraState} />
                        </div>
                        <h3 className="font-heading text-2xl font-bold mb-2">Camera Assessment</h3>
                        <p className="font-body text-foreground/50 text-sm italic leading-relaxed">
                            Access is required to monitor facial micro-expressions and gaze distribution throughout the session.
                        </p>
                    </div>

                    {/* Microphone */}
                    <div className={`p-10 rounded-[2.5rem] border shadow-2xl transition-all ${
                        micState === "granted" ? "bg-emerald-500/5 border-emerald-500/20"
                        : micState === "denied" ? "bg-danger/5 border-danger/20"
                        : "bg-white border-border shadow-sm"
                    }`}>
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-3xl ${
                                micState === "granted" ? "bg-emerald-500/20 text-emerald-400"
                                : micState === "denied" ? "bg-danger/20 text-danger"
                                : "bg-gray-100 text-foreground/40"
                            }`}>
                                <Mic size={32} strokeWidth={1.5} />
                            </div>
                            <StateIcon state={micState} />
                        </div>
                        <h3 className="font-heading text-2xl font-bold mb-2">Voice Calibration</h3>
                        <p className="font-body text-foreground/50 text-sm italic leading-relaxed">
                            Analyzing vocal tonality and polarity stability in real-time. Speak briefly to test sensitivity.
                        </p>
                    </div>
                </div>

                {/* Fullscreen Warning */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-danger/10 border border-danger/30 rounded-[2rem] p-8 flex flex-col md:flex-row gap-6 items-center shadow-2xl mb-12 relative group overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <ShieldAlert size={120} className="text-danger" />
                    </div>
                    <div className="w-16 h-16 bg-danger/20 text-danger rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h4 className="font-heading text-xl font-bold text-foreground mb-2 uppercase tracking-wide">Fullscreen Protocol Enforced</h4>
                        <p className="font-ui text-xs font-bold text-danger/80 leading-relaxed italic uppercase tracking-[0.1em]">
                            Exiting full-screen during the assessment will trigger a warning. A second attempt will result in immediate termination of the interview session.
                        </p>
                    </div>
                </motion.div>

                <div className="flex justify-center">
                    <button
                        onClick={handleStart}
                        disabled={!isReady}
                        className={`group relative px-12 py-6 rounded-2xl font-heading text-2xl font-black transition-all shadow-2xl flex items-center gap-6 overflow-hidden ${isReady
                            ? "bg-primary text-white scale-100 hover:scale-105 active:scale-[0.98] shadow-violet-active"
                            : "bg-gray-200 text-foreground/30 border border-border opacity-50 cursor-not-allowed"
                        }`}
                    >
                        {isReady && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />}
                        <span className="relative z-10 flex items-center gap-4">
                            I&apos;m Ready — Begin Calibration
                            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                        </span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
