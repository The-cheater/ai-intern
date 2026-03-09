"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, BarChart3, Users, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const stats = [
        { label: "Interviews Conducted", value: "12,482", icon: Users, color: "text-primary" },
        { label: "Avg. Time Saved", value: "45 hrs/wk", icon: Clock, color: "text-success" },
        { label: "Success Accuracy", value: "98.4%", icon: BarChart3, color: "text-warning" },
    ];

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left Side: Stats & Tagline */}
            <div className="hidden lg:flex flex-1 flex-col justify-center px-20 bg-slate-900 border-r border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-primary blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-violet-500 blur-[100px] rounded-full" />
                </div>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10"
                >
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <span className="font-heading text-xl font-bold">A</span>
                        </div>
                        <span className="font-heading text-2xl font-bold">Astra</span>
                    </div>

                    <h1 className="font-heading text-6xl font-bold leading-tight mb-6">
                        The Future of <br />
                        <span className="text-primary italic">Precision</span> Hiring.
                    </h1>
                    <p className="font-body text-slate-400 text-xl max-w-lg mb-12">
                        Automate your recruitment funnel with digital candidate twins and AI-driven behavior analysis.
                    </p>

                    <div className="grid grid-cols-1 gap-6 max-w-md">
                        {stats.map((stat, idx) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + idx * 0.1 }}
                                className="glass-card p-6 rounded-card flex items-center gap-4"
                            >
                                <div className={`p-3 rounded-lg bg-white/5 ${stat.color}`}>
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-ui text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                    <p className="text-2xl font-heading font-bold">{stat.value}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Right Side: Login Form */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24">
                <div className="max-w-md w-full mx-auto">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="font-heading text-3xl font-bold mb-2">Interviewer Login</h2>
                        <p className="font-body text-slate-400">Enter your credentials to manage your openings.</p>
                    </div>

                    <form className="space-y-6">
                        <div className="space-y-2">
                            <label className="font-ui text-xs text-slate-500 uppercase tracking-widest ml-1">Work Email</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full bg-slate-900 border border-white/10 rounded-card py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all font-body"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="font-ui text-xs text-slate-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-900 border border-white/10 rounded-card py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all font-body"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm font-ui">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-slate-900 text-primary focus:ring-primary focus:ring-offset-slate-950" />
                                <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Remember me</span>
                            </label>
                            <Link href="#" className="text-primary hover:text-primary/80 transition-colors">Forgot password?</Link>
                        </div>

                        <Link href="/dashboard" className="block">
                            <button
                                type="button"
                                className="w-full bg-primary hover:bg-primary/90 text-white font-heading font-bold py-4 rounded-card flex items-center justify-center gap-2 group transition-all"
                            >
                                Sign In
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                    </form>

                    <footer className="mt-10 pt-10 border-t border-white/5 text-center text-sm font-ui text-slate-500">
                        &copy; 2024 Astra AI Recruitment. All rights reserved.
                    </footer>
                </div>
            </div>
        </div>
    );
}
