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
            sessionStorage.setItem("examiney_session", JSON.stringify({
                session_id:      data.session_id,
                candidate_name:  data.candidate_name,
                job_description: data.job_description ?? "",
                questions:       data.questions ?? [],
            }));

            console.log("[Examiney][Login] session stored, redirecting to permissions");
            router.push("/portal/permissions");
        } catch {
            setError("Could not connect to the server. Please check your internet connection.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-12 h-12 bg-white border border-border rounded-xl flex items-center justify-center mb-6 shadow-sm">
                        <ShieldCheck className="text-primary" size={24} strokeWidth={1.5} />
                    </div>
                    <h1 className="font-heading text-2xl font-semibold mb-2 tracking-tight">Interview Portal</h1>
                    <p className="font-body text-foreground/50 text-center text-sm px-4">
                        Enter the credentials provided by your recruiter.
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
                        <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest ml-1 font-black">Candidate ID</label>
                        <div className="relative group">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={20} />
                            <input type="text" value={candidateId} onChange={e => setCandidateId(e.target.value)}
                                placeholder="e.g. NSC-482910"
                                className="w-full bg-white border border-border rounded-xl py-3 pl-10 pr-4 outline-none focus:border-primary/50 transition-all font-body text-sm placeholder:text-gray-300 text-foreground shadow-sm"
                                required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest ml-1 font-black">Session Password</label>
                        <div className="relative group">
                            <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={20} />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full bg-white border border-border rounded-xl py-3 pl-10 pr-4 outline-none focus:border-primary/50 transition-all font-body text-sm placeholder:text-gray-300 text-foreground shadow-sm"
                                required />
                        </div>
                    </div>

                    <div className="bg-primary/5 p-5 rounded-2xl border border-primary/15 flex gap-4 items-start mb-6">
                        <Info size={18} className="text-primary mt-1 flex-shrink-0" />
                        <p className="font-ui text-xs text-foreground/60 leading-relaxed italic">
                            Ensure you are in a quiet environment with a stable connection. Full-screen mode will be enforced after login. Credentials are valid for one use only.
                        </p>
                    </div>

                    <button type="submit" disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-ui font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                        {isLoading
                            ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                            : <>Begin Interview <ArrowRight size={16} /></>
                        }
                    </button>
                </form>

            </motion.div>
        </div>
    );
}
