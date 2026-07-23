"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import ThemeToggle from "./theme-toggle";
import LanguageToggle from "./language-toggle";
import NotificationBell from "./notification-bell";
import LogoutConfirmDialog from "./logout-confirm-dialog";
import {
    ShieldCheck,
    FileWarning,
    LayoutDashboard,
    Search,
    Eye,
    MessageSquare,
    LogOut,
    UserRound,
    Menu,
    X,
    Map,
    Shield,
    BarChart3,
    Users,
    ChevronLeft,
    ChevronRight,
    History,
    QrCode,
    Info,
    TrendingUp,
    Settings,
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
}

export default function SidebarNav() {
    const pathname = usePathname();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [session, setSession] = useState<{ role: "admin" | "staff" | "user"; username: string; reporter_hash?: string } | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) {
                    setSession(null);
                    return;
                }
                const data = await res.json();
                if (data?.authenticated) {
                    setSession({ role: data.role, username: data.username, reporter_hash: data.reporter_hash });
                } else {
                    setSession(null);
                }
            } catch {
                setSession(null);
            }
        })();
    }, [pathname]);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
        } finally {
            setLoggingOut(false);
            setShowLogoutConfirm(false);
            window.location.href = "/login";
        }
    };

    const isActive = (href: string) => {
        const exactMatchRoutes = ["/", "/admin", "/staff"];
        if (exactMatchRoutes.includes(href)) {
            return pathname === href;
        }
        return pathname.startsWith(href);
    };

    const getNavItems = (): NavItem[] => {
        if (!session) return [];

        switch (session.role) {
            case "user":
                return [
                    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/report", label: "Report", icon: FileWarning },
                    { href: "/track", label: "Report History", icon: History },
                    { href: "/transparency", label: "Transparency", icon: Eye },
                    { href: "/feedback", label: "Feedback", icon: MessageSquare },
                    { href: "/qr", label: "QR Code", icon: QrCode },
                    { href: "/about", label: "About Us", icon: Info },
                ];
            case "staff":
                return [
                    { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/staff", label: "Verification Queue", icon: Shield },
                    { href: "/staff/summary", label: "Monthly Summary", icon: BarChart3 },
                ];
            case "admin":
                return [
                    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/admin", label: "Hotspot Map", icon: Map },
                    { href: "/admin/reports", label: "Manage Reports", icon: FileWarning },
                    { href: "/admin/users", label: "Manage Users", icon: Users },
                    { href: "/analytics", label: "Analytics", icon: BarChart3 },
                ];
            default:
                return [];
        }
    };

    const navItems = getNavItems();

    const [currentTime, setCurrentTime] = useState<string>("");
    const [greeting, setGreeting] = useState<string>("Good Afternoon");

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const hrs = now.getHours();
            if (hrs < 12) setGreeting("Good Morning");
            else if (hrs < 18) setGreeting("Good Afternoon");
            else setGreeting("Good Evening");

            setCurrentTime(now.toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    const roleBadgeColor =
        session?.role === "admin"
            ? "bg-red-500/20 text-red-300"
            : session?.role === "staff"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-emerald-500/20 text-emerald-300";

    return (
        <>
            <aside
                className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 border-r ${collapsed ? "w-[72px]" : "w-[260px]"
                    } ${isDark
                        ? "bg-[#031f18] border-emerald-500/20"
                        : "bg-[#064e3b] border-emerald-700"
                    }`}
            >
                {/* Logo Header */}
                <div
                    className={`flex flex-col items-center border-b border-white/10 shrink-0 ${collapsed ? "p-3 justify-center h-20" : "p-4 h-32 justify-center"
                        }`}
                >
                    {!collapsed && (
                        <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/payatas-logo.png" alt="Barangay Payatas Official Seal" className="w-12 h-12 object-contain drop-shadow-md rounded-full bg-white/10 p-0.5" />
                            <div className="min-w-0">
                                <h1 className="font-bold text-white leading-none text-sm tracking-wide uppercase">Barangay Payatas</h1>
                                <span className={`mt-1 inline-block text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    session?.role === "admin" ? "bg-red-500/20 text-red-300 border border-red-500/30" : session?.role === "staff" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}>
                                    {session?.role || "Admin"}
                                </span>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src="/payatas-logo.png" alt="Barangay Payatas Official Seal" className="w-9 h-9 object-contain drop-shadow-md rounded-full bg-white/10 p-0.5" />
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`p-1 rounded-md transition-colors text-white/40 hover:text-white hover:bg-white/10 absolute right-2 top-2`}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                className={`flex items-center rounded-lg text-xs font-semibold transition-all duration-150 ${collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                                    } ${active
                                        ? "bg-emerald-500/20 text-emerald-300 border-l-4 border-emerald-400 pl-[10px]"
                                        : "text-white/60 hover:bg-white/[0.08] hover:text-white border-l-4 border-transparent"
                                    }`}
                            >
                                <item.icon
                                    className={`h-4 w-4 shrink-0 ${active ? "text-emerald-400" : ""}`}
                                />
                                {!collapsed && (
                                    <span className="flex-1 truncate">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Clock Ticker & Bottom User Panel */}
                <div className={`p-3 space-y-2 shrink-0 border-t border-white/10 ${collapsed ? "items-center text-center" : ""}`}>
                    {!collapsed && (
                        <div className="p-2.5 rounded-xl bg-black/20 border border-white/5 text-center">
                            <p className="text-[11px] font-bold text-emerald-400 tracking-wide">{greeting}</p>
                            <p className="text-[10px] font-mono text-white/70 mt-0.5">{currentTime || "Loading time..."}</p>
                        </div>
                    )}
                    {session && (
                        <div className={`rounded-lg border border-white/10 bg-white/[0.05] ${collapsed ? "p-2" : "p-2.5"}`}>
                            <div className={`flex items-center gap-2.5 ${collapsed ? "flex-col" : "mb-2"}`}>
                                <Link
                                    href={session.role === "admin" || session.role === "staff" ? "/admin/settings" : "/account"}
                                    title="Account Settings"
                                    className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors shrink-0"
                                >
                                    <UserRound className="h-3.5 w-3.5" />
                                </Link>
                                {!collapsed && (
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            href={session.role === "admin" || session.role === "staff" ? "/admin/settings" : "/account"}
                                            title="Account Settings"
                                            className="text-xs font-semibold text-white hover:underline truncate block"
                                        >
                                            {session.username}
                                        </Link>
                                    </div>
                                )}
                                {!collapsed && (
                                    <NotificationBell role={session.role} reporterHash={session.reporter_hash} />
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
                                <Link
                                    href={session.role === "admin" || session.role === "staff" ? "/admin/settings" : "/account"}
                                    title={collapsed ? "Settings" : undefined}
                                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md text-[11px] font-medium transition-colors text-white/70 hover:text-white hover:bg-white/10 ${
                                        collapsed ? "w-full px-2" : "flex-1"
                                    }`}
                                >
                                    <Settings className="h-3 w-3" />
                                    {!collapsed && "Settings"}
                                </Link>
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    title={collapsed ? "Logout" : undefined}
                                    className={`flex items-center justify-center gap-1.5 py-1 rounded-md text-[11px] font-medium transition-colors text-white/50 hover:text-white hover:bg-white/10 ${
                                        collapsed ? "w-full px-2" : "flex-1"
                                    }`}
                                >
                                    <LogOut className="h-3 w-3" />
                                    {!collapsed && "LogOut"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Desktop Spacer */}
            <div
                className={`hidden md:block shrink-0 transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"
                    }`}
            />
            <LogoutConfirmDialog
                open={showLogoutConfirm}
                loading={loggingOut}
                onCancel={() => setShowLogoutConfirm(false)}
                onConfirm={handleLogout}
            />
        </>
    );
}
