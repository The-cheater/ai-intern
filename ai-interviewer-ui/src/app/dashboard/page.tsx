"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, FileUp, Briefcase, ChevronRight, ArrowRight,
    Users, Target, Activity, Copy, Check, Zap, Loader2, X, AlertCircle
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Credentials { session_id: string; job_opening_id: string; login_id: string; password: string }

function Toast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
    return (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-danger/90 text-white px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-danger/30">
            <AlertCircle size={18} />
            <span className="font-ui text-sm font-bold">{msg}</span>
            <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100"><X size={16} /></button>
        </motion.div>
    );
}

export default function Dashboard() {
    const [isCreating, setIsCreating]     = useState(false);
    const [step, setStep]                 = useState(1);
    const [activeTab, setActiveTab]       = useState<"resume" | "jd">("resume");
    const [jdText, setJdText]             = useState("");
    const [candidateName, setCandidateName] = useState("");
    const [pdfFile, setPdfFile]           = useState<File | null>(null);
    const [loadingMsg, setLoadingMsg]     = useState("");
    const [creds, setCreds]               = useState<Credentials | null>(null);
    const [copiedField, setCopiedField]   = useState<string | null>(null);
    const [toast, setToast]               = useState<string | null>(null);
    const fileInputRef                    = useRef<HTMLInputElement>(null);

    const openings = [
        { id: "1", title: "Senior Product Designer",      candidates: 24, avgScore: 82, status: "Active" },
        { id: "2", title: "Fullstack Engineer (Go/Next)", candidates: 12, avgScore: 78, status: "Active" },
        { id: "3", title: "Technical Product Manager",    candidates: 8,  avgScore: 91, status: "Reviewing" },
        { id: "4", title: "Marketing Director",           candidates: 45, avgScore: 65, status: "Closed" },
    ];

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

    const copyField = (value: string, field: string) => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleGenerate = async () => {
        if (!candidateName.trim()) { showToast("Please enter the candidate name."); return; }
        if (!pdfFile && !jdText.trim()) { showToast("Upload a resume PDF or paste a Job Description."); return; }

        setStep(2);

        try {
            // 1. Parse resume PDF
            let resumeMarkdown = "";
            if (pdfFile) {
                setLoadingMsg("Parsing resume PDF…");
                const form = new FormData();
                form.append("file", pdfFile);
                const res = await fetch(`${API}/parse/pdf`, { method: "POST", body: form });
                if (!res.ok) throw new Error((await res.json()).error ?? "PDF parsing failed");
                const parsed = await res.json();
                resumeMarkdown = parsed.raw_markdown ?? "";
            }

            // 2. Generate questions
            setLoadingMsg("Generating 18-20 questions via Qwen2.5…");
            const genRes = await fetch(`${API}/generate-questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resume_markdown: resumeMarkdown, job_description: jdText }),
            });
            if (!genRes.ok) throw new Error((await genRes.json()).error ?? "Question generation failed");
            const script = await genRes.json();

            // 3. Create session
            setLoadingMsg("Provisioning interview session…");
            const sessionRes = await fetch(`${API}/session/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name:  candidateName,
                    interviewer_id:  "recruiter-dashboard",
                    questions:       script.questions ?? [],
                    job_description: jdText,
                }),
            });
            if (!sessionRes.ok) throw new Error((await sessionRes.json()).error ?? "Session creation failed");
            setCreds(await sessionRes.json());
            setStep(3);
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : "An unexpected error occurred.");
            setStep(1);
        }
    };

    const resetModal = () => {
        setIsCreating(false); setStep(1); setPdfFile(null);
        setJdText(""); setCandidateName(""); setCreds(null);
    };

    return (
        <div className="space-y-12">
            <AnimatePresence>{toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}</AnimatePresence>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-4xl font-bold">Active Openings</h1>
                    <p className="font-body text-slate-500 mt-2 text-lg italic">Select an opening to view candidate insights.</p>
                </div>
                <button onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-6 py-4 rounded-xl shadow-violet transition-all group scale-100 hover:scale-105 active:scale-95">
                    <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                    Create New Opening
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {openings.map((job) => (
                    <Link key={job.id} href={`/dashboard/openings/${job.id}`}>
                        <motion.div whileHover={{ y: -5 }}
                            className="glass-card p-6 rounded-card border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-lg bg-primary/10 text-primary"><Briefcase size={24} /></div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-ui font-bold uppercase tracking-widest ${job.status === "Closed" ? "bg-slate-800 text-slate-500" : "bg-success/10 text-success"}`}>{job.status}</span>
                            </div>
                            <h3 className="font-heading text-xl font-bold mb-4 line-clamp-1">{job.title}</h3>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Candidates</p>
                                    <div className="flex items-center gap-2"><Users size={14} className="text-slate-400" /><span className="font-heading text-lg font-bold">{job.candidates}</span></div>
                                </div>
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Score</p>
                                    <div className="flex items-center gap-2"><Target size={14} className="text-slate-400" />
                                        <span className={`font-heading text-lg font-bold ${job.avgScore > 80 ? "text-success" : job.avgScore > 60 ? "text-warning" : "text-danger"}`}>{job.avgScore}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-between text-slate-400 group-hover:text-primary transition-colors">
                                <span className="font-ui text-sm font-medium">View Detail</span>
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Activity className="absolute bottom-2 right-2 text-primary/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">Total Candidates Scored</p>
                    <p className="font-heading text-4xl font-bold z-10 leading-tight">1,248 <span className="text-lg text-success">+12%</span></p>
                </div>
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Zap className="absolute bottom-2 right-2 text-warning/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">AI Parsing Efficiency</p>
                    <p className="font-heading text-4xl font-bold z-10 leading-tight">94.2s <span className="text-lg text-slate-600">Avg</span></p>
                </div>
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Users className="absolute bottom-2 right-2 text-success/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">Retention Match Score</p>
                    <p className="font-heading text-4xl font-bold z-10 leading-tight">88% <span className="text-lg text-primary">TOP TIER</span></p>
                </div>
            </div>

            {/* ── Creation Overlay ───────────────────────────────────────────────── */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 sm:p-20 overflow-y-auto">
                        <button onClick={resetModal} className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"><X size={32} /></button>

                        <div className="w-full max-w-4xl mx-auto">
                            <div className="text-center mb-12">
                                <span className="font-ui text-primary uppercase tracking-[0.3em] font-bold text-xs mb-4 block">Engine V3.0</span>
                                <h2 className="font-heading text-5xl font-bold mb-4">Initialize AI Interview Pipeline</h2>
                            </div>

                            {/* Step 1 */}
                            {step === 1 && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                                    <div className="max-w-lg mx-auto">
                                        <label className="font-ui text-xs text-slate-500 uppercase tracking-widest mb-3 block">Candidate Name *</label>
                                        <input value={candidateName} onChange={e => setCandidateName(e.target.value)}
                                            placeholder="e.g. Jane Doe"
                                            className="w-full bg-slate-900/40 border border-white/10 rounded-2xl px-6 py-4 font-heading text-xl font-bold outline-none focus:border-primary/50 transition-all placeholder:text-slate-700" />
                                    </div>

                                    <div className="flex bg-slate-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 max-w-lg mx-auto">
                                        {(["resume", "jd"] as const).map(tab => (
                                            <button key={tab} onClick={() => setActiveTab(tab)}
                                                className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-heading font-medium tracking-wide ${activeTab === tab ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-slate-200"}`}>
                                                {tab === "resume" ? <><FileUp size={20} />Upload Resume</> : <><Briefcase size={20} />Paste JD</>}
                                            </button>
                                        ))}
                                    </div>

                                    {activeTab === "resume" ? (
                                        <div className="group relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-1000" />
                                            <div className="relative border-2 border-dashed border-white/10 rounded-[2rem] p-24 text-center hover:border-primary/50 transition-all bg-slate-900/40 backdrop-blur-xl">
                                                <div className="bg-primary/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
                                                    <FileUp className="text-primary" size={48} />
                                                </div>
                                                {pdfFile
                                                    ? <p className="font-heading text-2xl font-bold text-primary">{pdfFile.name}</p>
                                                    : <><h4 className="font-heading text-3xl font-bold mb-4">Select PDF Document</h4>
                                                        <p className="font-body text-slate-500 text-lg">Drag and drop or <span className="text-primary font-bold underline decoration-dotted underline-offset-4">browse files</span></p></>
                                                }
                                            </div>
                                            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                                                onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                                        </div>
                                    ) : (
                                        <textarea value={jdText} onChange={e => setJdText(e.target.value)}
                                            placeholder="Paste the Job Description here. Include responsibilities, qualifications, and requirements…"
                                            className="w-full h-80 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-xl font-body outline-none focus:border-primary/50 transition-all placeholder:text-slate-700 leading-relaxed resize-none" />
                                    )}

                                    <div className="flex justify-center mt-12">
                                        <button onClick={handleGenerate}
                                            className="group relative px-12 py-6 bg-primary text-white font-heading text-xl font-bold rounded-2xl shadow-2xl overflow-hidden hover:shadow-violet-active transition-all">
                                            <div className="flex items-center gap-4 relative z-10">
                                                Generate AI Interview Link <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                                            </div>
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 2 — loading */}
                            {step === 2 && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-24">
                                    <div className="relative mb-12">
                                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                                        <Loader2 className="w-24 h-24 text-primary animate-spin relative z-10" strokeWidth={1} />
                                    </div>
                                    <h3 className="font-heading text-4xl font-bold mb-4 tracking-tight">Architecting the Assessment</h3>
                                    <p className="font-body text-slate-400 text-center max-w-lg mb-12 text-lg italic">{loadingMsg}</p>
                                    <div className="w-96 h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                        <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }}
                                            transition={{ duration: 18, ease: "linear" }}
                                            className="absolute left-0 top-0 h-full bg-primary shadow-violet" />
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3 — credentials */}
                            {step === 3 && creds && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                                    <div className="glass-card p-10 rounded-3xl border border-primary/20 shadow-violet-active relative overflow-hidden bg-slate-900/80 backdrop-blur-2xl">
                                        <div className="absolute top-0 right-0 p-4">
                                            <div className="bg-success text-white px-3 py-1 rounded-full text-[10px] font-heading font-black tracking-widest uppercase">GENERATED</div>
                                        </div>
                                        <div className="flex items-center gap-6 mb-12">
                                            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shadow-inner">
                                                <Check size={40} className="drop-shadow-lg" />
                                            </div>
                                            <div>
                                                <h4 className="font-heading text-3xl font-bold mb-1 tracking-tight">Interview Portal Active</h4>
                                                <p className="font-body text-slate-500 italic">Candidate access has been provisioned.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div>
                                                <label className="font-ui text-xs text-slate-400 uppercase tracking-widest mb-3 block opacity-70">Candidate Portal URL</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-primary text-lg overflow-hidden whitespace-nowrap">
                                                        {typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login"}
                                                    </div>
                                                    <button onClick={() => copyField(`${typeof window !== "undefined" ? window.location.origin : ""}/portal/login`, "url")}
                                                        className="bg-white/5 hover:bg-white/10 p-5 rounded-2xl transition-all active:scale-95 border border-white/5">
                                                        {copiedField === "url" ? <Check className="text-success" size={24} /> : <Copy className="text-slate-400" size={24} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-white/5 relative group">
                                                <label className="font-ui text-xs text-slate-500 uppercase tracking-widest mb-6 block relative z-10">Candidate Login Credentials</label>
                                                <div className="grid grid-cols-2 gap-8 relative z-10">
                                                    <div>
                                                        <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">LOGIN ID</p>
                                                        <div className="flex items-center gap-3">
                                                            <p className="font-heading text-2xl font-bold text-slate-200">{creds.login_id}</p>
                                                            <button onClick={() => copyField(creds.login_id, "id")} className="text-slate-600 hover:text-white transition-colors">
                                                                {copiedField === "id" ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">PASSWORD</p>
                                                        <div className="flex items-center gap-3">
                                                            <p className="font-heading text-2xl font-bold text-slate-200 tracking-tighter">{creds.password}</p>
                                                            <button onClick={() => copyField(creds.password, "pw")} className="text-slate-600 hover:text-white transition-colors">
                                                                {copiedField === "pw" ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="mt-6 font-ui text-[10px] text-slate-700 uppercase tracking-wider">Session: {creds.session_id}</p>
                                            </div>
                                        </div>

                                        <button onClick={resetModal}
                                            className="w-full mt-10 p-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-heading font-bold rounded-2xl transition-all">
                                            Return to Dashboard
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
