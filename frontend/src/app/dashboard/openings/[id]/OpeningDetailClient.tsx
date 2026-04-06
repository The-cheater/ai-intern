"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft, Search, Filter, Download, ChevronRight,
    TrendingUp, BrainCircuit, PieChart, Trash2, Loader2,
    Play, CheckCircle2, AlertCircle, Cpu, RefreshCw,
    UserPlus, Plus, Copy, Check, X,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OceanSummary {
    job_fit_score: number;
    success_prediction: string;
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
}

interface Candidate {
    session_id: string;
    candidate_name: string;
    job_opening_id: string;
    login_id?: string;
    questions?: any[];
    job_description?: string;
    created_at: string;
    ocean_summary: OceanSummary | null;
}

interface ProcessingState {
    session_id: string;
    candidate_name: string;
    status: "queued" | "processing" | "done" | "error";
    stage: string;
    stage_label: string;
    stage_done: number;
    stage_total: number;
    stalled: boolean;
    stage_age_seconds: number;
}

// Stage → progress bar percentage
const STAGE_PCT: Record<string, number> = {
    transcribing:   20,
    scoring:        50,
    finalizing:     75,
    analyzing_attention: 90,
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
    transcribing:   <Cpu size={14} />,
    scoring:        <BrainCircuit size={14} />,
    finalizing:     <BrainCircuit size={14} />,
    analyzing_attention: <Play size={14} />,
};

interface AddCandidateResult {
    login_id: string;
    password: string;
    session_id: string;
}

export default function OpeningDetailClient({ id }: { id: string }) {
    const [candidates, setCandidates]     = useState<Candidate[]>([]);
    const [loading, setLoading]           = useState(true);
    const [fetchError, setFetchError]     = useState(false);
    const [search, setSearch]             = useState("");
    const [deleting, setDeleting]         = useState<string | null>(null);
    const [processing, setProcessing]     = useState<ProcessingState | null>(null);
    const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchAbortRef                   = useRef<AbortController | null>(null);

    // ── Add candidate modal state ─────────────────────────────────────────────
    const [showAddModal, setShowAddModal]   = useState(false);
    const [addName, setAddName]             = useState("");
    const [addLoading, setAddLoading]       = useState(false);
    const [addResult, setAddResult]         = useState<AddCandidateResult | null>(null);
    const [copiedField, setCopiedField]     = useState<"login_id" | "password" | null>(null);

    // ── Fetch candidates ──────────────────────────────────────────────────────
    const fetchCandidates = useCallback(async () => {
        // Cancel any previous in-flight request before starting a new one
        if (fetchAbortRef.current) fetchAbortRef.current.abort();
        const controller = new AbortController();
        fetchAbortRef.current = controller;

        try {
            const res = await fetch(`${API}/opening/${id}/candidates`, {
                signal: controller.signal,
            });
            if (res.ok) {
                const data = await res.json();
                setCandidates(data);
                setFetchError(false);
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") return; // intentional cancel
            console.error("[Examiney][OpeningDetail] fetchCandidates:", e);
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Auto-refresh every 15 s if any candidate is still unprocessed
    useEffect(() => {
        fetchCandidates();
        const timer = setInterval(() => {
            setCandidates(prev => {
                if (prev.some(c => !c.ocean_summary)) fetchCandidates();
                return prev;
            });
        }, 15000);
        return () => clearInterval(timer);
    }, [fetchCandidates]);

    // Clean up poll and in-flight fetch on unmount
    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (fetchAbortRef.current) fetchAbortRef.current.abort();
    }, []);

    // ── Start processing a session ────────────────────────────────────────────
    const handleProcess = async (cand: Candidate) => {
        if (pollRef.current) clearInterval(pollRef.current);

        setProcessing({
            session_id:        cand.session_id,
            candidate_name:    cand.candidate_name,
            status:            "queued",
            stage:             "queued",
            stage_label:       "Starting…",
            stage_done:        0,
            stage_total:       0,
            stalled:           false,
            stage_age_seconds: 0,
        });

        try {
            const r = await fetch(`${API}/session/${cand.session_id}/process`, { method: "POST" });
            if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                setProcessing(p => p ? { ...p, status: "error", stage_label: body?.detail?.error ?? "Failed to start." } : null);
                return;
            }
        } catch (err) {
            setProcessing(p => p ? { ...p, status: "error", stage_label: "Network error. Please try again." } : null);
            return;
        }

        setProcessing(p => p ? { ...p, status: "processing", stage: "transcribing", stage_label: "Fetching media from Cloudinary…" } : null);

        // Poll status every 3 s
        let polls = 0;
        pollRef.current = setInterval(async () => {
            polls += 1;
            try {
                const sr = await fetch(`${API}/session/${cand.session_id}/status`);
                if (!sr.ok) return;
                const data = await sr.json();

                if (data.status === "ready") {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;
                    setProcessing(p => p ? { ...p, status: "done", stage: "done", stage_label: "Processing complete!" } : null);
                    fetchCandidates();
                    // Auto-dismiss after 4 s
                    setTimeout(() => setProcessing(null), 4000);
                } else if (data.status === "processing") {
                    setProcessing(p => p ? {
                        ...p,
                        status:            "processing",
                        stage:             data.stage             ?? p.stage,
                        stage_label:       data.stage_label       ?? p.stage_label,
                        stage_done:        data.stage_done        ?? p.stage_done,
                        stage_total:       data.stage_total       ?? p.stage_total,
                        stalled:           data.stalled           ?? false,
                        stage_age_seconds: data.stage_age_seconds ?? p.stage_age_seconds,
                    } : null);
                } else if (data.status === "error") {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;
                    setProcessing(p => p ? { ...p, status: "error", stage_label: data.detail ?? "Processing failed. Please try again." } : null);
                }
            } catch {
                // ignore transient network error during poll
            }

            // Safety timeout: ~10 min max
            if (polls >= 200) {
                clearInterval(pollRef.current!);
                pollRef.current = null;
                setProcessing(p => p ? { ...p, status: "error", stage_label: "Timed out. Check backend logs." } : null);
            }
        }, 3000);
    };

    // ── Delete candidate ──────────────────────────────────────────────────────
    const handleDelete = async (sessionId: string) => {
        if (!confirm("Delete all data for this candidate? This removes their scores, transcripts, and media from Cloudinary. The job opening is NOT deleted.")) return;
        setDeleting(sessionId);
        try {
            await fetch(`${API}/session/${sessionId}`, { method: "DELETE" });
            setCandidates(prev => prev.filter(c => c.session_id !== sessionId));
        } catch (e) {
            console.error("[Examiney][Delete]", e);
            alert("Delete failed — please try again.");
        } finally {
            setDeleting(null);
        }
    };

    // ── Add candidate ─────────────────────────────────────────────────────────
    const handleAddCandidate = async () => {
        if (!addName.trim()) return;
        setAddLoading(true);
        try {
            // Reuse questions + job_description from the first existing session for this opening
            let questions: unknown[] = [];
            let jobDescription = "";
            if (candidates.length > 0) {
                // First try to get questions directly from the candidates list (now available via updated SELECT)
                const firstCand = candidates[0];
                if (firstCand && 'questions' in firstCand) {
                    questions = (firstCand as any).questions || [];
                }
                // Fallback: fetch full report if questions not in list
                if (!questions || questions.length === 0) {
                    try {
                        const rep = await fetch(`${API}/session/${firstCand.session_id}/report`);
                        if (rep.ok) {
                            const data = await rep.json();
                            questions      = data.session?.questions      || [];
                            jobDescription = data.session?.job_description || "";
                        }
                    } catch { /* proceed without questions */ }
                }
            }
            const res = await fetch(`${API}/session/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name:  addName.trim(),
                    job_opening_id:  id,
                    interviewer_id:  "admin",
                    questions,
                    job_description: jobDescription,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setAddResult({ login_id: data.login_id, password: data.password, session_id: data.session_id });
                fetchCandidates();
            } else {
                const body = await res.json().catch(() => ({}));
                alert(body?.detail?.error ?? "Failed to add candidate.");
            }
        } catch (e) {
            console.error("[Examiney][AddCandidate]", e);
            alert("Network error adding candidate.");
        } finally {
            setAddLoading(false);
        }
    };

    const handleCopy = (field: "login_id" | "password", value: string) => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setAddName("");
        setAddResult(null);
        setAddLoading(false);
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const filtered = candidates.filter(c =>
        c.candidate_name.toLowerCase().includes(search.toLowerCase())
    );

    const scoreColor = (score: number) =>
        score >= 70 ? "bg-success/10 text-success border-success/20"
            : score >= 50 ? "bg-warning/10 text-warning border-warning/20"
                : "bg-danger/10 text-danger border-danger/20";

    const processingPct = processing
        ? processing.status === "done"   ? 100
        : processing.status === "error"  ? 100
        : STAGE_PCT[processing.stage]   ?? 10
        : 0;

    return (
        <div className="space-y-10">
            {/* ── Backend unreachable banner ────────────────────────────────────── */}
            <AnimatePresence>
                {fetchError && (
                    <motion.div
                        key="fetch-error-banner"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 flex items-center gap-3"
                    >
                        <AlertCircle size={18} className="text-amber-400 shrink-0" />
                        <p className="text-sm text-amber-300/80">
                            Could not reach the API server. Make sure the backend is running on{" "}
                            <code className="font-mono text-amber-300">{API}</code>.
                            The page will retry automatically.
                        </p>
                        <button
                            onClick={() => { setFetchError(false); fetchCandidates(); }}
                            className="ml-auto shrink-0 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                            <RefreshCw size={13} /> Retry
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Processing progress banner ─────────────────────────────────── */}
            <AnimatePresence>
                {processing && (
                    <motion.div
                        key="processing-banner"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`rounded-2xl border p-5 relative overflow-hidden
                            ${processing.status === "done"  ? "border-success/30 bg-success/5"
                            : processing.status === "error" ? "border-danger/30 bg-danger/5"
                            : "border-primary/30 bg-primary/5"}`}
                    >
                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 h-0.5 bg-slate-800 w-full">
                            <motion.div
                                className={`h-full ${processing.status === "error" ? "bg-danger" : "bg-primary"}`}
                                initial={{ width: "5%" }}
                                animate={{ width: `${processingPct}%` }}
                                transition={{ duration: 0.8 }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl
                                    ${processing.status === "done"  ? "bg-success/20 text-success"
                                    : processing.status === "error" ? "bg-danger/20 text-danger"
                                    : "bg-primary/20 text-primary"}`}>
                                    {processing.status === "done"   ? <CheckCircle2 size={20} />
                                    : processing.status === "error" ? <AlertCircle size={20} />
                                    : <Loader2 size={20} className="animate-spin" />}
                                </div>
                                <div>
                                    <p className="font-heading font-bold text-sm text-slate-200">
                                        {processing.candidate_name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {STAGE_ICONS[processing.stage] && (
                                            <span className={`${processing.status === "error" ? "text-danger" : "text-primary"}`}>
                                                {STAGE_ICONS[processing.stage]}
                                            </span>
                                        )}
                                        <p className={`font-ui text-xs
                                            ${processing.status === "done"    ? "text-success"
                                            : processing.status === "error"   ? "text-danger"
                                            : processing.stalled              ? "text-amber-400"
                                            : "text-slate-400"}`}>
                                            {processing.stalled
                                                ? `Still working… (${Math.round(processing.stage_age_seconds / 60)}m elapsed — Whisper is slow on CPU)`
                                                : processing.stage_label}
                                            {processing.status === "processing" && !processing.stalled && processing.stage_total > 0 && (
                                                <span className="ml-2 text-slate-600">
                                                    ({processing.stage_done}/{processing.stage_total})
                                                </span>
                                            )}
                                            {processing.status === "processing" && !processing.stalled && processing.stage_age_seconds > 30 && (
                                                <span className="ml-2 text-slate-700">
                                                    {processing.stage_age_seconds}s
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (pollRef.current) clearInterval(pollRef.current);
                                    setProcessing(null);
                                }}
                                className="text-slate-600 hover:text-slate-400 text-xs font-ui uppercase tracking-widest px-3 py-1 rounded-lg hover:bg-white/5 transition-all">
                                Dismiss
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ────────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-6">
                <Link href="/dashboard" className="p-3 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors text-foreground/50 hover:text-foreground shadow-sm">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <div className="flex items-center gap-4 mb-1">
                        <h1 className="font-heading text-4xl font-bold">Opening {id}</h1>
                        <span className="bg-success/10 text-success text-[10px] font-heading font-black tracking-widest px-3 py-1 rounded-full uppercase border border-success/20">ACTIVE</span>
                    </div>
                    <p className="font-body text-slate-500 text-lg flex items-center gap-2">
                        ID: <span className="text-foreground font-medium">{id}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="text-primary font-bold">{candidates.length} Total Applicants</span>
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={() => { setAddResult(null); setAddName(""); setShowAddModal(true); }}
                        className="flex items-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl transition-colors text-primary font-ui font-black text-sm shadow-sm"
                        title="Add Candidate">
                        <UserPlus size={18} /> Add Candidate
                    </button>
                    <button onClick={fetchCandidates}
                        className="p-3 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors text-foreground/40 hover:text-foreground shadow-sm"
                        title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* ── Add Candidate Modal ────────────────────────────────────────── */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        key="add-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        onClick={e => { if (e.target === e.currentTarget) closeAddModal(); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="w-full max-w-md bg-white border border-border rounded-3xl p-8 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary"><UserPlus size={20} /></div>
                                    <h3 className="font-heading text-xl font-bold">Add Candidate</h3>
                                </div>
                                <button onClick={closeAddModal} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500 hover:text-foreground transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {!addResult ? (
                                <>
                                    <p className="font-body text-slate-400 text-sm mb-6 leading-relaxed">
                                        Adding a new candidate to <span className="text-primary font-bold">{id}</span>.
                                        They will receive the same login ID as existing candidates for this opening, with a unique password.
                                    </p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="font-ui text-[10px] text-slate-500 uppercase tracking-widest font-black block mb-2">
                                                Candidate Full Name
                                            </label>
                                            <input
                                                type="text"
                                                value={addName}
                                                onChange={e => setAddName(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && !addLoading && handleAddCandidate()}
                                                placeholder="e.g. John Smith"
                                                autoFocus
                                                className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 text-sm font-ui text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={handleAddCandidate}
                                            disabled={!addName.trim() || addLoading}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 rounded-xl font-heading font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {addLoading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <><Plus size={16} /> Create Candidate</>}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 mb-6 p-4 bg-success/10 border border-success/20 rounded-2xl">
                                        <CheckCircle2 size={20} className="text-success shrink-0" />
                                        <p className="font-ui text-sm text-success font-bold">Candidate created successfully!</p>
                                    </div>
                                    <p className="font-body text-slate-500 text-xs mb-4 leading-relaxed">
                                        Share these credentials with <span className="text-foreground font-bold">{addName}</span>. The password can only be used once.
                                    </p>
                                    <div className="space-y-3 mb-6">
                                        {([
                                            { label: "Login ID",  field: "login_id"  as const, value: addResult.login_id  },
                                            { label: "Password",  field: "password"  as const, value: addResult.password  },
                                        ]).map(({ label, field, value }) => (
                                            <div key={field} className="flex items-center gap-3 p-4 bg-gray-50 border border-border rounded-xl">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                                                    <p className="font-heading font-bold text-base text-foreground truncate">{value}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(field, value)}
                                                    className="shrink-0 p-2 hover:bg-gray-200 rounded-lg text-slate-400 hover:text-foreground transition-colors"
                                                    title={`Copy ${label}`}
                                                >
                                                    {copiedField === field
                                                        ? <Check size={16} className="text-success" />
                                                        : <Copy size={16} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setAddResult(null); setAddName(""); }}
                                            className="flex-1 py-3 border border-border hover:bg-gray-100 rounded-xl font-heading font-bold text-sm text-foreground/60 transition-all"
                                        >
                                            Add Another
                                        </button>
                                        <button
                                            onClick={closeAddModal}
                                            className="flex-1 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl font-heading font-bold text-sm text-primary transition-all"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Search + controls */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-border shadow-sm">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" size={18} />
                            <input type="text" placeholder="Search candidates by name…" value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-gray-50 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-ui text-foreground placeholder:text-foreground/30 outline-none focus:border-primary/50 transition-all" />
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 border border-border rounded-xl text-sm font-ui font-bold text-foreground/60 transition-all">
                                <Filter size={18} /> Filter
                            </button>
                            <button className="flex items-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 border border-border rounded-xl text-sm font-ui font-bold text-foreground/60 transition-all">
                                <Download size={18} /> Export
                            </button>
                        </div>
                    </div>

                    {/* Candidates table */}
                    <div className="glass-card rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 gap-4 text-slate-400">
                                <Loader2 size={24} className="animate-spin" />
                                <span className="font-ui text-sm uppercase tracking-widest">Loading candidates…</span>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-20 text-center text-slate-500 font-ui text-sm uppercase tracking-widest">
                                No candidates found.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-border">
                                    <tr>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest">Candidate</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">OCEAN Radar</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Job Fit</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Prediction</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((cand, idx) => {
                                        const fit     = cand.ocean_summary?.job_fit_score ?? 0;
                                        const pred    = cand.ocean_summary?.success_prediction ?? "—";
                                        const initials = cand.candidate_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                                        const isProcessingThis = processing?.session_id === cand.session_id && processing.status === "processing";

                                        return (
                                            <motion.tr key={cand.session_id}
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="group hover:bg-primary/5 transition-colors">

                                                {/* Name */}
                                                <td className="px-8 py-6">
                                                    <Link href={`/dashboard/candidates/${cand.session_id}`} className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-100 border border-primary/10 flex items-center justify-center font-heading font-black text-primary transition-transform group-hover:scale-110">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="font-heading font-bold text-foreground text-lg leading-tight group-hover:text-primary transition-colors">{cand.candidate_name}</p>
                                                            <p className="font-ui text-xs text-slate-500 italic uppercase tracking-wider">
                                                                {new Date(cand.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </Link>
                                                </td>

                                                {/* OCEAN mini icon */}
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-center">
                                                        <div className="w-14 h-14 rounded-full border border-border p-1 bg-gray-50 group-hover:border-primary/30 transition-colors">
                                                            <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                                                                <BrainCircuit size={20} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Job Fit */}
                                                <td className="px-8 py-6 text-center">
                                                    {cand.ocean_summary ? (
                                                        <span className={`px-4 py-1 rounded-full font-heading font-bold text-sm border ${scoreColor(fit)}`}>
                                                            {fit.toFixed(1)}%
                                                        </span>
                                                    ) : isProcessingThis ? (
                                                        <span className="flex items-center justify-center gap-1.5 text-primary text-xs font-ui uppercase tracking-widest">
                                                            <Loader2 size={12} className="animate-spin" /> Running…
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs font-ui uppercase tracking-widest italic">—</span>
                                                    )}
                                                </td>

                                                {/* Prediction */}
                                                <td className="px-8 py-6 text-center">
                                                    {cand.ocean_summary ? (
                                                        <span className={`text-[10px] font-heading font-bold px-3 py-1 rounded-lg border uppercase tracking-widest
                                                            ${pred === "High"   ? "text-success border-success/20 bg-success/10"
                                                            : pred === "Medium" ? "text-warning border-warning/20 bg-warning/10"
                                                            : "text-foreground/40 border-border bg-gray-50"}`}>
                                                            {pred}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-[10px] font-ui uppercase tracking-widest italic">—</span>
                                                    )}
                                                </td>

                                                {/* Actions: view + process + delete */}
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/dashboard/candidates/${cand.session_id}`}
                                                            className="p-2 hover:bg-primary/8 rounded-lg transition-colors text-slate-500 hover:text-primary"
                                                            title="View Report">
                                                            <ChevronRight size={20} />
                                                        </Link>

                                                        {/* Process button */}
                                                        <button
                                                            onClick={() => handleProcess(cand)}
                                                            disabled={isProcessingThis || processing?.status === "processing"}
                                                            title={cand.ocean_summary ? "Re-process" : "Process Interview"}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-ui font-black uppercase tracking-widest border disabled:opacity-40 disabled:cursor-not-allowed
                                                                ${cand.ocean_summary
                                                                    ? "text-foreground/40 border-border hover:bg-gray-100 hover:text-foreground"
                                                                    : "text-primary border-primary/30 bg-primary/10 hover:bg-primary/20"}`}>
                                                            {isProcessingThis
                                                                ? <><Loader2 size={12} className="animate-spin" /> Running</>
                                                                : cand.ocean_summary
                                                                    ? <><RefreshCw size={12} /> Re-run</>
                                                                    : <><Cpu size={12} /> Process</>
                                                            }
                                                        </button>

                                                        <button
                                                            onClick={() => handleDelete(cand.session_id)}
                                                            disabled={deleting === cand.session_id}
                                                            title="Delete candidate data (media + scores)"
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-ui font-black uppercase tracking-widest border border-transparent hover:border-danger/30 hover:bg-danger/10 text-slate-600 hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed">
                                                            {deleting === cand.session_id
                                                                ? <Loader2 size={12} className="animate-spin" />
                                                                : <Trash2 size={12} />}
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ── Sidebar ────────────────────────────────────────────────── */}
                <div className="space-y-8">
                    {/* Talent funnel */}
                    <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                            <TrendingUp size={64} className="text-primary" />
                        </div>
                        <h4 className="font-heading text-xl font-bold mb-6">Talent Funnel Health</h4>
                        <div className="space-y-6">
                            {[
                                { label: "High Prediction",   value: candidates.filter(c => c.ocean_summary?.success_prediction === "High").length, total: candidates.length, color: "bg-success" },
                                { label: "With OCEAN Score",  value: candidates.filter(c => c.ocean_summary).length, total: candidates.length, color: "bg-primary" },
                                { label: "Pending Analysis",  value: candidates.filter(c => !c.ocean_summary).length, total: candidates.length, color: "bg-warning" },
                            ].map(({ label, value, total, color }) => {
                                const pct = total ? Math.round((value / total) * 100) : 0;
                                return (
                                    <div key={label}>
                                        <div className="flex justify-between mb-2">
                                            <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">{label}</p>
                                            <p className="font-heading font-bold text-sm">{value}/{total}</p>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Avg trait heatmap */}
                    <div className="glass-card p-8 rounded-3xl border border-border shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600"><PieChart size={20} /></div>
                            <h4 className="font-heading text-xl font-bold italic tracking-tight">Avg Trait Heatmap</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {(["openness", "conscientiousness", "extraversion", "agreeableness"] as const).map(trait => {
                                const vals = candidates.map(c => c.ocean_summary?.[trait]).filter(Boolean) as number[];
                                const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                                const label = avg === null ? "—" : avg >= 65 ? "HIGH" : avg >= 40 ? "MOD" : "LOW";
                                return (
                                    <div key={trait} className="p-5 rounded-2xl bg-gray-50 border border-border text-center">
                                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1 capitalize">{trait}</p>
                                        <p className={`font-heading text-2xl font-black leading-none ${label === "HIGH" ? "text-primary" : "text-foreground/60"}`}>{label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Batch process all unprocessed */}
                    {candidates.filter(c => !c.ocean_summary).length > 0 && (
                        <div className="glass-card p-6 rounded-3xl border border-warning/20 bg-warning/5">
                            <p className="font-ui text-xs text-warning uppercase tracking-widest font-black mb-3">
                                {candidates.filter(c => !c.ocean_summary).length} candidate(s) pending review
                            </p>
                            <p className="text-slate-400 text-xs font-body leading-relaxed">
                                Click the &ldquo;Process&rdquo; button next to each candidate to generate their assessment report.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
