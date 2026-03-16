"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Home, Loader2, Brain } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 40;  // ~5 min max

type Stage = "starting" | "processing" | "done" | "error";

export default function ThankYou() {
    const [sessionId, setSessionId]  = useState("");
    const [stage, setStage]          = useState<Stage>("starting");
    const [pollNote, setPollNote]    = useState("");

    const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollCountRef  = useRef(0);
    const didFireRef    = useRef(false);  // prevent React StrictMode double-fire

    useEffect(() => {
        if (didFireRef.current) return;
        didFireRef.current = true;

        const raw = sessionStorage.getItem("neurosync_session");
        if (!raw) { setStage("error"); return; }

        const parsed = JSON.parse(raw) as { session_id?: string };
        const sid = parsed?.session_id;
        if (!sid) { setStage("error"); return; }

        setSessionId(sid);
        console.log("[ThankYou] Firing background pipeline for session=", sid);

        const kickoff = async () => {
            try {
                const r = await fetch(`${API}/session/${sid}/process`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });
                console.log("[ThankYou] /process responded:", r.status);
            } catch (err) {
                console.error("[ThankYou] /process failed:", err);
            }
            setStage("processing");
            startPolling(sid);
        };
        kickoff();

        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function startPolling(sid: string) {
        console.log("[ThankYou] Starting polling for session=", sid);
        pollTimerRef.current = setInterval(async () => {
            pollCountRef.current += 1;
            try {
                const r = await fetch(`${API}/session/${sid}/status`);
                if (!r.ok) return;
                const data = await r.json();
                console.log(`[ThankYou] Poll #${pollCountRef.current}: status=${data.status}`);

                if (data.status === "ready") {
                    clearInterval(pollTimerRef.current!);
                    pollTimerRef.current = null;
                    setStage("done");
                    sessionStorage.removeItem("neurosync_session");
                } else if (data.status === "processing") {
                    const done = data.transcripts_done ?? 0;
                    const total = data.questions_total ?? "?";
                    setPollNote(`Transcripts: ${done}/${total} complete`);
                }
            } catch (err) {
                console.warn("[ThankYou] Poll error:", err);
            }

            if (pollCountRef.current >= MAX_POLLS) {
                clearInterval(pollTimerRef.current!);
                pollTimerRef.current = null;
                setStage("done");  // show done even without OCEAN — recruiter sees it in dashboard
                sessionStorage.removeItem("neurosync_session");
            }
        }, POLL_INTERVAL_MS);
    }

    return (
        <div className="min-h-screen bg-[#f5f1eb] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden font-body text-foreground">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] bg-emerald-500/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-indigo-500/5 blur-[130px] rounded-full" />
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }} className="max-w-2xl w-full relative z-10">

                {/* ── Processing ──────────────────────────────────────── */}
                {(stage === "starting" || stage === "processing") && (
                    <div className="flex flex-col items-center gap-8 py-24">
                        <div className="relative w-20 h-20">
                            <Loader2 className="w-20 h-20 text-indigo-400 animate-spin absolute" strokeWidth={1} />
                            <Brain className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-3">
                            <h2 className="font-heading text-3xl font-black text-foreground/80">
                                {stage === "starting" ? "Submitting Responses…" : "AI Analysis Running"}
                            </h2>
                            <p className="text-foreground/50 text-base">
                                {stage === "starting"
                                    ? "Your recordings are being securely uploaded."
                                    : "Transcribing audio and computing your assessment in the background."}
                            </p>
                            {pollNote && <p className="text-foreground/30 text-sm">{pollNote}</p>}
                        </div>
                        <p className="text-foreground/25 text-xs max-w-xs leading-relaxed">
                            This takes 2–5 minutes. You can safely leave this page — your recruiter will see the results shortly.
                        </p>
                    </div>
                )}

                {/* ── Done / Error ────────────────────────────────────── */}
                {(stage === "done" || stage === "error") && (
                    <>
                        <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2.5rem] flex items-center justify-center border border-emerald-500/20 mx-auto mb-12 shadow-[0_0_40px_rgba(34,197,94,0.12)]">
                            <CheckCircle2 size={48} strokeWidth={1.5} />
                        </div>

                        <h1 className="font-heading text-6xl font-black mb-6 tracking-tighter leading-tight italic">
                            Interview Complete
                        </h1>
                        <p className="text-foreground/55 text-xl italic mb-16 px-8 leading-relaxed font-black opacity-80">
                            Your responses have been submitted for AI review.<br />
                            Your recruiter will review the results and contact you shortly.
                        </p>

                        {/* Session reference — the only score-related info candidate sees */}
                        {sessionId && (
                            <div className="bg-white p-10 rounded-[2.5rem] border border-border shadow-md relative mb-12 group">
                                <div className="absolute top-0 right-0 p-4">
                                    <div className="bg-indigo-500/10 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-heading font-black tracking-widest uppercase">Verified</div>
                                </div>
                                <p className="text-foreground/40 text-xs uppercase tracking-widest mb-4 font-black italic">
                                    Secure Session Reference ID
                                </p>
                                <p className="font-heading text-3xl font-black text-foreground italic tracking-tighter transition-all group-hover:text-indigo-500">
                                    {sessionId}
                                </p>
                            </div>
                        )}

                        <Link href="/portal/login"
                            className="px-10 py-5 bg-white hover:bg-gray-50 border border-border rounded-2xl flex items-center gap-3 mx-auto w-fit transition-all font-heading font-black text-sm uppercase tracking-widest text-foreground/60 hover:text-foreground shadow-sm">
                            <Home size={18} /> Exit Portal
                        </Link>

                        <p className="mt-16 text-foreground/25 text-[10px] uppercase tracking-[0.3em] font-black italic">
                            Vidya AI &copy; 2025. All sessions are encrypted and stored for audit compliance.
                        </p>
                    </>
                )}
            </motion.div>
        </div>
    );
}
