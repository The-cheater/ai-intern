"use client";

import React from "react";
import {
    ArrowLeft,
    Search,
    Filter,
    Download,
    MoreHorizontal,
    Target,
    ChevronRight,
    TrendingUp,
    BrainCircuit,
    PieChart
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function OpeningDetail({ params }: { params: { id: string } }) {
    const candidates = [
        {
            id: "c1",
            name: "Arjun Verma",
            role: "Senior Product Designer",
            date: "Oct 12, 2024",
            score: 94,
            prob: 88,
            status: "Reviewed",
            ocean: [78, 92, 65, 88, 45],
            avatar: "AV"
        },
        {
            id: "c2",
            name: "Sarah Jenkins",
            role: "Senior Product Designer",
            date: "Oct 14, 2024",
            score: 82,
            prob: 74,
            status: "Pending Review",
            ocean: [60, 75, 80, 55, 70],
            avatar: "SJ"
        },
        {
            id: "c3",
            name: "Marcus Thorne",
            role: "Senior Product Designer",
            date: "Oct 15, 2024",
            score: 58,
            prob: 42,
            status: "Reviewed",
            ocean: [45, 55, 40, 65, 30],
            avatar: "MT"
        },
        {
            id: "c4",
            name: "Elena Rodriguez",
            role: "Senior Product Designer",
            date: "Oct 16, 2024",
            score: 89,
            prob: 81,
            status: "Pending Review",
            ocean: [85, 80, 75, 90, 85],
            avatar: "ER"
        },
    ];

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-6">
                <Link href="/dashboard" className="p-3 bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <div className="flex items-center gap-4 mb-1">
                        <h1 className="font-heading text-4xl font-bold">Senior Product Designer</h1>
                        <span className="bg-success/10 text-success text-[10px] font-heading font-black tracking-widest px-3 py-1 rounded-full uppercase border border-success/20">ACTIVE</span>
                    </div>
                    <p className="font-body text-slate-500 text-lg flex items-center gap-2">
                        ID: <span className="text-slate-200">OP-8291</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        Posted <span className="text-slate-200">12 days ago</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        <span className="text-primary font-bold">24 Total Applicants</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Table Header Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md shadow-2xl">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search candidates by name..."
                                className="w-full bg-black/30 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm font-ui outline-none focus:border-primary/50 transition-all"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl text-sm font-ui font-bold transition-all">
                                <Filter size={18} /> Filter
                            </button>
                            <button className="flex items-center gap-2 px-5 py-3 bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl text-sm font-ui font-bold transition-all">
                                <Download size={18} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="glass-card rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/80 border-b border-white/5">
                                <tr>
                                    <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest">Candidate</th>
                                    <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">OCEAN Radar</th>
                                    <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Overall Score</th>
                                    <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-5 font-ui font-black text-[10px] text-slate-500 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {candidates.map((cand, idx) => (
                                    <motion.tr
                                        key={cand.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group hover:bg-primary/5 transition-colors cursor-pointer"
                                    >
                                        <td className="px-8 py-6">
                                            <Link href={`/dashboard/candidates/${cand.id}`} className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-heading font-black text-slate-300 transition-transform group-hover:scale-110">
                                                    {cand.avatar}
                                                </div>
                                                <div>
                                                    <p className="font-heading font-bold text-slate-200 text-lg leading-tight group-hover:text-primary transition-colors">{cand.name}</p>
                                                    <p className="font-ui text-xs text-slate-500 italic uppercase tracking-wider">{cand.date}</p>
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
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className={`px-4 py-1 rounded-full font-heading font-bold text-sm border ${cand.score >= 80 ? "bg-success/10 text-success border-success/20" :
                                                        cand.score >= 60 ? "bg-warning/10 text-warning border-warning/20" :
                                                            "bg-danger/10 text-danger border-danger/20"
                                                    }`}>
                                                    {cand.score}%
                                                </span>
                                                <span className="font-ui text-[10px] text-slate-600 uppercase tracking-tighter">Prob: {cand.prob}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`text-[10px] font-heading font-bold px-3 py-1 rounded-lg border uppercase tracking-widest ${cand.status === "Reviewed" ? "text-slate-300 border-white/10 bg-white/5" : "text-primary border-primary/20 bg-primary/10 animate-pulse"
                                                }`}>
                                                {cand.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white">
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sidebar Insights */}
                <div className="space-y-8">
                    <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                            <TrendingUp size={64} className="text-primary" />
                        </div>
                        <h4 className="font-heading text-xl font-bold mb-6">Talent Funnel Health</h4>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">Success Ratio</p>
                                    <p className="font-heading font-bold text-success text-sm italic">82% PERFECT</p>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-success w-[82%]" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">Culture Congruence</p>
                                    <p className="font-heading font-bold text-primary text-sm italic">91.4% ELITE</p>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[91.4%]" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <p className="font-ui text-xs text-slate-400 uppercase tracking-widest font-black">Interview Efficiency</p>
                                    <p className="font-heading font-bold text-warning text-sm italic">LOW TURNOVER</p>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-warning w-[65%]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-950">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                                <PieChart size={20} />
                            </div>
                            <h4 className="font-heading text-xl font-bold italic tracking-tight">Trait Heatmap</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1">Openness</p>
                                <p className="font-heading text-2xl font-black text-slate-200 leading-none">HIGH</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1">Extraversion</p>
                                <p className="font-heading text-2xl font-black text-slate-200 leading-none">MOD</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1">Agreeable</p>
                                <p className="font-heading text-2xl font-black text-primary leading-none">EXTREME</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 text-center">
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest mb-1">Stability</p>
                                <p className="font-heading text-2xl font-black text-slate-200 leading-none">TOP 5%</p>
                            </div>
                        </div>

                        <button className="w-full mt-8 p-5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-heading font-black text-sm uppercase tracking-[0.2em] rounded-2xl transition-all scale-100 hover:scale-[1.02] active:scale-95">
                            Compare Insights
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
