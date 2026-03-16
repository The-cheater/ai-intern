"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Search,
    Bell,
    Sparkles,
    LogOut,
} from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router   = useRouter();

    // Auth guard — skip for login page itself
    useEffect(() => {
        if (pathname === "/dashboard/login") return;
        const auth = localStorage.getItem("vidya_admin_auth");
        if (!auth) {
            router.replace("/dashboard/login");
        }
    }, [pathname, router]);

    // Render login page without sidebar
    if (pathname === "/dashboard/login") {
        return <>{children}</>;
    }

    const handleLogout = () => {
        localStorage.removeItem("vidya_admin_auth");
        router.replace("/dashboard/login");
    };

    const menuItems = [
        { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { name: "Openings",  icon: FileText,         path: "/dashboard/openings" },
        { name: "Candidates",icon: Users,             path: "/dashboard/candidates" },
        { name: "Reports",   icon: Sparkles,          path: "/dashboard/reports" },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground font-body">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-white flex flex-col fixed h-full z-20 shadow-sm">
                <div className="p-6 border-b border-border">
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:shadow-violet transition-all">
                            <span className="font-heading text-white font-bold text-sm">V</span>
                        </div>
                        <span className="font-heading text-xl font-bold tracking-tight text-foreground">Vidya AI</span>
                    </Link>
                </div>

                <nav className="flex-1 px-3 py-5 space-y-0.5">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                        return (
                            <Link key={item.path} href={item.path}>
                                <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                                    isActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-foreground/50 hover:text-foreground hover:bg-gray-100"
                                }`}>
                                    <item.icon size={19} className={isActive ? "text-primary" : "group-hover:text-primary/70 transition-colors"} />
                                    <span className="font-ui font-medium text-sm">{item.name}</span>
                                    {isActive && (
                                        <motion.div layoutId="active-nav" className="ml-auto w-1 h-4 bg-primary/40 rounded-full" />
                                    )}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-border space-y-0.5">
                    <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/40 hover:text-foreground hover:bg-gray-100 transition-all">
                        <Settings size={19} />
                        <span className="font-ui font-medium text-sm">Settings</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                        <LogOut size={19} />
                        <span className="font-ui font-medium text-sm">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 min-h-screen relative">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-5%] left-[10%] w-[30%] h-[30%] bg-violet-200/20 blur-[100px] rounded-full pointer-events-none" />

                {/* Top Header */}
                <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
                    <div className="flex items-center gap-3 bg-gray-50 border border-border px-4 py-2 rounded-xl w-80 group focus-within:border-primary/40 transition-all">
                        <Search size={16} className="text-foreground/30 group-focus-within:text-primary flex-shrink-0" />
                        <input type="text" placeholder="Search openings, candidates…"
                            className="bg-transparent border-none outline-none text-sm font-ui w-full text-foreground placeholder:text-foreground/30" />
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2 rounded-xl bg-gray-50 border border-border text-foreground/40 hover:text-foreground transition-all relative">
                            <Bell size={18} />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger rounded-full" />
                        </button>
                        <div className="h-8 w-px bg-border mx-1" />
                        <div className="flex items-center gap-2.5 cursor-pointer">
                            <div className="text-right">
                                <p className="font-ui font-bold text-sm text-foreground">Admin</p>
                                <p className="font-ui text-[10px] text-foreground/40 uppercase tracking-widest leading-none">Recruiter</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center font-heading font-bold text-white text-sm">
                                A
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-8 relative z-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
