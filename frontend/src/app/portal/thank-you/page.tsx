"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// How long after "done" before auto-logout (ms)
const AUTO_LOGOUT_MS = 60_000;
// Max time to wait for processing before forcing logout (ms)
const PROCESSING_TIMEOUT_MS = 60_000;
// Status poll interval
const POLL_MS = 4_000;

type Phase = "processing" | "done";

export default function ThankYou() {
    const router            = useRouter();
    const didFireRef        = useRef(false);
    const sidRef            = useRef<string>("");
    const pollTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logoutTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

    const [phase,         setPhase]         = useState<Phase>("processing");
    const [logoutSecs,    setLogoutSecs]    = useState(AUTO_LOGOUT_MS / 1000);
    const [logoutPaused,  setLogoutPaused]  = useState(false);
    const logoutPausedRef = useRef(false);

    // Keep ref in sync so the setInterval closure can read it without stale closure
    logoutPausedRef.current = logoutPaused;

    // ── Helpers ──────────────────────────────────────────────────────────────

    const stopPolling = () => {
        if (pollTimerRef.current)  { clearInterval(pollTimerRef.current);  pollTimerRef.current  = null; }
        if (timeoutRef.current)    { clearTimeout(timeoutRef.current);     timeoutRef.current    = null; }
    };

    const forceLogout = () => {
        sessionStorage.removeItem("examiney_session");
        sessionStorage.removeItem("examiney_calibration");
        router.replace("/portal/login");
    };

    const startLogoutCountdown = () => {
        setLogoutSecs(AUTO_LOGOUT_MS / 1000);
        logoutTimerRef.current = setInterval(() => {
            if (logoutPausedRef.current) return;
            setLogoutSecs(s => {
                if (s <= 1) {
                    clearInterval(logoutTimerRef.current!);
                    forceLogout();
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    };

    const transitionToDone = (force: boolean = false) => {
        stopPolling();
        if (force) {
            forceLogout();
            return;
        }
        setPhase("done");
        startLogoutCountdown();
    };

    // ── On mount: grab session, trigger processing, start polling ─────────────
    useEffect(() => {
        if (didFireRef.current) return;
        didFireRef.current = true;

        const raw = sessionStorage.getItem("examiney_session");
        if (!raw) { router.replace("/portal/login"); return; }

        let sid: string;
        try {
            sid = (JSON.parse(raw) as { session_id?: string })?.session_id ?? "";
        } catch { router.replace("/portal/login"); return; }
        if (!sid) { router.replace("/portal/login"); return; }

        sidRef.current = sid;

        // Trigger post-session pipeline
        fetch(`${API}/session/${sid}/process`, { method: "POST" }).catch((err) => {
            console.error("[ThankYou] Failed to trigger processing:", err);
        });

        // Poll status until ready or timeout
        const poll = async () => {
            try {
                const res = await fetch(`${API}/session/${sid}/status`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.status === "ready") {
                    transitionToDone();
                }
            } catch {
                // network blip — keep polling
            }
        };

        poll(); // immediate first check
        pollTimerRef.current = setInterval(poll, POLL_MS);

        // Hard timeout — show done even if backend never reports ready
        timeoutRef.current = setTimeout(() => transitionToDone(true), PROCESSING_TIMEOUT_MS);

        return () => {
            stopPolling();
            if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center font-body text-foreground">
            <AnimatePresence mode="wait">

                {/* Processing */}
                {phase === "processing" && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="max-w-sm w-full flex flex-col items-center"
                    >
                        <div className="w-14 h-14 rounded-xl bg-white border border-border flex items-center justify-center mb-6 shadow-sm">
                            <Loader2 size={24} className="text-primary animate-spin" strokeWidth={1.5} />
                        </div>
                        <h1 className="font-heading text-xl font-semibold mb-2">Processing Your Interview</h1>
                        <p className="text-foreground/50 text-sm leading-relaxed">
                            Please keep this window open. This usually takes under a minute.
                        </p>
                    </motion.div>
                )}

                {/* Done */}
                {phase === "done" && (
                    <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-sm w-full flex flex-col items-center"
                    >
                        <motion.div
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                            className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-200 mb-6"
                        >
                            <CheckCircle2 size={28} strokeWidth={1.5} />
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="font-heading text-2xl font-semibold mb-2"
                        >
                            Interview Submitted
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-foreground/50 text-sm mb-1 leading-relaxed"
                        >
                            Your responses have been recorded successfully.
                        </motion.p>

                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-foreground/40 text-sm mb-8 leading-relaxed"
                        >
                            The hiring team will be in touch about next steps.
                        </motion.p>

                        {/* Auto-logout countdown */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="w-full mb-4 px-5 py-4 rounded-xl border border-border bg-white flex flex-col items-center gap-2.5"
                        >
                            <div className="flex items-center gap-2 text-foreground/40 text-xs">
                                <LogOut size={13} />
                                <span>
                                    {logoutPaused
                                        ? "Auto-logout paused"
                                        : `Logging out in ${logoutSecs}s`}
                                </span>
                            </div>
                            {!logoutPaused && (
                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-emerald-400 rounded-full"
                                        initial={{ width: "100%" }}
                                        animate={{ width: `${(logoutSecs / (AUTO_LOGOUT_MS / 1000)) * 100}%` }}
                                        transition={{ duration: 1, ease: "linear" }}
                                    />
                                </div>
                            )}
                            <button
                                onClick={() => setLogoutPaused(p => !p)}
                                className="text-xs text-foreground/30 hover:text-foreground/60 transition-colors"
                            >
                                {logoutPaused ? "Resume" : "Stay on this page"}
                            </button>
                        </motion.div>

                        <motion.button
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            onClick={() => {
                                sessionStorage.removeItem("examiney_session");
                                sessionStorage.removeItem("examiney_calibration");
                                router.replace("/portal/login");
                            }}
                            className="w-full px-6 py-3 bg-white hover:bg-gray-50 border border-border rounded-xl inline-flex items-center justify-center gap-2 transition-all text-sm font-ui font-medium text-foreground/60 hover:text-foreground"
                        >
                            <LogOut size={15} /> Sign Out
                        </motion.button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
