"use client";

import React, { useState } from "react";
import {
    ArrowLeft,
    Search,
    MapPin,
    Calendar,
    Clock,
    Mail,
    Phone,
    Linkedin,
    Github,
    UserPlus,
    Download,
    CheckCircle2,
    AlertCircle,
    ShieldAlert,
    Play,
    Volume2,
    Maximize2,
    ChevronDown,
    Activity,
    Brain,
    Fingerprint,
    BarChart,
    Layers
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
    BarChart as RechartsBarChart, Bar, Cell, PieChart as RechartsPieChart, Pie
} from "recharts";

export default function CandidateInsight({ params }: { params: { id: string } }) {
    const [activeTab, setActiveTab] = useState("overview");

    // Mock Data
    const oceanData = [
        { subject: "Openness", A: 120, fullMark: 150 },
        { subject: "Conscientiousness", A: 98, fullMark: 150 },
        { subject: "Extraversion", A: 86, fullMark: 150 },
        { subject: "Agreeableness", A: 99, fullMark: 150 },
        { subject: "Neuroticism", A: 45, fullMark: 150 },
    ];

    const sentimentData = [
        { name: "Q1", score: 85 },
        { name: "Q2", score: 92 },
        { name: "Q3", score: 78 },
        { name: "Q4", score: 94 },
        { name: "Q5", score: 88 },
        { name: "Q6", score: 90 },
        { name: "Q7", score: 82 },
        { name: "Q8", score: 89 },
    ];

    const hrvData = [
        { time: "0:00", value: 65 },
        { time: "2:00", value: 68 },
        { time: "4:00", value: 72 },
        { time: "6:00", value: 64 },
        { time: "8:00", value: 60 },
        { time: "10:00", value: 75 },
        { time: "12:00", value: 82 },
        { time: "14:00", value: 78 },
    ];

    const emotions = [
        { name: "Joy", value: 45, color: "#22C55E" },
        { name: "Surprise", value: 20, color: "#6C63FF" },
        { name: "Concentration", value: 25, color: "#F59E0B" },
        { name: "Stress", value: 10, color: "#EF4444" },
    ];

    const questions = [
        {
            id: "q1",
            text: "Tell us about a time you had to lead a project under extreme pressure and vague requirements. How did you handle it?",
            ideal: "Focus on structure, communication, and clear outcome ownership.",
            transcript: "In my last role at TechCorp, we were tasked with launching a new API within 3 weeks with no prior documentation. I started by rallying the junior engineers, setting up daily syncs, and mapping out the core architecture on a single whiteboard...",
            scores: { tech: 92, comm: 88, beh: 95, eng: 85, auth: 98 },
            flags: [{ type: "Potential Plagiarism", time: "02:14", confidence: 88 }],
            ocean: ["O", "C", "S"]
        },
        {
            id: "q2",
            text: "Explain the concept of 'Event Loop' in Node.js to a 5-year old.",
            ideal: "Uses a restaurant kitchen analogy accurately.",
            transcript: "Think of a chef in a kitchen. He can only do one thing at once, but his helpers bring him chopped veggies and prepped meat so he never stops cooking...",
            scores: { tech: 78, comm: 95, beh: 82, eng: 92, auth: 90 },
            flags: [],
            ocean: ["O", "E"]
        }
    ];

    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-12 relative overflow-hidden shadow-2xl">
                {/* Background Ornaments */}
                <div className="absolute top-0 right-0 w-[50%] h-full bg-primary/5 blur-[150px] -z-10 rounded-full" />
                <div className="absolute top-10 left-10 p-4 opacity-5 pointer-events-none">
                    <Fingerprint size={300} className="text-white" />
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
                    {/* Avatar & Basic Info */}
                    <div className="flex flex-col items-center lg:items-start flex-1">
                        <div className="flex items-center gap-4 mb-8">
                            <Link href="/dashboard/openings/1" className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group">
                                <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                            </Link>
                            <span className="font-ui text-xs font-black text-primary tracking-[0.3em] uppercase opacity-70">DIGITAL TWIN V1.8</span>
                        </div>

                        <div className="flex items-center gap-8 mb-10">
                            <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary via-violet-600 to-indigo-700 p-[2px] relative group cursor-pointer shadow-violet">
                                <div className="w-full h-full rounded-[1.9rem] bg-slate-900 flex items-center justify-center font-heading font-black text-4xl text-white">AV</div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-success flex items-center justify-center border-4 border-slate-900 group-hover:scale-110 transition-transform">
                                    <CheckCircle2 size={16} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="font-heading text-6xl font-bold mb-4 tracking-tight leading-tighter">Arjun Verma</h1>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <span className="flex items-center gap-2 font-ui text-sm text-slate-400 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                        <MapPin size={14} className="text-primary" /> Bengaluru, India
                                    </span>
                                    <span className="flex items-center gap-2 font-ui text-sm text-slate-400 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                        <Calendar size={14} className="text-primary" /> Applied Oct 12, 2024
                                    </span>
                                    <span className="flex items-center gap-2 font-ui text-sm text-slate-400 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                                        <Clock size={14} className="text-primary" /> Interviewed Oct 18, 2024
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 mb-10">
                            <button className="flex items-center gap-3 px-8 py-4 bg-primary text-white font-heading font-black text-sm uppercase tracking-widest rounded-2xl shadow-violet hover:bg-primary/90 transition-all active:scale-95">
                                <UserPlus size={18} /> Offer Candidate
                            </button>
                            <button className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-heading font-black text-sm uppercase tracking-widest rounded-2xl transition-all">
                                <Download size={18} /> Profile PDF
                            </button>
                            <div className="flex gap-2">
                                <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Linkedin size={20} className="text-slate-400" /></button>
                                <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Github size={20} className="text-slate-400" /></button>
                                <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"><Mail size={20} className="text-slate-400" /></button>
                            </div>
                        </div>
                    </div>

                    {/* Success Probability Ring */}
                    <div className="w-full lg:w-96 flex flex-col items-center justify-center p-8 bg-black/40 border border-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl group cursor-default">
                        <div className="relative mb-8 pt-4">
                            <svg className="w-56 h-56 -rotate-90 group-hover:drop-shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all duration-700">
                                <circle cx="112" cy="112" r="100" fill="transparent" stroke="#1E293B" strokeWidth="12" strokeDasharray="628" strokeDashoffset="0" strokeLinecap="round" />
                                <motion.circle
                                    cx="112"
                                    cy="112"
                                    r="100"
                                    fill="transparent"
                                    stroke="#22C55E"
                                    strokeWidth="12"
                                    strokeDasharray="628"
                                    strokeDashoffset={628 * (1 - 0.88)}
                                    initial={{ strokeDashoffset: 628 }}
                                    animate={{ strokeDashoffset: 628 * (1 - 0.88) }}
                                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                                    strokeLinecap="round"
                                    className="drop-shadow-lg"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 1 }}
                                    className="font-heading text-6xl font-black text-white leading-none"
                                >
                                    88%
                                </motion.span>
                                <span className="font-ui text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-2 font-black italic">Prediction</span>
                            </div>
                        </div>
                        <h3 className="font-heading text-xl font-bold mb-2">6-Month Success Probability</h3>
                        <p className="font-body text-slate-500 text-center text-sm leading-relaxed px-4 italic">
                            Calculated using past retention data, skill gap analysis, and 2,400+ behavioral markers.
                        </p>
                    </div>
                </div>
            </section>

            {/* Main Analysis Tabs */}
            <section className="space-y-8">
                <div className="flex justify-center">
                    <div className="bg-slate-900 border border-white/10 p-1.5 rounded-[1.5rem] flex gap-2">
                        {["Overview", "Per-Question", "Raw Media"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase())}
                                className={`px-10 py-4 rounded-2xl font-heading font-black text-sm uppercase tracking-widest transition-all ${activeTab === tab.toLowerCase() ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === "overview" && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {/* OCEAN Chart */}
                            <div className="lg:col-span-2 glass-card p-10 rounded-[2rem] h-[500px] flex flex-col">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h4 className="font-heading text-2xl font-bold mb-1 tracking-tight">Big Five OCEAN Analysis</h4>
                                        <p className="font-body text-slate-500">Psychophysiological behavioral mapping</p>
                                    </div>
                                    <div className="bg-primary/10 p-3 rounded-2xl text-primary"><Brain size={24} /></div>
                                </div>
                                <div className="flex-1 w-full min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={oceanData}>
                                            <PolarGrid stroke="#334155" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: "bold" }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} stroke="#1E293B" />
                                            <Radar
                                                name="Arjun"
                                                dataKey="A"
                                                stroke="#6C63FF"
                                                fill="#6C63FF"
                                                fillOpacity={0.3}
                                                strokeWidth={3}
                                                animationDuration={2000}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Emotion Distribution */}
                            <div className="glass-card p-10 rounded-[2rem] flex flex-col">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h4 className="font-heading text-2xl font-bold mb-1 tracking-tight">Emotion Profile</h4>
                                        <p className="font-body text-slate-500">Facial micro-expression distribution</p>
                                    </div>
                                    <div className="bg-warning/10 p-3 rounded-2xl text-warning"><Volume2 size={24} /></div>
                                </div>
                                <div className="flex-1 w-full flex items-center justify-center">
                                    <div className="relative w-full aspect-square max-w-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPieChart>
                                                <Pie
                                                    data={emotions}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={100}
                                                    paddingAngle={8}
                                                    dataKey="value"
                                                    cornerRadius={12}
                                                    animationBegin={200}
                                                    animationDuration={2500}
                                                >
                                                    {emotions.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ background: "#0F1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                                                    itemStyle={{ color: "#fff" }}
                                                />
                                            </RechartsPieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="font-heading text-4xl font-bold text-success">POS</span>
                                            <span className="font-ui text-[10px] text-slate-500 uppercase font-black uppercase tracking-widest">Sentiment</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    {emotions.map(e => (
                                        <div key={e.name} className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                                            <span className="font-ui text-xs text-slate-400 font-bold">{e.name} <span className="text-white ml-2">{e.value}%</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sentiment Timeline */}
                            <div className="lg:col-span-2 glass-card p-10 rounded-[2rem] h-[400px]">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h4 className="font-heading text-2xl font-bold mb-1 tracking-tight">Sentiment Persistence</h4>
                                        <p className="font-body text-slate-500">Stability of confidence throughout the assessment</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-10 bg-primary/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[88%]" />
                                        </div>
                                        <span className="text-primary font-heading font-black text-sm italic">88% FLOW</span>
                                    </div>
                                </div>
                                <div className="w-full h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sentimentData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                            <XAxis dataKey="name" stroke="#64748B" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold" }} />
                                            <YAxis domain={[0, 100]} hide />
                                            <Tooltip contentStyle={{ background: "#0F1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#6C63FF"
                                                strokeWidth={4}
                                                dot={{ r: 6, fill: "#6C63FF", strokeWidth: 4, stroke: "#0F1117" }}
                                                activeDot={{ r: 8, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* HRV & Resilience */}
                            <div className="glass-card p-10 rounded-[2rem] h-[400px]">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h4 className="font-heading text-2xl font-bold mb-1 tracking-tight">Resilience Load</h4>
                                        <p className="font-body text-slate-500">Bio-feedback stability (HRV)</p>
                                    </div>
                                    <Activity className="text-danger animate-pulse" />
                                </div>
                                <div className="w-full h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={hrvData}>
                                            <defs>
                                                <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#EF4444"
                                                fillOpacity={1}
                                                fill="url(#colorHrv)"
                                                strokeWidth={3}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Score Grid */}
                            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="glass-card p-8 rounded-[2rem] text-center bg-gradient-to-b from-slate-900 to-slate-950">
                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-3 font-black">Cognitive Resilience</p>
                                    <Brain size={24} className="mx-auto mb-4 text-primary" />
                                    <p className="font-heading text-4xl font-black text-white italic">92/100</p>
                                </div>
                                <div className="glass-card p-8 rounded-[2rem] text-center bg-gradient-to-b from-slate-900 to-slate-950">
                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-3 font-black">Authenticity Baseline</p>
                                    <Fingerprint size={24} className="mx-auto mb-4 text-success" />
                                    <p className="font-heading text-4xl font-black text-white italic">0.98 <span className="text-xs">HIGH</span></p>
                                </div>
                                <div className="glass-card p-8 rounded-[2rem] text-center bg-gradient-to-b from-slate-900 to-slate-950">
                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-3 font-black">Logical Efficiency</p>
                                    <Activity size={24} className="mx-auto mb-4 text-warning" />
                                    <p className="font-heading text-4xl font-black text-white italic">84% <span className="text-xs">CURVE</span></p>
                                </div>
                                <div className="glass-card p-8 rounded-[2rem] text-center bg-gradient-to-b from-slate-900 to-slate-950">
                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-3 font-black">Communication Clarity</p>
                                    <Volume2 size={24} className="mx-auto mb-4 text-indigo-400" />
                                    <p className="font-heading text-4xl font-black text-white italic">EXCELLENT</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "per-question" && (
                        <motion.div
                            key="per-question"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {questions.map((q, idx) => (
                                <motion.div
                                    key={q.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="glass-card rounded-[2rem] overflow-hidden group border border-white/5 hover:border-primary/20 transition-all"
                                >
                                    {/* Header Section */}
                                    <div className="p-8 flex flex-col lg:flex-row gap-8 items-start">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center font-heading font-black text-2xl text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <h4 className="font-heading text-2xl font-bold tracking-tight leading-tight group-hover:text-primary transition-colors">{q.text}</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {q.ocean.map(trait => (
                                                    <span key={trait} className="px-3 py-1 rounded-full bg-slate-800 text-[10px] font-heading font-black text-slate-400 border border-white/5">{trait === "O" ? "OPENNESS" : trait === "C" ? "CONSCIENTIOUSNESS" : trait === "E" ? "EXTRAVERSION" : trait === "S" ? "STABILITY" : trait}</span>
                                                ))}
                                            </div>
                                            {q.flags.length > 0 && (
                                                <div className="flex items-center gap-3 px-6 py-3 bg-danger/10 border border-danger/20 rounded-xl text-danger font-ui text-sm font-bold animate-pulse">
                                                    <ShieldAlert size={18} /> ALERT: {q.flags[0].type} detected at {q.flags[0].time} (Conf: {q.flags[0].confidence}%)
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 rounded-full bg-success/10 text-success border border-success/20">
                                                <CheckCircle2 size={32} />
                                            </div>
                                            <span className="font-heading text-sm font-black italic tracking-widest text-success">TRUSTED</span>
                                        </div>
                                    </div>

                                    {/* Expanded Content Section */}
                                    <div className="border-t border-white/5 bg-slate-950/40 p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        <div className="space-y-10">
                                            <div>
                                                <label className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-3 block opacity-60">Ideal Response Pathway</label>
                                                <div className="p-5 border-l-4 border-success/40 bg-success/5 rounded-r-2xl font-body text-slate-400 italic">
                                                    "{q.ideal}"
                                                </div>
                                            </div>
                                            <div>
                                                <label className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-3 block opacity-60">Transcript Segment</label>
                                                <div className="p-6 bg-black/40 rounded-2xl font-body text-white leading-relaxed tracking-wide text-lg relative group">
                                                    <div className="absolute top-4 right-4 text-slate-500"><Volume2 size={16} /></div>
                                                    {q.transcript}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <label className="font-ui text-xs text-slate-500 uppercase tracking-widest font-black mb-2 block opacity-60">Question Metrics</label>
                                                <div className="space-y-4">
                                                    {[
                                                        { label: "Technical Depth", value: q.scores.tech, color: "bg-primary" },
                                                        { label: "Communication Flow", value: q.scores.comm, color: "bg-success" },
                                                        { label: "Behavioral Alignment", value: q.scores.beh, color: "bg-warning" },
                                                        { label: "Eye Engagement", value: q.scores.eng, color: "bg-indigo-400" },
                                                        { label: "Authenticity", value: q.scores.auth, color: "bg-danger" }
                                                    ].map(m => (
                                                        <div key={m.label} className="space-y-1.5">
                                                            <div className="flex justify-between font-ui text-[10px] uppercase font-bold tracking-widest">
                                                                <span>{m.label}</span>
                                                                <span className="text-white">{m.value}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                <div className={`h-full ${m.color}`} style={{ width: `${m.value}%` }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-10 flex flex-col">
                                            <div className="flex-1 bg-slate-900 rounded-3xl overflow-hidden relative border border-white/10 group/player shadow-2xl">
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover/player:opacity-100 transition-opacity z-10" />
                                                <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover/player:opacity-100 transition-all scale-90 group-hover/player:scale-100 text-white">
                                                    <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-violet hover:bg-primary/90 cursor-pointer">
                                                        <Play size={40} className="fill-white translate-x-1" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-6 left-8 right-8 z-10 opacity-0 group-hover/player:opacity-100 transition-all translate-y-2 group-hover/player:translate-y-0 text-white">
                                                    <div className="flex items-center justify-between mb-2 font-mono text-xs font-black tracking-widest italic uppercase">
                                                        <span>00:42 / 02:15</span>
                                                        <div className="flex gap-4">
                                                            <button><Volume2 size={16} /></button>
                                                            <button><Maximize2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                        <div className="w-[30%] h-full bg-primary" />
                                                    </div>
                                                </div>
                                                {/* Mock Gray Placeholder */}
                                                <div className="w-full h-full bg-slate-800 animate-pulse flex items-center justify-center">
                                                    <Brain size={120} className="text-slate-700 opacity-20" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 text-center transition-all hover:bg-slate-900">
                                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">Gaze Distribution</p>
                                                    <div className="w-24 h-24 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center relative">
                                                        <Search size={32} className="text-primary opacity-40" />
                                                        <div className="absolute inset-2 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
                                                    </div>
                                                    <p className="font-heading text-lg font-black text-slate-200">85% SCREEN FOCUS</p>
                                                </div>
                                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 text-center transition-all hover:bg-slate-900">
                                                    <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">Micro-Expression Heatmap</p>
                                                    <div className="w-24 h-24 mx-auto mb-3 bg-violet-500/10 rounded-full flex items-center justify-center relative overflow-hidden">
                                                        <motion.div
                                                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                                            transition={{ duration: 3, repeat: Infinity }}
                                                            className="absolute inset-0 bg-violet-400 blur-xl opacity-30"
                                                        />
                                                        <Fingerprint size={32} className="text-violet-400 opacity-60 relative z-10" />
                                                    </div>
                                                    <p className="font-heading text-lg font-black text-slate-200">CONCENTRATED</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === "raw media" && (
                        <motion.div
                            key="raw-media"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-8"
                        >
                            <div className="glass-card rounded-[3rem] overflow-hidden border border-white/5 shadow-22xl relative aspect-video bg-black/80 group/main-player">
                                {/* Main UI controls */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 z-10 group-hover/main-player:opacity-100 transition-opacity" />
                                <div className="absolute bottom-10 left-10 right-10 z-20 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <button className="p-4 bg-primary rounded-full hover:bg-primary/90 transition-all shadow-violet-active"><Play size={28} className="fill-white" /></button>
                                            <div className="text-white">
                                                <p className="font-heading text-xl font-bold">Astra Deep-Link Recording</p>
                                                <p className="font-ui text-sm text-slate-400 italic">Segment: Final Behavioral Assessment (12:45)</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 text-white font-mono text-xl font-black italic">
                                            04:15 / 18:22
                                        </div>
                                    </div>

                                    <div className="relative h-4 group cursor-pointer">
                                        <div className="absolute inset-0 bg-white/10 rounded-full" />
                                        <div className="absolute inset-0 bg-primary/40 rounded-full w-[35%]" />
                                        <div className="absolute top-1/2 -translate-y-1/2 left-[35%] w-6 h-6 bg-white rounded-full shadow-2xl ring-4 ring-primary/20 scale-0 group-hover:scale-100 transition-all" />

                                        {/* Flag markers */}
                                        <div className="absolute top-0 left-[12%] w-1.5 h-full bg-danger shadow-[0_0_10px_rgba(239,68,68,0.8)] rounded-full group-hover:h-8 group-hover:-translate-y-2 transition-all" />
                                        <div className="absolute top-0 left-[24%] w-1.5 h-full bg-danger shadow-[0_0_10px_rgba(239,68,68,0.8)] rounded-full group-hover:h-8 group-hover:-translate-y-2 transition-all" />
                                        <div className="absolute top-0 left-[45%] w-1.5 h-full bg-warning shadow-[0_0_10px_rgba(245,158,11,0.8)] rounded-full group-hover:h-8 group-hover:-translate-y-2 transition-all" />
                                        <div className="absolute top-0 left-[78%] w-1.5 h-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.8)] rounded-full group-hover:h-8 group-hover:-translate-y-2 transition-all" />
                                    </div>

                                    <div className="flex gap-4 overflow-x-auto pb-4 mask-linear-fade">
                                        {["Facial Tracking active", "OCR Text Match: +88%", "Voice Polarity Shift", "Cheat Detection Hook 1-4"].map(tag => (
                                            <span key={tag} className="px-5 py-2.5 rounded-full bg-white/5 border border-white/5 text-white font-ui text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{tag}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-full h-full flex items-center justify-center">
                                    <Activity size={180} className="text-white/5 animate-pulse" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                <div className="glass-card p-8 rounded-3xl border border-white/5 bg-slate-900/40 col-span-1">
                                    <h5 className="font-heading text-lg font-bold mb-6 italic tracking-tight underline underline-offset-8 decoration-primary/30">Session Markers</h5>
                                    <div className="space-y-4">
                                        {[
                                            { time: "02:14", type: "Plagiarism Alert", color: "text-danger" },
                                            { time: "05:42", type: "Stress Spike Detected", color: "text-warning" },
                                            { time: "08:11", type: "Key Skill Confirmed", color: "text-success" },
                                            { time: "12:30", type: "High Enthusiasm Zone", color: "text-primary" }
                                        ].map(m => (
                                            <div key={m.time} className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-white/5 group cursor-pointer hover:border-white/20 transition-all">
                                                <span className="font-mono text-xs font-black text-slate-500">{m.time}</span>
                                                <span className={`font-ui text-[10px] font-black uppercase tracking-widest ${m.color}`}>{m.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="lg:col-span-3 glass-card p-10 rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-slate-900 to-black/90">
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-3xl"><Layers size={24} /></div>
                                        <div>
                                            <h5 className="font-heading text-2xl font-bold tracking-tight">AI Observation Log</h5>
                                            <p className="font-body text-slate-500 italic">Real-time inference engine summaries</p>
                                        </div>
                                    </div>
                                    <div className="space-y-8 font-body text-slate-400 leading-relaxed text-lg">
                                        <p className="pl-6 border-l-2 border-primary/20">The candidate shows exceptionally high adaptability markers in the first quadrant. Eye tracking indicates consistent engagement with the virtual interviewer, while vocal pitch remains stable during complex technical explanation phases.</p>
                                        <p className="pl-6 border-l-2 border-danger/20">A potential inconsistency was flagged during Question 4 regarding Python async patterns, where the gaze shifted significantly to the upper-right corner and response lag increased by 1.4s.</p>
                                        <p className="pl-6 border-l-2 border-success/20">Overall, Arjun demonstrated high leadership potential as evidenced by his use of inclusive language ("we", "team", "collaborate") and proactive problem-solving frameworks during the behavioral simulation.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>
        </div>
    );
}
