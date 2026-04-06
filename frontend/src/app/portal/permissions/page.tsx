"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Camera,
    Mic,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type PermState = "idle" | "granted" | "denied";

export default function PermissionGate() {
    const [cameraState, setCameraState] = useState<PermState>("idle");
    const [micState,    setMicState]    = useState<PermState>("idle");
    const [errorMsg,    setErrorMsg]    = useState<string>("");
    const router = useRouter();

    // Request real camera + mic permissions on mount
    useEffect(() => {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setCameraState("granted");
                setMicState("granted");
                // Stop the test stream immediately — interview page will open its own
                stream.getTracks().forEach(t => t.stop());
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
                    setCameraState("denied");
                    setMicState("denied");
                    setErrorMsg("Camera and microphone access were denied. Please allow access in your browser settings and reload.");
                } else {
                    setCameraState("denied");
                    setMicState("denied");
                    setErrorMsg(`Device error: ${msg}`);
                }
            }
        })();
    }, []);

    const isReady = cameraState === "granted" && micState === "granted";

    const handleStart = () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {
                console.error("Fullscreen error:", e);
            });
        }
        router.push("/portal/calibration");
    };

    const StateIcon = ({ state }: { state: PermState }) => {
        if (state === "granted") return <CheckCircle2 size={32} className="text-emerald-400" />;
        if (state === "denied")  return <XCircle      size={32} className="text-danger" />;
        return <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="text-center mb-10">
                    <h1 className="font-heading text-2xl font-semibold mb-2">Check Permissions</h1>
                    <p className="font-body text-foreground/50 text-sm">
                        Grant camera and microphone access to proceed.
                    </p>
                </div>

                <AnimatePresence>
                    {errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 bg-danger/10 border border-danger/30 text-danger px-6 py-4 rounded-2xl mb-8"
                        >
                            <AlertTriangle size={20} className="flex-shrink-0" />
                            <p className="font-ui text-sm font-bold">{errorMsg}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {/* Camera */}
                    <div className={`p-6 rounded-xl border transition-all ${
                        cameraState === "granted" ? "bg-emerald-50 border-emerald-200"
                        : cameraState === "denied" ? "bg-red-50 border-red-200"
                        : "bg-white border-border"
                    }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2.5 rounded-lg ${
                                cameraState === "granted" ? "bg-emerald-100 text-emerald-600"
                                : cameraState === "denied" ? "bg-red-100 text-red-500"
                                : "bg-gray-100 text-foreground/40"
                            }`}>
                                <Camera size={20} strokeWidth={1.5} />
                            </div>
                            <StateIcon state={cameraState} />
                        </div>
                        <h3 className="font-heading text-base font-semibold mb-1">Camera</h3>
                        <p className="font-body text-foreground/50 text-xs leading-relaxed">
                            Required to record your video interview.
                        </p>
                    </div>

                    {/* Microphone */}
                    <div className={`p-6 rounded-xl border transition-all ${
                        micState === "granted" ? "bg-emerald-50 border-emerald-200"
                        : micState === "denied" ? "bg-red-50 border-red-200"
                        : "bg-white border-border"
                    }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2.5 rounded-lg ${
                                micState === "granted" ? "bg-emerald-100 text-emerald-600"
                                : micState === "denied" ? "bg-red-100 text-red-500"
                                : "bg-gray-100 text-foreground/40"
                            }`}>
                                <Mic size={20} strokeWidth={1.5} />
                            </div>
                            <StateIcon state={micState} />
                        </div>
                        <h3 className="font-heading text-base font-semibold mb-1">Microphone</h3>
                        <p className="font-body text-foreground/50 text-xs leading-relaxed">
                            Required to capture your spoken responses.
                        </p>
                    </div>
                </div>

                {/* Fullscreen Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mb-8">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="font-ui text-xs text-foreground/60 leading-relaxed">
                        <span className="font-semibold text-foreground">Full-screen is required.</span> Exiting full-screen will trigger a warning. A second violation will end your session.
                    </p>
                </div>

                <button
                    onClick={handleStart}
                    disabled={!isReady}
                    className={`w-full py-3 rounded-xl font-ui font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isReady
                        ? "bg-primary hover:bg-primary/90 text-white"
                        : "bg-gray-200 text-foreground/30 cursor-not-allowed"
                    }`}
                >
                    Continue to Calibration
                    <ArrowRight size={16} />
                </button>
            </motion.div>
        </div>
    );
}
