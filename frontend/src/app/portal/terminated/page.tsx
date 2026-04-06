"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Home } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Terminated() {
    // Clear any remaining session data
    useEffect(() => {
        sessionStorage.removeItem("examiney_session");
    }, []);

    return (
        <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-8 text-center font-body">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-sm w-full flex flex-col items-center"
            >
                <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="w-14 h-14 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center border border-red-500/20 mb-6"
                >
                    <ShieldAlert size={26} strokeWidth={1.5} />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-white text-xl font-semibold mb-3"
                >
                    Interview Ended
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-white/40 text-sm leading-relaxed mb-2"
                >
                    Your session was closed because full-screen mode was exited more than once.
                </motion.p>

                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-white/25 text-xs leading-relaxed mb-10"
                >
                    The hiring team has been notified. Please contact your recruiter if you believe this was a mistake.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Link
                        href="/portal/login"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl text-white/50 hover:text-white/80 font-ui font-medium text-sm transition-all"
                    >
                        <Home size={14} /> Back to Login
                    </Link>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-12 text-white/10 text-[10px]"
                >
                    Examiney.AI &copy; 2025
                </motion.p>
            </motion.div>
        </div>
    );
}
