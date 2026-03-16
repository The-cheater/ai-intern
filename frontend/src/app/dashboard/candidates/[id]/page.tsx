"use client";

import React, { useEffect, useState } from "react";
import {
    ArrowLeft, Download, CheckCircle2, AlertCircle, ShieldAlert,
    Play, Volume2, ChevronDown, Activity, Brain, Fingerprint, BarChart, Layers, Loader2, Eye
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
    BarChart as RechartsBarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Session { session_id: string; candidate_name: string; job_opening_id: string; created_at: string }

interface QuestionResponse {
    id: number;
    question_id: string;
    question_text: string;
    transcript: string;
    semantic_score: number;
    sentiment: Record<string, number>;
    combined_score: number;
    technical_score: number | null;
    communication_score: number | null;
    behavioral_score: number | null;
    engagement_score: number | null;
    authenticity_score: number | null;
    video_file_id: string | null;
    audio_file_id: string | null;
    video_url: string | null;
    audio_url: string | null;
    transcript_flagged: boolean;
}

interface GazeMetrics {
    provider: string;
    status: string;
    gaze_points_count?: number;
    zone_distribution?: Record<string, number>;
    robotic_reading?: { detected: boolean; confidence: number; reversal_rate: number; y_stdev: number };
    cheat_flags?: {
        risk_level: string;
        signals?: Record<string, unknown>;
        [key: string]: unknown;
    };
    offscreen_ratio?: number;
}

interface VideoSignal {
    question_id: string;
    gaze_zone_distribution: Record<string, number>;
    cheat_flags: Record<string, unknown>;
    emotion_distribution: Record<string, number>;
    avg_hrv_rmssd: number;
    hr_bpm: number | null;
    stress_spike_detected: boolean;
    gaze_metrics: GazeMetrics | null;
}

interface OceanReport {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    job_fit_score: number;
    success_prediction: string;
    role_recommendation: string;
}

interface FullReport {
    session: Session | null;
    question_responses: QuestionResponse[];
    video_signals: VideoSignal[];
    ocean_report: OceanReport | null;
}

const OCEAN_COLORS = ["#6C63FF","#22C55E","#F59E0B","#3B82F6","#EF4444"];
const PIE_COLORS   = ["#6C63FF","#22C55E","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#06B6D4","#F97316"];

export default function CandidateInsight({ params }: { params: { id: string } }) {
    const [report, setReport]       = useState<FullReport | null>(null);
    const [loading, setLoading]     = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [expandedQ, setExpandedQ] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/session/${params.id}/report`);
                if (res.ok) setReport(await res.json());
            } catch (e) {
                console.error("[VidyaAI][CandidateInsight]", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [params.id]);

    if (loading) return (
        <div className="flex items-center justify-center h-96 gap-4 text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="font-ui text-sm uppercase tracking-widest">Loading report…</span>
        </div>
    );

    if (!report?.session) return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-slate-500">
            <AlertCircle size={36} />
            <p className="font-ui text-sm uppercase tracking-widest">Session not found.</p>
            <Link href="/dashboard" className="text-primary underline text-sm">Back to Dashboard</Link>
        </div>
    );

    const { session, question_responses: qs, video_signals: vs, ocean_report: ocean } = report;

    // ── Chart data ─────────────────────────────────────────────────────────────
    const oceanData = ocean ? [
        { subject: "Openness",          A: ocean.openness,          fullMark: 100 },
        { subject: "Conscientiousness", A: ocean.conscientiousness, fullMark: 100 },
        { subject: "Extraversion",      A: ocean.extraversion,      fullMark: 100 },
        { subject: "Agreeableness",     A: ocean.agreeableness,     fullMark: 100 },
        { subject: "Neuroticism",       A: ocean.neuroticism,       fullMark: 100 },
    ] : [];

    const sentimentData = qs.map((q, i) => ({
        name: `Q${i + 1}`,
        score: Math.round((q.sentiment?.compound ?? 0) * 50 + 50),
    }));

    // Merge emotion distributions across all questions
    const emotionAgg: Record<string, number> = {};
    vs.forEach(v => Object.entries(v.emotion_distribution ?? {}).forEach(([k, val]) => {
        emotionAgg[k] = (emotionAgg[k] ?? 0) + val;
    }));
    const emotionTotal = Object.values(emotionAgg).reduce((a, b) => a + b, 0) || 1;
    const emotionPieData = Object.entries(emotionAgg).map(([name, val]) => ({
        name, value: Math.round((val / emotionTotal) * 100),
    }));

    const hrvData = vs.map((v, i) => ({ name: `Q${i + 1}`, hrv: v.avg_hrv_rmssd, hr: v.hr_bpm ?? 0 }));

    const predColor = ocean?.success_prediction === "High" ? "text-success"
        : ocean?.success_prediction === "Medium" ? "text-warning" : "text-danger";
    const successPct = ocean?.success_prediction === "High" ? 82
        : ocean?.success_prediction === "Medium" ? 55 : 30;

    // Aggregate gaze zone distribution from GazeFollower metrics across questions
    const gazeAgg: Record<string, number> = {};
    let gazeTotal = 0;
    vs.forEach(v => {
        const zones = v.gaze_metrics?.zone_distribution ?? v.gaze_zone_distribution ?? {};
        Object.entries(zones).forEach(([z, pct]) => {
            gazeAgg[z] = (gazeAgg[z] ?? 0) + (pct as number);
            gazeTotal += (pct as number);
        });
    });
    const gazeBarData = Object.entries(gazeAgg).map(([zone, total]) => ({
        zone, pct: Math.round((total / Math.max(vs.length, 1)) * 100),
    }));

    // Overall cheat risk (highest level across all questions)
    const riskRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
    let overallRisk = "low";
    vs.forEach(v => {
        const gfRisk = (v.gaze_metrics?.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
        const rtRisk = (v.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
        if ((riskRank[gfRisk] ?? 0) > (riskRank[overallRisk] ?? 0)) overallRisk = gfRisk;
        if ((riskRank[rtRisk] ?? 0) > (riskRank[overallRisk] ?? 0)) overallRisk = rtRisk;
    });

    const tabs = [
        { id: "overview",   label: "Overview",      icon: Brain },
        { id: "gaze",       label: "Gaze & Signals", icon: Eye },
        { id: "questions",  label: "Per-Question",  icon: BarChart },
        { id: "media",      label: "Raw Media",     icon: Layers },
    ];

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href={`/dashboard/openings/${session.job_opening_id}`}
                        className="p-3 bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="font-heading text-4xl font-bold">{session.candidate_name}</h1>
                        <p className="font-body text-slate-500 text-lg mt-1">
                            Session: <span className="text-slate-300 font-mono text-sm">{session.session_id}</span>
                            {" · "}{new Date(session.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-xs font-ui font-black uppercase tracking-widest border
                    ${overallRisk === "high" ? "bg-danger/10 text-danger border-danger/30"
                    : overallRisk === "medium" ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-success/10 text-success border-success/30"}`}>
                    Integrity: {overallRisk.toUpperCase()}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 w-fit">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-ui text-sm font-bold tracking-wide transition-all
                            ${activeTab === id ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-slate-200"}`}>
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Overview Tab ──────────────────────────────────────────────────── */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: success ring + OCEAN radar + sentiment */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {/* 6-month success ring */}
                            <div className="glass-card p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-4">
                                <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black">6-Month Success Probability</p>
                                <div className="relative w-36 h-36">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="72" cy="72" r="62" fill="transparent" stroke="#1E293B" strokeWidth="10" />
                                        <circle cx="72" cy="72" r="62" fill="transparent"
                                            stroke="#6C63FF" strokeWidth="10"
                                            strokeDasharray={`${2 * Math.PI * 62}`}
                                            strokeDashoffset={`${2 * Math.PI * 62 * (1 - successPct / 100)}`}
                                            strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="font-heading text-3xl font-black">{successPct}%</span>
                                        <span className={`font-ui text-xs font-black uppercase ${predColor}`}>{ocean?.success_prediction ?? "—"}</span>
                                    </div>
                                </div>
                                <p className="font-ui text-xs text-slate-500 text-center leading-relaxed max-w-[200px]">
                                    Job Fit: <span className="text-white font-bold">{ocean?.job_fit_score?.toFixed(1) ?? "—"}/100</span>
                                </p>
                            </div>

                            {/* OCEAN radar */}
                            <div className="glass-card p-6 rounded-3xl border border-white/10">
                                <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-4">Big Five OCEAN</p>
                                {ocean ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <RadarChart data={oceanData}>
                                            <PolarGrid stroke="#1E293B" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 10 }} />
                                            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name="OCEAN" dataKey="A" stroke="#6C63FF" fill="#6C63FF" fillOpacity={0.3} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                ) : <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Processing…</div>}
                            </div>
                        </div>

                        {/* Sentiment timeline */}
                        <div className="glass-card p-8 rounded-3xl border border-white/10">
                            <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-6">Sentiment Timeline</p>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={sentimentData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12 }} />
                                    <Line type="monotone" dataKey="score" stroke="#6C63FF" strokeWidth={2} dot={{ fill: "#6C63FF", r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Sidebar: emotion pie + score cards + recommendation */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-3xl border border-white/10">
                            <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-4">Emotion Distribution</p>
                            {emotionPieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={180}>
                                    <RechartsPieChart>
                                        <Pie data={emotionPieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} labelLine={false}
                                            label={({ name, percent }) => (percent as number) > 0.08 ? `${name} ${Math.round((percent as number) * 100)}%` : ""}>
                                            {emotionPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12 }} />
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No emotion data</div>}
                        </div>

                        {[
                            { label: "Cognitive Load Resilience", value: ocean ? Math.round(100 - ocean.neuroticism) : null, color: "text-primary" },
                            { label: "Authenticity Baseline",     value: qs.length ? Math.round(qs.reduce((a, q) => a + (q.authenticity_score ?? 5), 0) / qs.length * 10) : null, color: "text-success" },
                            { label: "Logical Efficiency",        value: qs.length ? Math.round(qs.reduce((a, q) => a + (q.technical_score ?? 5), 0) / qs.length * 10) : null, color: "text-warning" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="glass-card p-6 rounded-3xl border border-white/10">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">{label}</p>
                                <p className={`font-heading text-4xl font-black ${color}`}>{value !== null ? `${value}%` : "—"}</p>
                            </div>
                        ))}

                        {ocean?.role_recommendation && (
                            <div className="glass-card p-6 rounded-3xl border border-primary/20 bg-primary/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Brain size={16} className="text-primary" />
                                    <p className="font-ui text-xs text-primary uppercase tracking-widest font-black">AI Recommendation</p>
                                </div>
                                <p className="font-body text-slate-300 text-sm leading-relaxed">{ocean.role_recommendation}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Gaze & Signals Tab ────────────────────────────────────────────── */}
            {activeTab === "gaze" && (
                <div className="space-y-8">
                    {/* Summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: "Integrity Risk",   value: overallRisk.toUpperCase(), color: overallRisk === "high" ? "text-danger" : overallRisk === "medium" ? "text-warning" : "text-success" },
                            { label: "Avg HRV rMSSD",    value: vs.length ? `${(vs.reduce((a, v) => a + (v.avg_hrv_rmssd ?? 0), 0) / vs.length).toFixed(1)} ms` : "—", color: "text-primary" },
                            { label: "Avg Heart Rate",   value: vs.some(v => v.hr_bpm) ? `${Math.round(vs.reduce((a, v) => a + (v.hr_bpm ?? 0), 0) / vs.filter(v => v.hr_bpm).length)} bpm` : "—", color: "text-blue-400" },
                            { label: "Stress Spikes",    value: vs.filter(v => v.stress_spike_detected).length + " / " + vs.length, color: vs.some(v => v.stress_spike_detected) ? "text-warning" : "text-success" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="glass-card p-6 rounded-3xl border border-white/10">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">{label}</p>
                                <p className={`font-heading text-3xl font-black ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Gaze zone distribution bar chart */}
                        <div className="glass-card p-8 rounded-3xl border border-white/10">
                            <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-6">Avg Gaze Zone Distribution</p>
                            {gazeBarData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <RechartsBarChart data={gazeBarData} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                                        <XAxis dataKey="zone" tick={{ fill: "#64748B", fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} unit="%" />
                                        <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12 }}
                                            formatter={(v: number) => [`${v}%`, "Percentage"]} />
                                        <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                                            {gazeBarData.map((entry, i) => (
                                                <Cell key={i} fill={entry.zone === "red" ? "#EF4444" : entry.zone === "strategic" ? "#22C55E" : "#6C63FF"} />
                                            ))}
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            ) : <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No gaze data</div>}
                            <p className="text-slate-600 text-[10px] mt-4 font-ui">
                                Red = looking down (notes); Strategic = upper-center (thinking); Neutral = normal engagement
                            </p>
                        </div>

                        {/* HRV + HR area chart */}
                        <div className="glass-card p-8 rounded-3xl border border-white/10">
                            <p className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-6">HRV rMSSD &amp; Heart Rate per Question</p>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={hrvData}>
                                    <defs>
                                        <linearGradient id="hrv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} />
                                    <YAxis tick={{ fill: "#64748B", fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12 }} />
                                    <Area type="monotone" dataKey="hrv" stroke="#22C55E" fill="url(#hrv)" strokeWidth={2} name="HRV ms" />
                                    <Area type="monotone" dataKey="hr" stroke="#3B82F6" fill="url(#hr)" strokeWidth={2} name="HR bpm" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Per-question gaze analysis from GazeFollower */}
                    <div className="glass-card p-8 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <Eye size={20} className="text-primary" />
                            <h3 className="font-heading text-xl font-bold">GazeFollower Analysis — Per Question</h3>
                        </div>
                        {vs.length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-8">No video signal data recorded.</p>
                        )}
                        <div className="space-y-4">
                            {vs.map((v, i) => {
                                const gm = v.gaze_metrics;
                                const gfCheatRisk = (gm?.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
                                const rtCheatRisk = (v.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
                                const highestRisk = (riskRank[gfCheatRisk] ?? 0) >= (riskRank[rtCheatRisk] ?? 0) ? gfCheatRisk : rtCheatRisk;
                                const isHighRisk = highestRisk === "high" || highestRisk === "medium";
                                const zones = gm?.zone_distribution ?? v.gaze_zone_distribution ?? {};
                                const robotic = gm?.robotic_reading;

                                return (
                                    <div key={i} className={`rounded-2xl border p-5 ${isHighRisk ? "border-danger/30 bg-danger/5" : "border-white/5 bg-slate-900/30"}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="font-heading text-lg font-bold text-primary">Q{i + 1}</span>
                                                {isHighRisk && <ShieldAlert size={16} className="text-danger" />}
                                                {robotic?.detected && <AlertCircle size={16} className="text-warning" title="Robotic reading pattern detected" />}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-ui font-black uppercase tracking-widest border
                                                    ${highestRisk === "high" ? "bg-danger/10 text-danger border-danger/20"
                                                    : highestRisk === "medium" ? "bg-warning/10 text-warning border-warning/20"
                                                    : "bg-success/10 text-success border-success/20"}`}>
                                                    {highestRisk} risk
                                                </span>
                                                {v.stress_spike_detected && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-ui font-black uppercase tracking-widest border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                                        stress spike
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-400 font-ui">
                                                {gm?.status === "not_installed" && <span className="text-slate-600 italic">GazeFollower not installed</span>}
                                                {gm?.gaze_points_count != null && <span>{gm.gaze_points_count} gaze pts</span>}
                                                {v.hr_bpm != null && <span>{Math.round(v.hr_bpm)} bpm</span>}
                                                <span>HRV {v.avg_hrv_rmssd?.toFixed(1) ?? "—"} ms</span>
                                            </div>
                                        </div>

                                        {/* Gaze zones */}
                                        {Object.keys(zones).length > 0 && (
                                            <div className="flex gap-3 mb-4">
                                                {Object.entries(zones).map(([zone, pct]) => (
                                                    <div key={zone} className="flex-1 bg-slate-800/50 rounded-xl p-3 text-center">
                                                        <p className="font-ui text-[9px] text-slate-500 uppercase tracking-wider mb-1">{zone}</p>
                                                        <p className={`font-heading text-xl font-black
                                                            ${zone === "red" ? "text-danger"
                                                            : zone === "strategic" ? "text-success"
                                                            : "text-slate-300"}`}>
                                                            {Math.round((pct as number) * 100)}%
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Robotic reading */}
                                        {robotic && (
                                            <div className={`flex items-center gap-3 rounded-xl p-3 text-sm
                                                ${robotic.detected ? "bg-warning/10 border border-warning/20 text-warning" : "bg-slate-800/30 text-slate-400"}`}>
                                                <Activity size={14} className="flex-shrink-0" />
                                                <span className="font-ui text-xs">
                                                    Robotic reading: <strong>{robotic.detected ? "DETECTED" : "none"}</strong>
                                                    {" · "}reversal rate {(robotic.reversal_rate * 100).toFixed(1)}%
                                                    {" · "}Y-stdev {robotic.y_stdev.toFixed(3)}
                                                </span>
                                            </div>
                                        )}

                                        {/* Emotion distribution for this question */}
                                        {Object.keys(v.emotion_distribution ?? {}).length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {Object.entries(v.emotion_distribution).slice(0, 5).map(([emo, val]) => (
                                                    <span key={emo} className="px-2 py-1 bg-slate-800/50 rounded-lg text-[10px] font-ui text-slate-400">
                                                        {emo} {Math.round((val as number) * 100)}%
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Per-Question Tab ──────────────────────────────────────────────── */}
            {activeTab === "questions" && (
                <div className="space-y-4">
                    {qs.length === 0 && (
                        <p className="text-slate-500 font-ui text-sm uppercase tracking-widest text-center py-16">No question responses recorded.</p>
                    )}
                    {qs.map((q, i) => {
                        const signal = vs.find(v => v.question_id === q.question_id);
                        const isExpanded = expandedQ === i;
                        // Use GazeFollower cheat flags if available, else real-time
                        const gfRisk = (signal?.gaze_metrics?.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
                        const rtRisk = (signal?.cheat_flags as Record<string,unknown>)?.risk_level as string ?? "low";
                        const cheatRisk = (riskRank[gfRisk] ?? 0) >= (riskRank[rtRisk] ?? 0) ? gfRisk : rtRisk;
                        const hasCheatFlag = cheatRisk === "high" || cheatRisk === "medium";

                        return (
                            <div key={q.id} className={`glass-card rounded-3xl border transition-all ${hasCheatFlag ? "border-danger/30" : "border-white/5"}`}>
                                <button className="w-full px-8 py-6 flex items-center justify-between text-left"
                                    onClick={() => setExpandedQ(isExpanded ? null : i)}>
                                    <div className="flex items-center gap-4">
                                        <span className="font-heading text-xl font-bold text-primary">Q{i + 1}</span>
                                        {hasCheatFlag && <ShieldAlert size={18} className="text-danger" />}
                                        {q.transcript_flagged && <AlertCircle size={18} className="text-warning" />}
                                        <p className="font-body text-slate-200 text-base line-clamp-1 max-w-2xl">{q.question_text}</p>
                                    </div>
                                    <div className="flex items-center gap-6 ml-4 flex-shrink-0">
                                        <span className={`px-3 py-1 rounded-full font-heading font-bold text-sm border
                                            ${q.combined_score >= 7 ? "bg-success/10 text-success border-success/20"
                                            : q.combined_score >= 4 ? "bg-warning/10 text-warning border-warning/20"
                                            : "bg-danger/10 text-danger border-danger/20"}`}>
                                            {q.combined_score.toFixed(1)}/10
                                        </span>
                                        <ChevronDown size={20} className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t border-white/5">
                                            <div className="p-8 space-y-8">
                                                {/* Transcript */}
                                                <div>
                                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-3 font-black">Transcript</p>
                                                    {q.transcript_flagged && (
                                                        <div className="flex items-center gap-2 text-warning mb-3">
                                                            <AlertCircle size={14} />
                                                            <span className="font-ui text-xs">Whisper transcription unavailable — scoring based on empty response.</span>
                                                        </div>
                                                    )}
                                                    <p className="font-body text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-5 rounded-2xl border border-white/5">
                                                        {q.transcript || <span className="text-slate-600 italic">No transcript</span>}
                                                    </p>
                                                </div>

                                                {/* Score bars */}
                                                <div>
                                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-4 font-black">Dimension Scores</p>
                                                    <div className="space-y-3">
                                                        {[
                                                            { label: "Semantic",      val: q.semantic_score * 10, color: "bg-primary" },
                                                            { label: "Technical",     val: q.technical_score,     color: "bg-blue-500" },
                                                            { label: "Communication", val: q.communication_score, color: "bg-violet-500" },
                                                            { label: "Behavioral",    val: q.behavioral_score,    color: "bg-success" },
                                                            { label: "Engagement",    val: q.engagement_score,    color: "bg-warning" },
                                                            { label: "Authenticity",  val: q.authenticity_score,  color: "bg-orange-500" },
                                                        ].map(({ label, val, color }) => (
                                                            <div key={label} className="flex items-center gap-4">
                                                                <span className="font-ui text-xs text-slate-400 w-28 uppercase tracking-wide">{label}</span>
                                                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className={`h-full ${color} rounded-full`} style={{ width: `${val != null ? val * 10 : 0}%` }} />
                                                                </div>
                                                                <span className="font-heading font-bold text-sm w-10 text-right">{val != null ? val.toFixed(1) : "—"}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Cheat flag banner */}
                                                {hasCheatFlag && (
                                                    <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 rounded-2xl p-4 text-danger">
                                                        <ShieldAlert size={18} className="flex-shrink-0" />
                                                        <div>
                                                            <p className="font-ui text-xs font-black uppercase tracking-widest">
                                                                Risk Level: {cheatRisk.toUpperCase()}
                                                            </p>
                                                            <p className="font-body text-sm mt-1 opacity-80">
                                                                Suspicious gaze patterns detected during this response.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Gaze zone distribution (best available source) */}
                                                {signal && Object.keys(signal.gaze_metrics?.zone_distribution ?? signal.gaze_zone_distribution ?? {}).length > 0 && (
                                                    <div>
                                                        <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-4 font-black">
                                                            Gaze Zones {signal.gaze_metrics?.provider === "gazefollower" ? "(GazeFollower)" : "(Real-time)"}
                                                        </p>
                                                        <div className="flex gap-4">
                                                            {Object.entries(signal.gaze_metrics?.zone_distribution ?? signal.gaze_zone_distribution).map(([zone, pct]) => (
                                                                <div key={zone} className="flex-1 bg-slate-900/50 rounded-2xl p-4 text-center border border-white/5">
                                                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-2">{zone}</p>
                                                                    <p className={`font-heading text-2xl font-black
                                                                        ${zone === "red" ? "text-danger"
                                                                        : zone === "strategic" ? "text-success"
                                                                        : "text-slate-300"}`}>
                                                                        {Math.round((pct as number) * 100)}%
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Media players — use Cloudinary URLs directly */}
                                                {(q.video_url || q.audio_url) && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {q.video_url && (
                                                            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Play size={14} className="text-primary" />
                                                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest">Video Response</p>
                                                                </div>
                                                                <video src={q.video_url} controls className="w-full h-40 rounded-xl object-cover bg-black" />
                                                            </div>
                                                        )}
                                                        {q.audio_url && (
                                                            <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Volume2 size={14} className="text-primary" />
                                                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest">Audio Response</p>
                                                                </div>
                                                                <audio src={q.audio_url} controls className="w-full mt-6" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Raw Media Tab ─────────────────────────────────────────────────── */}
            {activeTab === "media" && (
                <div className="space-y-8">
                    <div className="glass-card p-8 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <Fingerprint size={20} className="text-primary" />
                            <h3 className="font-heading text-xl font-bold">All Session Media</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {qs.filter(q => q.video_url || q.audio_url).map((q, i) => (
                                <div key={q.id} className="bg-slate-900/50 rounded-2xl p-5 border border-white/5 space-y-4">
                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">
                                        Q{i + 1} — {q.question_text.slice(0, 60)}…
                                    </p>
                                    {q.video_url && (
                                        <video src={q.video_url} controls className="w-full h-44 rounded-xl object-cover bg-black" />
                                    )}
                                    {q.audio_url && (
                                        <audio src={q.audio_url} controls className="w-full" />
                                    )}
                                </div>
                            ))}
                            {qs.filter(q => q.video_url || q.audio_url).length === 0 && (
                                <p className="col-span-2 text-center text-slate-600 font-ui text-sm uppercase tracking-widest py-16">
                                    No media files uploaded yet.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
