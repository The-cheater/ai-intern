"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-8 w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto">
                <span className="font-heading text-5xl font-black text-foreground/20">404</span>
            </div>
            <h1 className="font-heading text-4xl font-bold text-foreground mb-3">Page Not Found</h1>
            <p className="font-body text-foreground/50 text-lg mb-10 max-w-md">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <div className="flex items-center gap-4">
                <Link href="/"
                    className="flex items-center gap-2 bg-primary text-white font-heading font-bold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all">
                    <Home size={18} /> Go Home
                </Link>
                <button onClick={() => history.back()}
                    className="flex items-center gap-2 bg-white border border-border text-foreground font-heading font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all">
                    <ArrowLeft size={18} /> Go Back
                </button>
            </div>
        </div>
    );
}
