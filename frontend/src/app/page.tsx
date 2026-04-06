"use client";

import React from "react";
import { motion } from "framer-motion";
import { UserCog, UserCircle, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 px-4"
      >
        <h1 className="font-heading text-5xl font-bold mb-4 tracking-tight text-foreground">
          Examiney<span className="text-primary">.AI</span>
        </h1>
        <p className="font-body text-foreground/50 text-lg max-w-lg mx-auto leading-relaxed">
          Welcome. Please choose how you would like to sign in.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Recruiter Flow */}
        <Link href="/dashboard/login">
          <motion.div
            whileHover={{ y: -4 }}
            className="group p-8 rounded-2xl border border-gray-200 hover:border-primary/40 transition-all cursor-pointer h-full flex flex-col items-center text-center bg-white shadow-sm"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
              <UserCog className="text-primary" size={32} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-xl font-semibold mb-3 tracking-tight text-foreground">
              Interviewer Dashboard
            </h3>
            <p className="font-body text-foreground/50 text-sm mb-8 leading-relaxed">
              Manage job openings, review candidates, and access assessment reports.
            </p>
            <div className="mt-auto flex items-center gap-2 text-primary font-ui font-semibold text-sm">
              Sign In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </Link>

        {/* Candidate Flow */}
        <Link href="/portal/login">
          <motion.div
            whileHover={{ y: -4 }}
            className="group p-8 rounded-2xl border border-gray-200 hover:border-emerald-400/40 transition-all cursor-pointer h-full flex flex-col items-center text-center bg-white shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mb-6">
              <UserCircle className="text-emerald-500" size={32} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading text-xl font-semibold mb-3 tracking-tight text-foreground">
              Candidate Portal
            </h3>
            <p className="font-body text-foreground/50 text-sm mb-8 leading-relaxed">
              Enter your credentials to begin the interview assessment.
            </p>
            <div className="mt-auto flex items-center gap-2 text-emerald-600 font-ui font-semibold text-sm">
              Enter Portal <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-12 text-center opacity-30">
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
