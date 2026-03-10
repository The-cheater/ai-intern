"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, User, Key, Info, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function PortalLogin() {
    const [candidateId, setCandidateId] = useState("");
    const [password, setPassword]       = useState("");
    const [isLoading, setIsLoading]     = useState(false);
    const [error, setError]             = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch(`${API}/candidate/login`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ login_id: candidateId.trim(), password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Login failed. Please check your credentials.");
                return;
            }

            // Store session data for the portal pages
            sessionStorage.setItem("neurosync_session", JSON.stringify({
                session_id:      data.session_id,
                candidate_name:  data.candidate_name,
                job_description: data.job_description ?? "",
                questions:       data.questions ?? [],
            }));

            console.log("[NeuroSync][Login] session stored, redirecting to permissions");
            router.push("/portal/permissions");
        } catch {
            setError("Could not connect to the server. Please check your internet connection.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-indigo-500/20 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10">
                <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                        <ShieldCheck className="text-primary" size={32} strokeWidth={1.5} />
                    </div>
                    <h1 className="font-heading text-4xl font-bold mb-4 tracking-tight">Interview Portal</h1>
                    <p className="font-body text-slate-500 text-center italic text-lg px-8">
                        Enter the credentials provided by your recruiter to begin the assessment.
                    </p>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 bg-danger/10 border border-danger/30 text-danger px-5 py-4 rounded-2xl mb-6">
                        <AlertCircle size={18} className="flex-shrink-0" />
                        <p className="font-ui text-sm font-bold">{error}</p>
                    </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="font-ui text-[10px] text-slate-500 uppercase tracking-widest ml-1 font-black opacity-60">Candidate ID</label>
                        <div className="relative group">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-primary transition-colors" size={20} />
                            <input type="text" value={candidateId} onChange={e => setCandidateId(e.target.value)}
                                placeholder="e.g. NSC-482910"
                                className="w-full bg-slate-900 border border-white/5 rounded-3xl py-5 pl-14 pr-6 outline-none focus:border-primary/40 transition-all font-heading text-xl font-bold tracking-tight placeholder:text-slate-700"
                                required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-ui text-[10px] text-slate-500 uppercase tracking-widest ml-1 font-black opacity-60">Session Password</label>
                        <div className="relative group">
                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-primary transition-colors" size={20} />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full bg-slate-900 border border-white/5 rounded-3xl py-5 pl-14 pr-6 outline-none focus:border-primary/40 transition-all font-heading text-xl font-bold tracking-tight placeholder:text-slate-700"
                                required />
                        </div>
                    </div>

                    <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex gap-4 items-start mb-6">
                        <Info size={18} className="text-primary mt-1 flex-shrink-0" />
                        <p className="font-ui text-xs text-slate-400 font-bold leading-relaxed italic opacity-80">
                            Ensure you are in a quiet environment with a stable connection. Full-screen mode will be enforced after login. Credentials are valid for one use only.
                        </p>
                    </div>

                    <button type="submit" disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-heading font-black text-lg py-5 rounded-3xl shadow-violet-active flex items-center justify-center gap-3 transition-all scale-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                        {isLoading
                            ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
                            : <>Enter Secured Pipeline <ArrowRight size={22} className="opacity-60" /></>
                        }
                    </button>
                </form>

                <footer className="mt-16 pt-10 border-t border-white/5 text-center">
                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black">Powered by NeuroSync AI v3.0</p>
                </footer>
            </motion.div>
        </div>
    );
}
