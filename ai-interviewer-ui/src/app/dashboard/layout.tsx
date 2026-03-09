"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Plus,
    Search,
    Bell,
    ChevronRight,
    LogOut,
    Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const menuItems = [
        { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { name: "Openings", icon: FileText, path: "/dashboard/openings" },
        { name: "Candidates", icon: Users, path: "/dashboard/candidates" },
        { name: "Reports", icon: Sparkles, path: "/dashboard/reports" },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground font-body">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-slate-900/50 backdrop-blur-xl flex flex-col fixed h-full z-20">
                <div className="p-6">
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:shadow-violet-active transition-all">
                            <span className="font-heading text-primary-foreground font-bold">A</span>
                        </div>
                        <span className="font-heading text-xl font-bold tracking-tight">Astra</span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                        return (
                            <Link key={item.path} href={item.path}>
                                <span className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive ? "bg-primary text-white shadow-violet" : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}>
                                    <item.icon size={20} className={isActive ? "text-white" : "group-hover:text-primary transition-colors"} />
                                    <span className="font-ui font-medium">{item.name}</span>
                                    {isActive && (
                                        <motion.div layoutId="active-nav" className="ml-auto w-1 h-4 bg-white/50 rounded-full" />
                                    )}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/5 bg-slate-950/30">
                    <Link href="/dashboard/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-slate-400 hover:text-white transition-all`}>
                        <Settings size={20} />
                        <span className="font-ui font-medium">Settings</span>
                    </Link>
                    <Link href="/dashboard/login" className="flex items-center gap-3 px-4 py-3 rounded-xl text-danger hover:bg-danger/10 transition-all">
                        <LogOut size={20} />
                        <span className="font-ui font-medium">Logout</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 min-h-screen relative overflow-hidden">
                {/* Floating gradient ornaments */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-900/10 blur-[130px] rounded-full pointer-events-none" />

                {/* Top Header */}
                <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-background/50 backdrop-blur-md border-b border-white/5">
                    <div className="flex items-center gap-4 bg-slate-900/50 border border-white/10 px-4 py-2 rounded-xl w-96 group focus-within:border-primary/50 transition-all">
                        <Search size={18} className="text-slate-500 group-focus-within:text-primary" />
                        <input type="text" placeholder="Search openings, candidates..." className="bg-transparent border-none outline-none text-sm font-ui w-full text-slate-200 placeholder:text-slate-600" />
                        <kbd className="hidden sm:inline-block bg-slate-800 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-500 uppercase tracking-tight">Cmd K</kbd>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all relative">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-slate-950" />
                        </button>
                        <div className="h-8 w-px bg-white/5 mx-2" />
                        <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                            <div className="text-right">
                                <p className="font-ui font-bold text-sm">John Recruiter</p>
                                <p className="font-ui text-[10px] text-slate-500 uppercase tracking-widest leading-none">Senior Talent Partner</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 p-[1px]">
                                <div className="w-full h-full rounded-[11px] bg-slate-900 flex items-center justify-center font-heading font-bold text-white">JR</div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
