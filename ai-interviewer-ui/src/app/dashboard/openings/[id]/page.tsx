"use client";

import React, { useEffect, useState } from "react";
import {
    ArrowLeft, Search, Filter, Download, MoreHorizontal,
    Target, ChevronRight, TrendingUp, BrainCircuit, PieChart, Trash2, Loader2
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface OceanSummary { job_fit_score: number; success_prediction: string; openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
interface Candidate { session_id: string; candidate_name: string; job_opening_id: string; login_id?: string; created_at: string; ocean_summary: OceanSummary | null }

export default function OpeningDetail({ params }: { params: { id: string } }) {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState("");
    const [deleting, setDeleting]     = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/opening/${params.id}/candidates`);
                if (res.ok) setCandidates(await res.json());
            } catch (e) {
                console.error("[NeuroSync][OpeningDetail]", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [params.id]);

    const handleDelete = async (sessionId: string) => {
        if (!confirm("Delete this candidate session and all associated media?")) return;
        setDeleting(sessionId);
        try {
            await fetch(`${API}/session/${sessionId}`, { method: "DELETE" });
            setCandidates(prev => prev.filter(c => c.session_id !== sessionId));
        } catch (e) {
            console.error("[NeuroSync][Delete]", e);
            alert("Delete failed — please try again.");
        } finally {
            setDeleting(null);
        }
    };

    const filtered = candidates.filter(c =>
        c.candidate_name.toLowerCase().includes(search.toLowerCase())
    );

    const scoreColor = (score: number) =>
        score >= 70 ? "bg-success/10 text-success border-success/20"
        : score >= 50 ? "bg-warning/10 text-warning border-warning/20"
        : "bg-danger/10 text-danger border-danger/20";

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-6">
                <Link href="/dashboard" className="p-3 bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <div className="flex items-center gap-4 mb-1">
                        <h1 className="font-heading text-4xl font-bold">Opening {params.id}</h1>
                        <span className="bg-success/10 text-success text-[10px] font-heading font-black tracking-widest px-3 py-1 rounded-full uppercase border border-success/20">ACTIVE</span>
                    </div>
                    <p className="font-body text-slate-500 text-lg flex items-center gap-2">
                        ID: <span className="text-slate-200">{params.id}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        <span className="text-primary font-bold">{candidates.length} Total Applicants</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md shadow-2xl">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="text" placeholder="Search candidates by name…" value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm font-ui outline-none focus:border-primary/50 transition-all" />
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl text-sm font-ui font-bold transition-all">
                                <Filter size={18} /> Filter
                            </button>
                            <button className="flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl text-sm font-ui font-bold transition-all">
                                <Download size={18} /> Export
                            </button>
                        </div>
                    </div>

                    {/* Table */}
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
                                <thead className="bg-slate-900/80 border-b border-white/5">
                                    <tr>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest">Candidate</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">OCEAN Radar</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Job Fit</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Prediction</th>
                                        <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filtered.map((cand, idx) => {
                                        const fit = cand.ocean_summary?.job_fit_score ?? 0;
                                        const pred = cand.ocean_summary?.success_prediction ?? "—";
                                        const initials = cand.candidate_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                                        return (
                                            <motion.tr key={cand.session_id}
                                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="group hover:bg-primary/5 transition-colors cursor-pointer">
                                                <td className="px-8 py-6">
                                                    <Link href={`/dashboard/candidates/${cand.session_id}`} className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-heading font-black text-slate-300 transition-transform group-hover:scale-110">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="font-heading font-bold text-slate-200 text-lg leading-tight group-hover:text-primary transition-colors">{cand.candidate_name}</p>
                                                            <p className="font-ui text-xs text-slate-500 italic uppercase tracking-wider">
                                                                {new Date(cand.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-center">
                                                        <div className="w-14 h-14 rounded-full border border-white/10 p-1 bg-slate-900/50 group-hover:border-primary/30 transition-colors">
                                                            <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                                                                <BrainCircuit size={20} className="text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`px-4 py-1 rounded-full font-heading font-bold text-sm border ${scoreColor(fit)}`}>
                                                        {fit ? `${fit.toFixed(1)}%` : "—"}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`text-[10px] font-heading font-bold px-3 py-1 rounded-lg border uppercase tracking-widest ${pred === "High" ? "text-success border-success/20 bg-success/10" : pred === "Medium" ? "text-warning border-warning/20 bg-warning/10" : "text-slate-400 border-white/10 bg-white/5"}`}>
                                                        {pred}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/dashboard/candidates/${cand.session_id}`}
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white">
                                                            <ChevronRight size={20} />
                                                        </Link>
                                                        <button onClick={() => handleDelete(cand.session_id)} disabled={deleting === cand.session_id}
                                                            className="p-2 hover:bg-danger/20 rounded-lg transition-colors text-slate-600 hover:text-danger disabled:opacity-40">
                                                            {deleting === cand.session_id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
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

                {/* Sidebar */}
                <div className="space-y-8">
                    <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                            <TrendingUp size={64} className="text-primary" />
                        </div>
                        <h4 className="font-heading text-xl font-bold mb-6">Talent Funnel Health</h4>
                        <div className="space-y-6">
                            {[
                                { label: "High Prediction", value: candidates.filter(c => c.ocean_summary?.success_prediction === "High").length, total: candidates.length, color: "bg-success" },
                                { label: "With OCEAN Score", value: candidates.filter(c => c.ocean_summary).length, total: candidates.length, color: "bg-primary" },
                            ].map(({ label, value, total, color }) => {
                                const pct = total ? Math.round((value / total) * 100) : 0;
                                return (
                                    <div key={label}>
                                        <div className="flex justify-between mb-2">
                                            <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">{label}</p>
                                            <p className="font-heading font-bold text-sm">{value}/{total}</p>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-950">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400"><PieChart size={20} /></div>
                            <h4 className="font-heading text-xl font-bold italic tracking-tight">Avg Trait Heatmap</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {(["openness", "conscientiousness", "extraversion", "agreeableness"] as const).map(trait => {
                                const vals = candidates.map(c => c.ocean_summary?.[trait]).filter(Boolean) as number[];
                                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                                const label = avg === null ? "—" : avg >= 65 ? "HIGH" : avg >= 40 ? "MOD" : "LOW";
                                return (
                                    <div key={trait} className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1 capitalize">{trait}</p>
                                        <p className={`font-heading text-2xl font-black leading-none ${label === "HIGH" ? "text-primary" : "text-slate-200"}`}>{label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
