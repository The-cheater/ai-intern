"use client";

import React from "react";
import { motion } from "framer-motion";
import { UserCog, UserCircle, ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background subtle gradient ornaments */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/8 blur-[180px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-400/8 blur-[150px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 relative z-10 px-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 border border-gray-200 mb-8">
          <Sparkles size={16} className="text-primary" />
          <span className="font-ui text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">
            Next-Gen Recruitment Intelligence
          </span>
        </div>

        <h1 className="font-heading text-7xl md:text-8xl font-black mb-6 tracking-tight text-foreground">
          Vidya <span className="text-primary italic">AI.</span>
        </h1>

        <p className="font-body text-foreground/60 text-xl md:text-2xl italic font-medium max-w-2xl mx-auto leading-relaxed">
          One platform. Two precision-tuned experiences.
          <br />Select your portal to continue.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl relative z-10">
        {/* Recruiter Flow */}
        <Link href="/dashboard/login">
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group p-10 rounded-[3rem] border border-gray-200 hover:border-primary/40 transition-all cursor-pointer h-full flex flex-col items-center text-center shadow-sm hover:shadow-violet bg-white"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-10 group-hover:shadow-violet transition-all">
              <UserCog className="text-primary" size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-3xl font-bold mb-4 tracking-tight text-foreground">
              Interviewer Dashboard
            </h3>
            <p className="font-body text-foreground/50 text-lg italic mb-10 leading-relaxed px-4">
              Manage job openings, parse resumes, and explore deep behavioral candidate twin insights.
            </p>
            <div className="mt-auto flex items-center gap-3 text-primary font-heading font-black text-sm uppercase tracking-widest">
              Access Pipeline{" "}
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>
        </Link>

        {/* Candidate Flow */}
        <Link href="/portal/login">
          <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className="group p-10 rounded-[3rem] border border-gray-200 hover:border-emerald-400/40 transition-all cursor-pointer h-full flex flex-col items-center text-center shadow-sm hover:shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)] bg-white"
          >
            <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mb-10 group-hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] transition-all">
              <UserCircle className="text-emerald-500" size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-3xl font-bold mb-4 tracking-tight text-foreground">
              Candidate Portal
            </h3>
            <p className="font-body text-foreground/50 text-lg italic mb-10 leading-relaxed px-4">
              Secure environment to complete your AI-powered behavioral assessment and simulation.
            </p>
            <div className="mt-auto flex items-center gap-3 text-emerald-500 font-heading font-black text-sm uppercase tracking-widest">
              Begin Assessment{" "}
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>
        </Link>
      </div>

      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 text-center opacity-30 relative z-10">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck size={24} className="text-foreground/60" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest text-foreground/60">GDPR COMPLIANT</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Zap size={24} className="text-foreground/60" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest text-foreground/60">REAL-TIME INFERENCE</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck size={24} className="text-foreground/60" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest text-foreground/60">SOC2 TYPE II</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Zap size={24} className="text-foreground/60" />
          <span className="font-ui text-[10px] uppercase font-black tracking-widest text-foreground/60">99.9% UPTIME</span>
        </div>
      </div>
    </div>
  );
}
