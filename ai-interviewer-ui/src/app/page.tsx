"use client";

import React from "react";
import { motion } from "framer-motion";
import { UserCog, UserCircle, ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Cinematic Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[180px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-900/10 blur-[150px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 relative z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-white/5 mb-8">
          <Sparkles size={16} className="text-primary" />
          <span className="font-ui text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next-Gen Recruitment Intelligence</span>
        </div>
        <h1 className="font-heading text-7xl md:text-8xl font-black mb-6 tracking-tight italic bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
          Astra AI.
        </h1>
        <p className="font-body text-slate-400 text-xl md:text-2xl italic font-medium max-w-2xl mx-auto">
          One platform. Two precision-tuned experiences. <br />Select your portal to continue.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl relative z-10">
        {/* Recruiter Flow */}
        <Link href="/dashboard/login">
          <motion.div
            whileHover={{ y: -10, scale: 1.02 }}
            className="glass-card group p-10 rounded-[3rem] border border-white/5 hover:border-primary/30 transition-all cursor-pointer h-full flex flex-col items-center text-center shadow-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-primary/5"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-10 group-hover:shadow-violet-active transition-all">
              <UserCog className="text-primary" size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-3xl font-bold mb-4 tracking-tight">Interviewer Dashboard</h3>
            <p className="font-body text-slate-500 text-lg italic mb-10 leading-relaxed px-4">
              Manage job openings, parse resumes, and explore deep behavioral candidate twin insights.
            </p>
            <div className="mt-auto flex items-center gap-3 text-primary font-heading font-black text-sm uppercase tracking-widest">
              Access Pipeline <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>
        </Link>

        {/* Candidate Flow */}
        <Link href="/portal/login">
          <motion.div
            whileHover={{ y: -10, scale: 1.02 }}
            className="glass-card group p-10 rounded-[3rem] border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer h-full flex flex-col items-center text-center shadow-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-500/5"
          >
            <div className="w-24 h-24 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-10 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all">
              <UserCircle className="text-emerald-400" size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-3xl font-bold mb-4 tracking-tight">Candidate Portal</h3>
            <p className="font-body text-slate-500 text-lg italic mb-10 leading-relaxed px-4">
              Secure environment to complete your AI-powered behavioral assessment and simulation.
            </p>
            <div className="mt-auto flex items-center gap-3 text-emerald-400 font-heading font-black text-sm uppercase tracking-widest">
              Begin Assessment <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>
        </Link>
      </div>

      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 text-center opacity-40">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck size={24} className="text-slate-500" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest">GDPR COMPLIANT</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Zap size={24} className="text-slate-500" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest">REAL-TIME INFERENCE</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck size={24} className="text-slate-500" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest">SOC2 TYPE II</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Zap size={24} className="text-slate-500" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest">99.9% UPTIME</span>
        </div>
      </div>
    </div>
  );
}
