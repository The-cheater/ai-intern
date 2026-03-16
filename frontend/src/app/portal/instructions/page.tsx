"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mic, Video, Eye, Clock, ShieldAlert, ChevronRight, CheckCircle2, MousePointerClick } from "lucide-react";

const rules = [
    {
        icon: MousePointerClick,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10 border-indigo-500/20",
        title: "Questions are hidden",
        body: "Each question is hidden by default. Click \"Reveal Question\" when you are ready. Your mic and camera will start recording automatically at that moment.",
    },
    {
        icon: Clock,
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        title: "Time limit per question",
        body: "Each question has a countdown timer. Answer within the time limit — when it reaches zero the question auto-submits. Intro: 60 s · Technical: 90 s · Behavioral: 90 s · Logical: 60 s.",
    },
    {
        icon: Mic,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        title: "Speak clearly",
        body: "Recording starts the moment you reveal the question. Speak naturally and at a normal pace. A live waveform shows your audio is being captured.",
    },
    {
        icon: Video,
        color: "text-violet-400",
        bg: "bg-violet-500/10 border-violet-500/20",
        title: "Stay in frame",
        body: "Your video is recorded per question. Keep your face visible and centred. Your gaze is also tracked — look at the screen while answering.",
    },
    {
        icon: Eye,
        color: "text-cyan-400",
        bg: "bg-cyan-500/10 border-cyan-500/20",
        title: "Gaze monitoring is active",
        body: "The calibration profile from the previous step is used to track where you look during each answer. Maintain natural eye contact with the screen.",
    },
    {
        icon: ShieldAlert,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        title: "Stay full-screen",
        body: "The interview must remain in full-screen mode. Exiting full-screen triggers a warning. A second violation will lock your session.",
    },
];

export default function InstructionsPage() {
    const router = useRouter();

    const handleStart = () => {
        // Enter full-screen then go to interview
        document.documentElement.requestFullscreen().catch(() => {});
        router.push("/portal/interview");
    };

    return (
        <div className="min-h-screen bg-[#f5f1eb] text-foreground flex flex-col items-center justify-start py-16 px-6 font-body overflow-y-auto">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-primary/5 blur-[180px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-1/3 h-1/4 bg-violet-200/15 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 w-full max-w-3xl">
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                    className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full mb-6">
                        <CheckCircle2 size={16} className="text-indigo-400" />
                        <span className="font-ui text-xs text-indigo-600 uppercase tracking-widest font-bold">Calibration Complete</span>
                    </div>
                    <h1 className="font-heading text-5xl font-black italic tracking-tighter mb-4">Before You Begin</h1>
                    <p className="text-foreground/50 text-lg max-w-xl mx-auto leading-relaxed">
                        Read through the interview rules carefully. The session is monitored — take a breath, you&apos;re ready.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                    {rules.map((rule, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.07 }}
                            className={`p-6 rounded-2xl border ${rule.bg} bg-white/60 shadow-sm`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-2.5 rounded-xl ${rule.bg} border ${rule.bg.split(" ")[1]} flex-shrink-0`}>
                                    <rule.icon size={22} className={rule.color} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="font-heading font-bold text-base mb-1">{rule.title}</h3>
                                    <p className="text-foreground/55 text-sm leading-relaxed">{rule.body}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="bg-white border border-border rounded-2xl p-6 mb-10 text-center shadow-sm">
                    <p className="text-foreground/60 text-sm leading-relaxed">
                        <span className="text-foreground font-semibold">Your responses are stored securely.</span>{" "}
                        Audio and video are recorded only while a question is revealed. Transcripts are generated automatically after the session — you will not be interrupted mid-answer for analysis.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}
                    className="flex justify-center">
                    <button onClick={handleStart}
                        className="group bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-heading font-black text-base uppercase tracking-[0.15em] px-14 py-6 rounded-2xl flex items-center gap-4 transition-all shadow-[0_0_40px_rgba(99,102,241,0.3)]">
                        I&apos;m Ready — Start Interview
                        <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </motion.div>
            </div>
        </div>
    );
}
