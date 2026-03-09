"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Share2, Star, Clock, Home, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ThankYou() {
    const sessionId = "ASTRA-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-2024";

    return (
        <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden font-body text-white">
            {/* Background Calmness */}
            <div className="absolute inset-0 bg-[#0F1117] pointer-events-none opacity-20 overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-blue-500/10 blur-[130px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="max-w-3xl w-full relative z-10"
            >
                <div className="w-24 h-24 bg-success/10 text-success rounded-[2.5rem] flex items-center justify-center border border-success/20 mx-auto mb-12 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
                    <CheckCircle2 size={48} strokeWidth={1.5} />
                </div>

                <h1 className="font-heading text-6xl font-black mb-6 tracking-tighter leading-tight italic">Interview Complete</h1>
                <p className="font-body text-slate-400 text-2xl italic mb-16 px-10 leading-relaxed font-black opacity-80">
                    Your responses have been successfully encrypted and submitted for AI review. <br />You will be notified by your recruiter for the next steps.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                        <Clock className="text-primary mx-auto mb-4" size={24} />
                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black italic">Duration</p>
                        <p className="font-heading text-2xl font-bold">18m 42s</p>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                        <Star className="text-warning mx-auto mb-4" size={24} />
                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black italic">Score Precision</p>
                        <p className="font-heading text-2xl font-bold">AI-V14 High</p>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                        <Share2 className="text-indigo-400 mx-auto mb-4" size={24} />
                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-black italic">Status</p>
                        <p className="font-heading text-2xl font-bold italic tracking-tight text-success uppercase">SECURED</p>
                    </div>
                </div>

                <div className="bg-slate-900/80 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative mb-12 group">
                    <div className="absolute top-0 right-0 p-4">
                        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-heading font-black tracking-widest uppercase italic">Verified</div>
                    </div>
                    <p className="font-ui text-xs text-slate-500 uppercase tracking-widest mb-4 font-black italic opacity-60">Your Secure Session Reference ID</p>
                    <p className="font-heading text-4xl font-black text-white italic tracking-tighter transition-all group-hover:tracking-normal group-hover:text-primary">
                        {sessionId}
                    </p>
                </div>

                <div className="flex justify-center gap-6">
                    <Link href="/portal/login" className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center gap-3 transition-all font-heading font-black text-sm uppercase tracking-widest text-slate-400 hover:text-white">
                        <Home size={18} /> Exit Portal
                    </Link>
                    <button className="px-10 py-5 bg-primary hover:bg-primary/90 text-white rounded-2xl flex items-center gap-3 transition-all shadow-violet-active font-heading font-black text-sm uppercase tracking-widest group">
                        Candidate Feedback
                        <ArrowRight size={18} className="translate-y-[-1px] group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <p className="mt-20 font-ui text-[10px] text-slate-600 uppercase tracking-[0.3em] font-black italic opacity-60">
                    Astra Behavioral Intelligence &copy; 2024-2025. All sessions are logged for audit compliance.
                </p>
            </motion.div>
        </div>
    );
}
