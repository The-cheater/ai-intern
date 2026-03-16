"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, BarChart3, Users, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL    = "admin@gmail.com";
const ADMIN_PASSWORD = "admin";

export default function DashboardLogin() {
    const router = useRouter();
    const [email, setEmail]       = useState("");
    const [password, setPassword] = useState("");
    const [error, setError]       = useState("");
    const [loading, setLoading]   = useState(false);

    const stats = [
        { label: "Interviews Conducted", value: "12,482", icon: Users,    color: "text-primary" },
        { label: "Avg. Time Saved",       value: "45 hrs/wk", icon: Clock, color: "text-emerald-400" },
        { label: "Success Accuracy",      value: "98.4%",  icon: BarChart3, color: "text-amber-400" },
    ];

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        setTimeout(() => {
            if (email.trim() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                localStorage.setItem("vidya_admin_auth", JSON.stringify({
                    email: ADMIN_EMAIL,
                    loginAt: Date.now(),
                }));
                router.push("/dashboard");
            } else {
                setError("Invalid email or password. Please try again.");
                setLoading(false);
            }
        }, 400);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side: Stats & Tagline — always dark */}
            <div className="hidden lg:flex flex-1 flex-col justify-center px-20 bg-[#0f172a] border-r border-white/5 relative overflow-hidden">
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
                            <span className="font-heading text-xl font-bold text-white">V</span>
                        </div>
                        <span className="font-heading text-2xl font-bold text-white">Vidya AI</span>
                    </div>

                    <h1 className="font-heading text-6xl font-bold leading-tight mb-6 text-white">
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
                                className="bg-white/5 border border-white/8 p-6 rounded-2xl flex items-center gap-4"
                            >
                                <div className={`p-3 rounded-lg bg-white/5 ${stat.color}`}>
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-ui text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                    <p className="text-2xl font-heading font-bold text-white">{stat.value}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Right Side: Login Form */}
            <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-24 bg-background">
                <div className="max-w-md w-full mx-auto">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <span className="font-heading text-sm font-bold text-white">V</span>
                        </div>
                        <span className="font-heading text-xl font-bold text-foreground">Vidya AI</span>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="font-heading text-3xl font-bold mb-2 text-foreground">Interviewer Login</h2>
                        <p className="font-body text-foreground/50">Enter your credentials to manage your openings.</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div className="space-y-2">
                            <label className="font-ui text-xs text-foreground/50 uppercase tracking-widest ml-1">Work Email</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@gmail.com"
                                    required
                                    className="w-full bg-white border border-border rounded-xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all font-body text-foreground placeholder:text-foreground/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="font-ui text-xs text-foreground/50 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-white border border-border rounded-xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 transition-all font-body text-foreground"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3"
                            >
                                <AlertCircle size={16} className="flex-shrink-0" />
                                <span className="font-ui text-sm">{error}</span>
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-heading font-bold py-4 rounded-xl flex items-center justify-center gap-2 group transition-all"
                        >
                            {loading ? "Signing in…" : (
                                <>
                                    Sign In
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <footer className="mt-10 pt-10 border-t border-border text-center text-sm font-ui text-foreground/30">
                        &copy; 2024 Vidya AI Recruitment. All rights reserved.
                    </footer>
                </div>
            </div>
        </div>
    );
}
