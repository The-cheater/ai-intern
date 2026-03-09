"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    FileUp,
    Briefcase,
    ChevronRight,
    ArrowRight,
    Users,
    Target,
    Activity,
    Copy,
    Check,
    Zap,
    Loader2,
    X
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState(1); // 1: Form, 2: Loading, 3: Link Generated
    const [activeTab, setActiveTab] = useState("resume"); // "resume" or "jd"

    const openings = [
        { id: "1", title: "Senior Product Designer", candidates: 24, avgScore: 82, status: "Active" },
        { id: "2", title: "Fullstack Engineer (Go/Next)", candidates: 12, avgScore: 78, status: "Active" },
        { id: "3", title: "Technical Product Manager", candidates: 8, avgScore: 91, status: "Reviewing" },
        { id: "4", title: "Marketing Director", candidates: 45, avgScore: 65, status: "Closed" },
    ];

    const handleGenerate = () => {
        setStep(2);
        setTimeout(() => setStep(3), 3000); // Simulate backend parsing
    };

    return (
        <div className="space-y-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-4xl font-bold">Active Openings</h1>
                    <p className="font-body text-slate-500 mt-2 text-lg italic">Select an opening to view candidate insights.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-heading font-bold px-6 py-4 rounded-xl shadow-violet transition-all group scale-100 hover:scale-105 active:scale-95"
                >
                    <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                    Create New Opening
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {openings.map((job) => (
                    <Link key={job.id} href={`/dashboard/openings/${job.id}`}>
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="glass-card p-6 rounded-card border border-white/5 hover:border-primary/30 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                    <Briefcase size={24} />
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-ui font-bold uppercase tracking-widest ${job.status === "Closed" ? "bg-slate-800 text-slate-500" : "bg-success/10 text-success"
                                    }`}>
                                    {job.status}
                                </span>
                            </div>

                            <h3 className="font-heading text-xl font-bold mb-4 line-clamp-1">{job.title}</h3>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Candidates</p>
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-slate-400" />
                                        <span className="font-heading text-lg font-bold">{job.candidates}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-ui text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Score</p>
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-slate-400" />
                                        <span className={`font-heading text-lg font-bold ${job.avgScore > 80 ? "text-success" : job.avgScore > 60 ? "text-warning" : "text-danger"
                                            }`}>{job.avgScore}%</span>
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

            {/* Stats Summary Section */}
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

            {/* Full Page Creation Overlay */}
            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 sm:p-20 overflow-y-auto"
                    >
                        <button
                            onClick={() => { setIsCreating(false); setStep(1); }}
                            className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
                        >
                            <X size={32} />
                        </button>

                        <div className="w-full max-w-4xl mx-auto">
                            <div className="text-center mb-12">
                                <span className="font-ui text-primary uppercase tracking-[0.3em] font-bold text-xs mb-4 block">Engine V2.0</span>
                                <h2 className="font-heading text-5xl font-bold mb-4">Initialize AI Interview Pipeline</h2>
                                <p className="font-body text-slate-400 text-lg max-w-2xl mx-auto font-italic leading-relaxed flex items-center justify-center gap-4 italic opacity-80 before:content-['—'] after:content-['—'] before:mr-2 after:ml-2">
                                    Scan resume & JD to generate a precision-tuned behavioral assessment
                                </p>
                            </div>

                            {step === 1 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-8"
                                >
                                    <div className="flex bg-slate-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 max-w-lg mx-auto mb-10 overflow-hidden shadow-2xl">
                                        <button
                                            onClick={() => setActiveTab("resume")}
                                            className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-heading font-medium tracking-wide ${activeTab === "resume" ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-slate-200"}`}
                                        >
                                            <FileUp size={20} className={activeTab === "resume" ? "animate-bounce" : ""} />
                                            Upload Resume
                                        </button>
                                        <button
                                            onClick={() => setActiveTab("jd")}
                                            className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-heading font-medium tracking-wide ${activeTab === "jd" ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-slate-200"}`}
                                        >
                                            <Briefcase size={20} className={activeTab === "jd" ? "animate-pulse" : ""} />
                                            Paste JD
                                        </button>
                                    </div>

                                    {activeTab === "resume" ? (
                                        <div className="group relative">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                            <div className="relative border-2 border-dashed border-white/10 rounded-[2rem] p-24 text-center cursor-pointer hover:border-primary/50 transition-all bg-slate-900/40 backdrop-blur-xl group shadow-2xl">
                                                <div className="bg-primary/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
                                                    <FileUp className="text-primary" size={48} />
                                                </div>
                                                <h4 className="font-heading text-3xl font-bold mb-4">Select PDF Document</h4>
                                                <p className="font-body text-slate-500 text-lg mb-8 max-w-sm mx-auto">Drag and drop the candidate's resume here, or <span className="text-primary font-bold decoration-dotted underline underline-offset-4">browse files</span></p>
                                                <div className="flex items-center justify-center gap-4">
                                                    <span className="px-5 py-2.5 rounded-full border border-white/5 bg-slate-100/5 text-slate-400 text-sm font-ui uppercase font-bold tracking-widest">MAX 10MB</span>
                                                    <span className="px-5 py-2.5 rounded-full border border-white/5 bg-slate-100/5 text-slate-400 text-sm font-ui uppercase font-bold tracking-widest">PDF ONLY</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group relative">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-primary/20 rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                            <textarea
                                                placeholder="Paste the Job Description here. Include responsibilities, qualifications, and core technical requirements..."
                                                className="relative w-full h-80 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-xl font-body outline-none focus:border-primary/50 transition-all placeholder:text-slate-700 leading-relaxed shadow-2xl resize-none"
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-center mt-12">
                                        <button
                                            onClick={handleGenerate}
                                            className="group relative px-12 py-6 bg-primary text-white font-heading text-xl font-bold rounded-2xl shadow-2xl overflow-hidden hover:shadow-violet-active transition-all"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                            <div className="flex items-center gap-4 relative z-10">
                                                Generate AI Interview Link
                                                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                                            </div>
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center py-24"
                                >
                                    <div className="relative mb-12">
                                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                                        <Loader2 className="w-24 h-24 text-primary animate-spin relative z-10" strokeWidth={1} />
                                    </div>
                                    <h3 className="font-heading text-4xl font-bold mb-4 tracking-tight">Architecting the Assessment</h3>
                                    <p className="font-body text-slate-400 text-center max-w-lg mb-12 text-lg">
                                        Our AI is currently parsing the resume data, matching skill sets against the JD, and generating 20 custom behavioral questions...
                                    </p>

                                    <div className="w-96 h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                        <motion.div
                                            initial={{ width: "0%" }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 3 }}
                                            className="absolute left-0 top-0 h-full bg-primary shadow-violet"
                                        />
                                    </div>
                                    <div className="mt-6 flex gap-8">
                                        <div className="flex items-center gap-2 text-primary font-ui text-sm uppercase font-bold tracking-widest"><Check size={16} /> Parsing PDF</div>
                                        <div className="flex items-center gap-2 text-primary font-ui text-sm uppercase font-bold tracking-widest"><Check size={16} /> Extraction</div>
                                        <div className="flex items-center gap-2 text-slate-500 font-ui text-sm uppercase font-bold tracking-widest animate-pulse">Generating Prompts</div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="max-w-2xl mx-auto"
                                >
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
                                                <label className="font-ui text-xs text-slate-400 uppercase tracking-widest mb-3 block opacity-70">Shareable Interview Link</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-primary text-lg overflow-hidden whitespace-nowrap mask-linear-fade">
                                                        https://astra.ai/portal/v/XJ9-LW28
                                                    </div>
                                                    <button className="bg-white/5 hover:bg-white/10 p-5 rounded-2xl transition-all group active:scale-95 border border-white/5">
                                                        <Copy className="text-slate-400 group-hover:text-white transition-colors" size={24} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="bg-slate-950/50 p-8 rounded-3xl border border-white/5 relative group">
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <label className="font-ui text-xs text-slate-500 uppercase tracking-widest mb-6 block relative z-10">Candidate Login Credentials</label>
                                                <div className="grid grid-cols-2 gap-8 relative z-10">
                                                    <div>
                                                        <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">LOGIN ID</p>
                                                        <p className="font-heading text-2xl font-bold text-slate-200">CAND_8291</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-ui text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-black">PASSWORD</p>
                                                        <p className="font-heading text-2xl font-bold text-slate-200 tracking-tighter">ASTRA-X2</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => { setIsCreating(false); setStep(1); }}
                                            className="w-full mt-10 p-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-heading font-bold rounded-2xl transition-all"
                                        >
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
