"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, FileUp, Briefcase, ChevronRight, ArrowRight, ArrowLeft,
    Users, Target, Activity, Copy, Check, Zap, Loader2, X, AlertCircle,
    RefreshCw, Wand2, PenLine, Layers, Trash2, GripVertical,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface OceanSummary { job_fit_score: number; success_prediction: string }
interface Session {
    session_id: string;
    candidate_name: string;
    job_opening_id: string;
    job_description: string;
    login_id: string;
    created_at: string;
    ocean_summary: OceanSummary | null;
}
interface Opening {
    id: string;
    title: string;
    sessions: Session[];
    avgScore: number;
}
interface Credentials { session_id: string; job_opening_id: string; login_id: string; password: string }

type QuestionMode = "auto" | "manual" | "mixed";
interface SectionCounts { intro: number; technical: number; behavioral: number; logical: number }
interface ManualQuestion {
    id: string;
    stage: "intro" | "technical" | "behavioral" | "logical";
    question: string;
    time_window_seconds: number;
    ideal_answer: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
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

function groupByOpening(sessions: Session[]): Opening[] {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
        const key = s.job_opening_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([id, ss]) => {
        const scored = ss.filter(s => s.ocean_summary?.job_fit_score != null);
        const avgScore = scored.length
            ? Math.round(scored.reduce((a, s) => a + (s.ocean_summary!.job_fit_score * 100), 0) / scored.length)
            : 0;
        // Use job_opening_id as title — now it's either a slug or original UUID
        const rawTitle = id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const title = rawTitle.length > 50 ? rawTitle.slice(0, 47) + "…" : rawTitle;
        return { id, title, sessions: ss, avgScore };
    });
}

const STAGE_TIMES: Record<string, number> = {
    intro: 60, technical: 90, behavioral: 90, logical: 60,
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Dashboard() {
    const router = useRouter();
    /* --- session list --- */
    const [openings, setOpenings]               = useState<Opening[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [totalCandidates, setTotalCandidates] = useState(0);
    const [fetchError, setFetchError]           = useState<string | null>(null);

    /* --- creation modal --- */
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep]             = useState<1 | 2 | 3>(1);
    const [subStep, setSubStep]       = useState<"info" | "questions">("info");

    /* step 1 — info */
    const [openingTitle, setOpeningTitle] = useState("");
    const [candidateName, setCandidateName] = useState("");
    const [activeTab, setActiveTab]       = useState<"resume" | "jd">("resume");
    const [jdText, setJdText]             = useState("");
    const [pdfFile, setPdfFile]           = useState<File | null>(null);
    const fileInputRef                    = useRef<HTMLInputElement>(null);

    /* step 1 — question mode */
    const [qMode, setQMode]           = useState<QuestionMode>("auto");
    const [sectionCounts, setSectionCounts] = useState<SectionCounts>({
        intro: 3, technical: 7, behavioral: 4, logical: 4,
    });

    /* manual questions */
    const [manualQs, setManualQs]           = useState<ManualQuestion[]>([]);
    const [mqStage, setMqStage]             = useState<ManualQuestion["stage"]>("technical");
    const [mqText, setMqText]               = useState("");
    const [mqTime, setMqTime]               = useState(90);
    const [mqIdeal, setMqIdeal]             = useState("");

    /* step 2 — loading */
    const [loadingMsg, setLoadingMsg] = useState("");

    /* step 3 — credentials */
    const [creds, setCreds]       = useState<Credentials | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    /* toast */
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

    /* ── fetch sessions ── */
    const fetchSessions = async () => {
        setSessionsLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`${API}/sessions`);
            if (res.ok) {
                const sessions: Session[] = await res.json();
                setOpenings(groupByOpening(sessions));
                setTotalCandidates(sessions.length);
            } else {
                setFetchError(`Backend returned ${res.status}. Check the server logs.`);
            }
        } catch {
            setFetchError("Cannot reach backend. Make sure it's running: uvicorn api.main:app --reload --port 8000");
        } finally {
            setSessionsLoading(false);
        }
    };

    useEffect(() => { fetchSessions(); }, []);

    /* ── helpers ── */
    const copyField = (value: string, field: string) => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const totalQuestions =
        (qMode === "auto"   ? Object.values(sectionCounts).reduce((a, b) => a + b, 0) : 0) +
        (qMode === "manual" ? manualQs.length : 0) +
        (qMode === "mixed"  ? Object.values(sectionCounts).reduce((a, b) => a + b, 0) + manualQs.length : 0);

    const addManualQ = () => {
        if (!mqText.trim()) return;
        setManualQs(prev => [...prev, {
            id: `mq-${Date.now()}`,
            stage: mqStage,
            question: mqText.trim(),
            time_window_seconds: mqTime,
            ideal_answer: mqIdeal.trim(),
        }]);
        setMqText(""); setMqIdeal("");
    };

    const removeManualQ = (id: string) => setManualQs(prev => prev.filter(q => q.id !== id));

    const handleDeleteOpening = async (openingId: string) => {
        if (!confirm("Delete this opening and all candidate sessions (including media)?")) return;
        try {
            await fetch(`${API}/opening/${openingId}`, { method: "DELETE" });
            setOpenings(prev => prev.filter(o => o.id !== openingId));
            setTotalCandidates(prev => {
                const opening = openings.find(o => o.id === openingId);
                return opening ? Math.max(0, prev - opening.sessions.length) : prev;
            });
        } catch (e) {
            console.error("[NeuroSync][DeleteOpening]", e);
            showToast("Failed to delete opening.");
        }
    };

    /* ── main generate handler ── */
    const handleGenerate = async () => {
        if (!candidateName.trim()) { showToast("Please enter the candidate name."); return; }
        if (!openingTitle.trim())  { showToast("Please enter the opening title."); return; }
        if (!pdfFile && !jdText.trim()) { showToast("Upload a resume PDF or paste a Job Description."); return; }
        if (qMode === "manual" && manualQs.length === 0) { showToast("Add at least one manual question."); return; }

        setStep(2);

        try {
            // 1. Parse resume PDF (if any)
            let resumeMarkdown = "";
            if (pdfFile) {
                setLoadingMsg("Parsing resume PDF…");
                const form = new FormData();
                form.append("file", pdfFile);
                const res = await fetch(`${API}/parse/pdf`, { method: "POST", body: form });
                if (!res.ok) throw new Error((await res.json()).error ?? "PDF parsing failed");
                resumeMarkdown = (await res.json()).raw_markdown ?? "";
            }

            let generatedQuestions: unknown[] = [];

            // 2. Auto-generate questions (skip if manual-only)
            if (qMode === "auto" || qMode === "mixed") {
                setLoadingMsg("Generating interview questions with AI…");
                const genRes = await fetch(`${API}/generate-questions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resume_markdown: resumeMarkdown,
                        job_description: jdText,
                        section_counts: sectionCounts,
                    }),
                });
                if (!genRes.ok) throw new Error((await genRes.json()).error ?? "Question generation failed");
                const script = await genRes.json();
                generatedQuestions = script.questions ?? [];
            }

            // 3. Combine with manual questions
            const manualForApi = manualQs.map((q, i) => ({
                id: `mq${i + 1}`,
                stage: q.stage,
                question: q.question,
                time_window_seconds: q.time_window_seconds,
                ideal_answer: q.ideal_answer,
                answer_key: { critical_keywords: [], ideal_sentiment: "confident", rubric: "1=poor, 10=excellent" },
            }));

            const allQuestions = qMode === "manual"
                ? manualForApi
                : qMode === "mixed"
                    ? [...generatedQuestions, ...manualForApi]
                    : generatedQuestions;

            // 4. Create session
            setLoadingMsg("Provisioning interview session…");
            const sessionRes = await fetch(`${API}/session/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name:  candidateName,
                    opening_title:   openingTitle,
                    interviewer_id:  "recruiter-dashboard",
                    questions:       allQuestions,
                    job_description: jdText,
                }),
            });
            if (!sessionRes.ok) throw new Error((await sessionRes.json()).error ?? "Session creation failed");
            const newCreds = await sessionRes.json();
            setCreds(newCreds);
            setStep(3);
            fetchSessions();
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : "An unexpected error occurred.");
            setStep(1);
        }
    };

    const resetModal = () => {
        setIsCreating(false); setStep(1); setSubStep("info");
        setPdfFile(null); setJdText(""); setCandidateName(""); setOpeningTitle("");
        setCreds(null); setManualQs([]); setQMode("auto");
        setSectionCounts({ intro: 3, technical: 7, behavioral: 4, logical: 4 });
    };

    /* ──────────────────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-12">
            <AnimatePresence>{toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}</AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-4xl font-bold">Active Openings</h1>
                    <p className="font-body text-slate-500 mt-2 text-lg italic">Select an opening to view candidate insights.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchSessions} title="Refresh sessions"
                        className="p-3 rounded-xl bg-white border border-border text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all">
                        <RefreshCw size={18} className={sessionsLoading ? "animate-spin" : ""} />
                    </button>
                    <button onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-6 py-4 rounded-xl shadow-violet transition-all group scale-100 hover:scale-105 active:scale-95">
                        <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                        Create New Opening
                    </button>
                </div>
            </div>

            {/* Backend error */}
            {fetchError && (
                <div className="flex items-start gap-3 bg-danger/8 border border-danger/20 text-danger rounded-2xl px-6 py-4">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-ui text-sm font-bold">Backend unreachable</p>
                        <p className="font-body text-sm opacity-80 mt-0.5">{fetchError}</p>
                    </div>
                </div>
            )}

            {/* Openings grid */}
            {sessionsLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                    <Loader2 size={32} className="animate-spin mr-3" />
                    <span className="font-ui text-lg">Loading sessions…</span>
                </div>
            ) : openings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-6">
                        <Briefcase size={36} className="text-foreground/30" />
                    </div>
                    <h3 className="font-heading text-2xl font-bold mb-2 text-foreground/50">No sessions yet</h3>
                    <p className="font-body text-foreground/40 mb-8">Create your first interview session to get started.</p>
                    <button onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 bg-primary text-white font-heading font-bold px-6 py-3 rounded-xl shadow-violet hover:bg-primary/90 transition-all">
                        <Plus size={20} /> Create Opening
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {openings.map((job) => (
                        <motion.div
                            key={job.id}
                            whileHover={{ y: -5 }}
                            className="glass-card p-6 rounded-card border border-white/5 hover:border-primary/30 transition-all cursor-pointer group"
                            onClick={() => router.push(`/dashboard/openings/${job.id}`)}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                    <Briefcase size={24} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-ui font-bold uppercase tracking-widest bg-success/10 text-success">
                                        Active
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteOpening(job.id); }}
                                        className="p-1.5 rounded-lg hover:bg-danger/10 text-slate-500 hover:text-danger transition-colors"
                                        title="Delete opening"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-heading text-xl font-bold mb-4 line-clamp-2">{job.title}</h3>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Candidates</p>
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-slate-400" />
                                        <span className="font-heading text-lg font-bold">{job.sessions.length}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Fit</p>
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-slate-400" />
                                        <span
                                            className={`font-heading text-lg font-bold ${
                                                job.avgScore > 80
                                                    ? "text-success"
                                                    : job.avgScore > 60
                                                        ? "text-warning"
                                                        : job.avgScore > 0
                                                            ? "text-danger"
                                                            : "text-slate-500"
                                            }`}
                                        >
                                            {job.avgScore > 0 ? `${job.avgScore}%` : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-between text-slate-400 group-hover:text-primary transition-colors">
                                <span className="font-ui text-sm font-medium">View Detail</span>
                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Activity className="absolute bottom-2 right-2 text-primary/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">Total Candidates</p>
                    <p className="font-heading text-4xl font-bold z-10 leading-tight">{totalCandidates}</p>
                </div>
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Zap className="absolute bottom-2 right-2 text-warning/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">Active Openings</p>
                    <p className="font-heading text-4xl font-bold z-10 leading-tight">{openings.length}</p>
                </div>
                <div className="glass-card p-8 rounded-card relative overflow-hidden h-40 flex flex-col justify-center">
                    <Users className="absolute bottom-2 right-2 text-success/10 w-24 h-24" />
                    <p className="font-ui text-sm text-slate-500 uppercase tracking-widest mb-2 z-10">AI Engine</p>
                    <p className="font-heading text-2xl font-bold z-10 leading-tight">Vidya AI v3</p>
                </div>
            </div>

            {/* ── Creation Overlay ──────────────────────────────────────────── */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-[#f5f1eb] flex flex-col items-center justify-start p-8 sm:p-12 overflow-y-auto">
                        <button onClick={resetModal} className="absolute top-8 right-8 p-3 hover:bg-gray-200 rounded-full transition-colors text-foreground/40 hover:text-foreground">
                            <X size={28} />
                        </button>

                        <div className="w-full max-w-3xl mx-auto pt-8">
                            <div className="text-center mb-10">
                                <span className="font-ui text-primary uppercase tracking-[0.3em] font-bold text-xs mb-3 block">Engine V3.0</span>
                                <h2 className="font-heading text-4xl font-bold">Initialize AI Interview Pipeline</h2>
                            </div>

                            {/* Step 1 — Info + Question Config */}
                            {step === 1 && (
                                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                                    {/* Sub-step tabs */}
                                    <div className="flex bg-white border border-border p-1.5 rounded-2xl shadow-sm">
                                        {(["info", "questions"] as const).map((s, i) => (
                                            <button key={s} onClick={() => setSubStep(s)}
                                                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-heading font-medium text-sm tracking-wide ${subStep === s ? "bg-primary text-white shadow-violet" : "text-foreground/50 hover:text-foreground"}`}>
                                                <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center ${subStep === s ? "bg-white/20" : "bg-gray-200 text-foreground/40"}`}>{i + 1}</span>
                                                {s === "info" ? "Basic Info" : "Questions"}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Sub-step 1: Basic Info */}
                                    {subStep === "info" && (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                            <div>
                                                <label className="font-ui text-xs text-foreground/50 uppercase tracking-widest mb-2 block">Opening Title *</label>
                                                <input value={openingTitle} onChange={e => setOpeningTitle(e.target.value)}
                                                    placeholder="e.g. Senior Frontend Engineer"
                                                    className="w-full bg-white border border-border rounded-xl px-5 py-4 font-heading text-lg font-bold outline-none focus:border-primary/50 transition-all placeholder:text-gray-300 text-foreground" />
                                                <p className="font-ui text-[11px] text-foreground/30 mt-1 ml-1">Groups all candidates for this role into one opening.</p>
                                            </div>

                                            <div>
                                                <label className="font-ui text-xs text-foreground/50 uppercase tracking-widest mb-2 block">Candidate Name *</label>
                                                <input value={candidateName} onChange={e => setCandidateName(e.target.value)}
                                                    placeholder="e.g. Jane Doe"
                                                    className="w-full bg-white border border-border rounded-xl px-5 py-4 font-heading text-lg font-bold outline-none focus:border-primary/50 transition-all placeholder:text-gray-300 text-foreground" />
                                            </div>

                                            <div className="flex bg-white p-1.5 rounded-xl border border-border shadow-sm">
                                                {(["resume", "jd"] as const).map(tab => (
                                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                                        className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-all font-heading font-medium text-sm ${activeTab === tab ? "bg-primary text-white shadow-violet" : "text-foreground/50 hover:text-foreground"}`}>
                                                        {tab === "resume" ? <><FileUp size={16} />Upload Resume</> : <><Briefcase size={16} />Paste JD</>}
                                                    </button>
                                                ))}
                                            </div>

                                            {activeTab === "resume" ? (
                                                <div className="group relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                                    <div className="border-2 border-dashed border-border rounded-2xl p-14 text-center hover:border-primary/50 transition-all bg-white">
                                                        <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                                                            <FileUp className="text-primary" size={32} />
                                                        </div>
                                                        {pdfFile
                                                            ? <p className="font-heading text-xl font-bold text-primary">{pdfFile.name}</p>
                                                            : <><h4 className="font-heading text-2xl font-bold mb-2">Select PDF</h4>
                                                                <p className="font-body text-foreground/40">Click or drag to upload</p></>
                                                        }
                                                    </div>
                                                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                                                        onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                                                </div>
                                            ) : (
                                                <textarea value={jdText} onChange={e => setJdText(e.target.value)}
                                                    placeholder="Paste the Job Description here…"
                                                    className="w-full h-48 bg-white border border-border rounded-2xl p-6 font-body text-base outline-none focus:border-primary/50 transition-all placeholder:text-foreground/20 text-foreground resize-none" />
                                            )}

                                            <div className="flex justify-end">
                                                <button onClick={() => {
                                                    if (!candidateName.trim()) { showToast("Enter candidate name."); return; }
                                                    if (!openingTitle.trim()) { showToast("Enter opening title."); return; }
                                                    if (!pdfFile && !jdText.trim()) { showToast("Upload a resume or paste a JD."); return; }
                                                    setSubStep("questions");
                                                }} className="flex items-center gap-2 bg-primary text-white font-heading font-bold px-8 py-4 rounded-xl shadow-violet hover:bg-primary/90 transition-all">
                                                    Next: Configure Questions <ArrowRight size={18} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Sub-step 2: Question Config */}
                                    {subStep === "questions" && (
                                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

                                            {/* Mode selector */}
                                            <div>
                                                <label className="font-ui text-xs text-foreground/50 uppercase tracking-widest mb-3 block">Question Mode</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {([
                                                        { id: "auto",   icon: Wand2,   label: "Auto Generate",    desc: "AI generates all questions" },
                                                        { id: "manual", icon: PenLine,  label: "Manual Only",      desc: "Write your own questions" },
                                                        { id: "mixed",  icon: Layers,   label: "Mixed",            desc: "AI + your own questions" },
                                                    ] as const).map(m => (
                                                        <button key={m.id} onClick={() => setQMode(m.id)}
                                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${qMode === m.id ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/30"}`}>
                                                            <m.icon size={20} className={qMode === m.id ? "text-primary mb-2" : "text-foreground/30 mb-2"} />
                                                            <p className={`font-heading font-bold text-sm ${qMode === m.id ? "text-primary" : "text-foreground"}`}>{m.label}</p>
                                                            <p className="font-body text-[11px] text-foreground/40 mt-0.5">{m.desc}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Auto section counts */}
                                            {(qMode === "auto" || qMode === "mixed") && (
                                                <div className="bg-white border border-border rounded-2xl p-6">
                                                    <p className="font-ui text-xs text-foreground/50 uppercase tracking-widest mb-4">Questions per Section (AI Generated)</p>
                                                    <div className="grid grid-cols-2 gap-5">
                                                        {(Object.keys(sectionCounts) as Array<keyof SectionCounts>).map(stage => (
                                                            <div key={stage}>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <label className="font-heading font-bold text-sm capitalize text-foreground">{stage}</label>
                                                                    <span className="font-heading font-black text-primary text-lg">{sectionCounts[stage]}</span>
                                                                </div>
                                                                <input
                                                                    type="range" min={0} max={10} value={sectionCounts[stage]}
                                                                    onChange={e => setSectionCounts(prev => ({ ...prev, [stage]: Number(e.target.value) }))}
                                                                    className="w-full accent-primary"
                                                                />
                                                                <div className="flex justify-between font-ui text-[10px] text-foreground/30 mt-0.5">
                                                                    <span>0</span><span>10</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="font-ui text-xs text-foreground/40 mt-3">
                                                        Total AI questions: <span className="font-black text-primary">{Object.values(sectionCounts).reduce((a, b) => a + b, 0)}</span>
                                                    </p>
                                                </div>
                                            )}

                                            {/* Manual question builder */}
                                            {(qMode === "manual" || qMode === "mixed") && (
                                                <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
                                                    <p className="font-ui text-xs text-foreground/50 uppercase tracking-widest">Add Manual Questions</p>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 block">Stage</label>
                                                            <select value={mqStage} onChange={e => setMqStage(e.target.value as ManualQuestion["stage"])}
                                                                className="w-full bg-gray-50 border border-border rounded-xl px-3 py-2.5 font-heading font-bold text-sm text-foreground outline-none focus:border-primary/50">
                                                                <option value="intro">Intro</option>
                                                                <option value="technical">Technical</option>
                                                                <option value="behavioral">Behavioral</option>
                                                                <option value="logical">Logical</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 block">Time (seconds)</label>
                                                            <input type="number" min={30} max={300} value={mqTime}
                                                                onChange={e => setMqTime(Number(e.target.value))}
                                                                className="w-full bg-gray-50 border border-border rounded-xl px-3 py-2.5 font-heading font-bold text-sm text-foreground outline-none focus:border-primary/50" />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 block">Question *</label>
                                                        <textarea value={mqText} onChange={e => setMqText(e.target.value)}
                                                            placeholder="Enter your interview question…"
                                                            rows={2}
                                                            className="w-full bg-gray-50 border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground outline-none focus:border-primary/50 resize-none placeholder:text-foreground/20" />
                                                    </div>

                                                    <div>
                                                        <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 block">Ideal Answer (optional)</label>
                                                        <textarea value={mqIdeal} onChange={e => setMqIdeal(e.target.value)}
                                                            placeholder="What would a great answer look like?"
                                                            rows={2}
                                                            className="w-full bg-gray-50 border border-border rounded-xl px-4 py-3 font-body text-sm text-foreground outline-none focus:border-primary/50 resize-none placeholder:text-foreground/20" />
                                                    </div>

                                                    <button onClick={addManualQ}
                                                        disabled={!mqText.trim()}
                                                        className="flex items-center gap-2 bg-primary/10 text-primary font-heading font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                        <Plus size={16} /> Add Question
                                                    </button>

                                                    {/* List of added questions */}
                                                    {manualQs.length > 0 && (
                                                        <div className="mt-2 space-y-2">
                                                            {manualQs.map((q, i) => (
                                                                <div key={q.id} className="flex items-start gap-3 bg-gray-50 border border-border rounded-xl px-4 py-3">
                                                                    <GripVertical size={14} className="text-foreground/20 mt-0.5 flex-shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-ui text-[10px] text-primary uppercase tracking-widest font-black mb-0.5">{q.stage} · {q.time_window_seconds}s</p>
                                                                        <p className="font-body text-sm text-foreground line-clamp-2">{q.question}</p>
                                                                    </div>
                                                                    <button onClick={() => removeManualQ(q.id)} className="text-foreground/20 hover:text-danger transition-colors flex-shrink-0">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Summary + actions */}
                                            <div className="flex items-center justify-between pt-2">
                                                <button onClick={() => setSubStep("info")} className="flex items-center gap-2 text-foreground/50 hover:text-foreground font-heading font-bold text-sm transition-all">
                                                    <ArrowLeft size={16} /> Back
                                                </button>

                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="font-ui text-[10px] text-foreground/30 uppercase tracking-widest">Total questions</p>
                                                        <p className="font-heading font-black text-2xl text-primary">{totalQuestions}</p>
                                                    </div>
                                                    <button onClick={handleGenerate}
                                                        disabled={totalQuestions === 0}
                                                        className="flex items-center gap-2 bg-primary text-white font-heading font-bold px-8 py-4 rounded-xl shadow-violet hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                                        Generate Interview Link <ArrowRight size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* Step 2 — Loading */}
                            {step === 2 && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-24">
                                    <div className="relative mb-10">
                                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                                        <Loader2 className="w-20 h-20 text-primary animate-spin relative z-10" strokeWidth={1} />
                                    </div>
                                    <h3 className="font-heading text-3xl font-bold mb-3">Architecting the Assessment</h3>
                                    <p className="font-body text-foreground/40 text-center max-w-md mb-3 text-lg italic">{loadingMsg}</p>
                                    <p className="font-ui text-xs text-foreground/30 mb-10 uppercase tracking-widest">This may take 2–3 minutes</p>
                                    <div className="w-80 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }}
                                            transition={{ duration: 150, ease: "linear" }}
                                            className="h-full bg-primary" />
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3 — Credentials */}
                            {step === 3 && creds && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                                    <div className="bg-white p-10 rounded-3xl border border-primary/20 shadow-violet-active relative overflow-hidden">
                                        <div className="absolute top-4 right-4">
                                            <div className="bg-success text-white px-3 py-1 rounded-full text-[10px] font-heading font-black tracking-widest uppercase">GENERATED</div>
                                        </div>
                                        <div className="flex items-center gap-5 mb-10">
                                            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
                                                <Check size={32} />
                                            </div>
                                            <div>
                                                <h4 className="font-heading text-2xl font-bold mb-1">Interview Portal Active</h4>
                                                <p className="font-body text-foreground/40 italic text-sm">Candidate access has been provisioned.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-2 block">Candidate Portal URL</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-gray-50 border border-border p-4 rounded-xl font-mono text-primary text-sm overflow-hidden whitespace-nowrap">
                                                        {typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login"}
                                                    </div>
                                                    <button onClick={() => copyField(`${typeof window !== "undefined" ? window.location.origin : ""}/portal/login`, "url")}
                                                        className="bg-gray-100 hover:bg-gray-200 p-4 rounded-xl transition-all border border-border">
                                                        {copiedField === "url" ? <Check className="text-success" size={20} /> : <Copy className="text-slate-400" size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 p-6 rounded-2xl border border-border">
                                                <label className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-4 block">Candidate Login Credentials</label>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 font-black">LOGIN ID</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-heading text-xl font-bold text-foreground">{creds.login_id}</p>
                                                            <button onClick={() => copyField(creds.login_id, "id")} className="text-foreground/30 hover:text-foreground">
                                                                {copiedField === "id" ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest mb-1 font-black">PASSWORD</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-heading text-xl font-bold text-foreground">{creds.password}</p>
                                                            <button onClick={() => copyField(creds.password, "pw")} className="text-foreground/30 hover:text-foreground">
                                                                {copiedField === "pw" ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="mt-4 font-ui text-[10px] text-foreground/25 uppercase tracking-wider">Session: {creds.session_id}</p>
                                            </div>
                                        </div>

                                        <button onClick={resetModal}
                                            className="w-full mt-8 p-4 bg-gray-100 hover:bg-gray-200 border border-border text-foreground font-heading font-bold rounded-2xl transition-all">
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
