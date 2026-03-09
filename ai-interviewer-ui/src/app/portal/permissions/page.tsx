"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    Mic,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    Volume2,
    Scan,
    AlertTriangle,
    ArrowRight,
    Maximize
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PermissionGate() {
    const [cameraOk, setCameraOk] = useState(false);
    const [micOk, setMicOk] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const router = useRouter();
    const visualizerRef = useRef<HTMLDivElement>(null);

    // Simulate permission granting
    useEffect(() => {
        const timer1 = setTimeout(() => setCameraOk(true), 1500);
        const timer2 = setTimeout(() => setMicOk(true), 2500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    useEffect(() => {
        if (cameraOk && micOk) setIsReady(true);
    }, [cameraOk, micOk]);

    const handleStart = () => {
        // In a real app, we would request Fullscreen here
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {
                console.error("Error attempting to enable full-screen mode:", e);
            });
        }
        router.push("/portal/interview");
    };

    return (
        <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 space-y-12 overflow-hidden relative">
            {/* Background Calmness */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-violet-600/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[30%] right-[30%] w-[30%] h-[30%] bg-emerald-500/5 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl relative z-10"
            >
                <div className="text-center mb-16">
                    <h1 className="font-heading text-6xl font-black mb-4 tracking-tighter">Secure Initialization</h1>
                    <p className="font-body text-slate-500 text-xl italic font-medium">Verify your environment and grant necessary permissions to proceed.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {/* Camera Permission */}
                    <div className={`p-10 rounded-[2.5rem] border border-white/5 bg-slate-900 shadow-2xl transition-all ${cameraOk ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-900 border-white/5"}`}>
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-3xl ${cameraOk ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                                <Camera size={32} strokeWidth={1.5} />
                            </div>
                            {cameraOk ? (
                                <CheckCircle2 size={32} className="text-emerald-400 animate-in zoom-in duration-500" />
                            ) : (
                                <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin" />
                            )}
                        </div>
                        <h3 className="font-heading text-2xl font-bold mb-2">Camera Assessment</h3>
                        <p className="font-body text-slate-500 text-sm italic leading-relaxed">
                            Access is required to monitor facial micro-expressions and gaze distribution throughout the session.
                        </p>
                    </div>

                    {/* Microhpone Permission */}
                    <div className={`p-10 rounded-[2.5rem] border border-white/5 bg-slate-900 shadow-2xl transition-all ${micOk ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-900 border-white/5"}`}>
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-3xl ${micOk ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                                <Mic size={32} strokeWidth={1.5} />
                            </div>
                            {micOk ? (
                                <CheckCircle2 size={32} className="text-emerald-400 animate-in zoom-in duration-500" />
                            ) : (
                                <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin" />
                            )}
                        </div>
                        <h3 className="font-heading text-2xl font-bold mb-2">Voice Calibration</h3>
                        <p className="font-body text-slate-500 text-sm italic leading-relaxed mb-6">
                            Analyzing vocal tonality and polarity stability in real-time. Speak briefly to test sensitivity.
                        </p>

                        {/* Audio Waveform Visualizer */}
                        <div className="h-12 flex items-center gap-1">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        height: micOk ? [8, Math.random() * 40 + 8, 8] : 8,
                                        opacity: micOk ? [0.2, 0.8, 0.2] : 0.2
                                    }}
                                    transition={{
                                        duration: Math.random() * 0.5 + 0.3,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="w-[2px] bg-emerald-400 rounded-full"
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Fullscreen Warning Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5 }}
                    className="bg-danger/10 border border-danger/30 rounded-[2rem] p-8 flex flex-col md:flex-row gap-6 items-center shadow-2xl mb-12 relative group overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <ShieldAlert size={120} className="text-danger" />
                    </div>
                    <div className="w-16 h-16 bg-danger/20 text-danger rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h4 className="font-heading text-xl font-bold text-white mb-2 uppercase tracking-wide">Fullscreen Protocol Enforced</h4>
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
                                : "bg-slate-900 text-slate-600 border border-white/5 opacity-50 cursor-not-allowed"
                            }`}
                    >
                        {isReady && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />}
                        <span className="relative z-10 flex items-center gap-4">
                            I'm Ready — Begin Interview
                            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                        </span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
