"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    ShieldAlert,
    Wifi,
    ChevronRight,
    Mic,
    BrainCircuit,
    AlertTriangle,
    RotateCcw
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function InterviewPage() {
    const [currentQuestion, setCurrentQuestion] = useState(1);
    const [timeLeft, setTimeLeft] = useState(120); // 120s per question
    const [isInterstitial, setIsInterstitial] = useState(false);
    const [interstitialCount, setInterstitialCount] = useState(5);
    const [showWarning, setShowWarning] = useState(false);
    const [warningCount, setWarningCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const router = useRouter();

    const totalQuestions = 18;

    const questions = [
        "Tell us about a time you had to lead a project under extreme pressure and vague requirements. How did you handle it?",
        "Explain the concept of 'Event Loop' in Node.js to a 5-year old.",
        "How do you prioritize technical debt against product feature delivery in a high-growth environment?",
        "Describe a situation where you had a significant disagreement with a stakeholder. How did you resolve it?",
    ];

    // Fullscreen detection
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                setWarningCount(v => v + 1);
                setShowWarning(true);
            } else {
                setIsFullscreen(true);
                setShowWarning(false);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Timer logic
    useEffect(() => {
        if (isInterstitial || showWarning) return;

        if (timeLeft <= 0) {
            handleNext();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(v => v - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, isInterstitial, showWarning]);

    // Interstitial logic
    useEffect(() => {
        if (!isInterstitial) return;

        if (interstitialCount <= 0) {
            setIsInterstitial(false);
            setInterstitialCount(5);
            setTimeLeft(120);
            return;
        }

        const timer = setInterval(() => {
            setInterstitialCount(v => v - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [isInterstitial, interstitialCount]);

    const handleNext = () => {
        if (currentQuestion >= totalQuestions) {
            router.push("/portal/thank-you");
        } else {
            setIsInterstitial(true);
            setCurrentQuestion(v => v + 1);
        }
    };

    const attemptReenterFullscreen = () => {
        if (warningCount >= 2) {
            router.push("/portal/terminated");
            return;
        }
        document.documentElement.requestFullscreen().catch(() => { });
    };

    const getTimerColor = () => {
        if (timeLeft <= 10) return "text-danger drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]";
        if (timeLeft <= 30) return "text-warning drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]";
        return "text-primary";
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative select-none overflow-hidden font-body text-white">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[#0F1117] overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[10%] w-[30%] h-[30%] bg-indigo-950/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-slate-900/10 blur-[130px] rounded-full" />
            </div>

            <AnimatePresence mode="wait">
                {!isInterstitial && (
                    <motion.div
                        key="interview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full max-w-5xl h-full flex flex-col items-center relative z-10"
                    >
                        {/* Top Bar */}
                        <div className="w-full flex items-center justify-between mb-24 px-10 py-6 border border-white/5 bg-slate-900/50 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl">
                            <div className="flex items-center gap-6">
                                <span className="font-ui text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Module 1/3</span>
                                <div className="h-6 w-px bg-white/10" />
                                <span className="font-heading text-2xl font-bold italic tracking-tight uppercase">Q{currentQuestion} <span className="text-slate-500 font-black tracking-widest text-sm opacity-60">OF {totalQuestions}</span></span>
                            </div>

                            {/* Countdown Circular Timer */}
                            <div className="relative group">
                                <svg className="w-24 h-24 -rotate-90">
                                    <circle cx="48" cy="48" r="40" fill="transparent" stroke="#1E293B" strokeWidth="4" />
                                    <motion.circle
                                        cx="48"
                                        cy="48"
                                        r="40"
                                        fill="transparent"
                                        stroke={timeLeft <= 10 ? "#EF4444" : timeLeft <= 30 ? "#F59E0B" : "#6C63FF"}
                                        strokeWidth="4"
                                        strokeDasharray="251"
                                        strokeDashoffset={251 * (1 - timeLeft / 120)}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`font-heading text-2xl font-black italic tracking-tighter ${getTimerColor()}`}>{timeLeft}s</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                    <Wifi size={16} className="text-slate-500" />
                                </div>
                                <div className="h-6 w-px bg-white/10" />
                                <span className="font-ui text-[10px] text-slate-500 font-bold uppercase tracking-widest italic opacity-60">L-V2.8 CRYPT</span>
                            </div>
                        </div>

                        {/* Question Card */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                            className="w-full max-w-4xl text-center mb-32"
                        >
                            <div className="bg-primary/5 p-4 rounded-2xl mb-12 border border-primary/20 backdrop-blur-md inline-flex items-center gap-4 text-primary">
                                <BrainCircuit size={24} className="animate-pulse" />
                                <span className="font-ui text-xs font-black uppercase tracking-[0.3em] italic">Precision Assessment Engine</span>
                            </div>
                            <h2 className="font-heading text-5xl font-black italic leading-[1.3] tracking-tighter shadow-sm mb-12">
                                {questions[(currentQuestion - 1) % questions.length]}
                            </h2>
                            <div className="flex justify-center gap-1">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                ))}
                            </div>
                        </motion.div>

                        {/* Bottom Bar: Input Visualization */}
                        <div className="fixed bottom-12 w-full max-w-5xl flex flex-col items-center gap-10">
                            {/* Audio Waveform */}
                            <div className="flex items-center gap-2 h-16 w-full px-20">
                                {Array.from({ length: 80 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            height: [8, Math.random() * (i > 30 && i < 50 ? 60 : 20) + 8, 8],
                                            opacity: [0.1, 0.4, 0.1]
                                        }}
                                        transition={{
                                            duration: Math.random() * 0.8 + 0.4,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="flex-1 bg-white rounded-full"
                                    />
                                ))}
                            </div>

                            <div className="flex items-center gap-10">
                                <div className="flex items-center gap-4 bg-slate-900/80 border border-white/5 px-8 py-4 rounded-3xl backdrop-blur-2xl shadow-violet">
                                    <div className="w-3 h-3 bg-danger rounded-full animate-pulse-red" />
                                    <span className="font-ui text-sm font-black text-white/80 uppercase tracking-widest italic opacity-80">Recording Response...</span>
                                </div>
                                <button
                                    onClick={handleNext}
                                    className="group bg-white text-black font-heading font-black text-sm uppercase tracking-[0.2em] px-10 py-5 rounded-3xl flex items-center gap-3 transition-all hover:bg-white/90 active:scale-95 shadow-2xl"
                                >
                                    Next Question
                                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {isInterstitial && (
                    <motion.div
                        key="interstitial"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl text-center px-10"
                    >
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
                            <ShieldAlert className="w-32 h-32 text-primary relative z-10" strokeWidth={1} />
                        </div>
                        <h3 className="font-heading text-5xl font-black mb-6 tracking-tighter">Answer Saved Successfully</h3>
                        <p className="font-body text-slate-400 text-2xl italic mb-16 max-w-2xl opacity-80 leading-relaxed font-black">
                            Prepare for the next module. <br />Assessment recalibrating in...
                        </p>

                        <div className="relative">
                            <span className="font-heading text-[12rem] font-black italic tracking-tighter leading-none opacity-20 select-none">0{interstitialCount}</span>
                            <motion.div
                                key={interstitialCount}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="absolute inset-0 flex items-center justify-center font-heading text-[8rem] font-black italic tracking-tighter leading-none text-primary"
                            >
                                {interstitialCount}
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {showWarning && (
                    <motion.div
                        key="warning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[100] bg-danger/20 backdrop-blur-3xl flex items-center justify-center p-10"
                    >
                        <div className="max-w-xl w-full bg-slate-950 border-2 border-danger/50 rounded-[3rem] p-16 shadow-[0_0_100px_rgba(239,68,68,0.3)] text-center relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
                                <AlertTriangle size={300} className="text-danger" />
                            </div>

                            <div className="w-24 h-24 bg-danger/20 text-danger rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-lg">
                                <ShieldAlert size={48} />
                            </div>

                            <h3 className="font-heading text-4xl font-bold mb-6 tracking-tight text-white uppercase italic">Security Violation</h3>

                            <p className="font-body text-slate-300 text-lg mb-12 font-black leading-relaxed italic opacity-80">
                                {warningCount === 1
                                    ? "Full-screen mode was exited. This is your first and only warning. Immediate session termination will occur on the next violation."
                                    : "Multiple security violations detected. Interview session has been locked for review."
                                }
                            </p>

                            <button
                                onClick={attemptReenterFullscreen}
                                className="w-full bg-danger text-white font-heading font-black py-6 rounded-2xl flex items-center justify-center gap-4 transition-all hover:bg-danger/90 active:scale-95 shadow-2xl"
                            >
                                <RotateCcw size={24} />
                                Restore Full-Screen Session
                            </button>

                            <p className="mt-8 font-ui text-[10px] text-slate-600 uppercase tracking-widest font-black">Violation ID: SEC-SYS-{Math.floor(1000 + Math.random() * 9000)}-{warningCount}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
