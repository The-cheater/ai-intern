"use client";

import Link from "next/link";
import { LayoutDashboard, ArrowLeft } from "lucide-react";

export default function DashboardNotFound() {
    return (
        <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="mb-8 w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto">
                <span className="font-heading text-3xl font-black text-foreground/20">404</span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-foreground mb-3">Page Not Found</h2>
            <p className="font-body text-foreground/50 text-base mb-10 max-w-sm">
                This dashboard page doesn&apos;t exist. You may have followed a broken link.
            </p>
            <div className="flex items-center gap-3">
                <Link href="/dashboard"
                    className="flex items-center gap-2 bg-primary text-white font-heading font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all text-sm">
                    <LayoutDashboard size={16} /> Back to Dashboard
                </Link>
                <button onClick={() => history.back()}
                    className="flex items-center gap-2 bg-white border border-border text-foreground font-heading font-bold px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm">
                    <ArrowLeft size={16} /> Go Back
                </button>
            </div>
        </div>
    );
}
