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
        body: "Your video is recorded for each response. Keep your face clearly visible and centred in the frame throughout your answer.",
    },
    {
        icon: Eye,
        color: "text-cyan-400",
        bg: "bg-cyan-500/10 border-cyan-500/20",
        title: "Gaze monitoring is active",
        body: "Eye contact with the screen is part of the assessment. Look at the question text while you answer, as you naturally would in any face-to-face interview.",
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
        <div className="min-h-screen bg-gray-50 text-foreground flex flex-col items-center justify-start py-12 px-6 font-body overflow-y-auto">
            <div className="w-full max-w-2xl">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full mb-5">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="font-ui text-xs text-emerald-700 font-semibold">Calibration Complete</span>
                    </div>
                    <h1 className="font-heading text-2xl font-semibold mb-3">Before You Begin</h1>
                    <p className="text-foreground/50 text-sm max-w-md mx-auto leading-relaxed">
                        Read through the interview rules. The session is monitored.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                    {rules.map((rule, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 + i * 0.05 }}
                            className={`p-5 rounded-xl border ${rule.bg} bg-white shadow-sm`}>
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

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    className="bg-white border border-border rounded-xl p-5 mb-8 text-center">
                    <p className="text-foreground/60 text-xs leading-relaxed">
                        <span className="text-foreground font-semibold">Your responses are handled with full confidentiality.</span>{" "}
                        Answer naturally — there is no trick to it.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    <button onClick={handleStart}
                        className="w-full bg-primary hover:bg-primary/90 active:scale-[0.99] text-white font-ui font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                        Start Interview
                        <ChevronRight size={16} />
                    </button>
                </motion.div>
            </div>
        </div>
    );
}
