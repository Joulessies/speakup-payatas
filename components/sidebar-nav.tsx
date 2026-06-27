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

    const roleBadgeColor =
        session?.role === "admin"
            ? "bg-red-500/20 text-red-300"
            : session?.role === "staff"
                ? "bg-blue-500/20 text-blue-300"
                : "bg-emerald-500/20 text-emerald-300";

    return (
        <>
            <aside
                className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 border-r ${collapsed ? "w-[72px]" : "w-[260px]"
                    } ${isDark
                        ? "bg-[#091829] border-white/[0.06]"
                        : "bg-[#0f2d5c] border-[#1e3f70]"
                    }`}
            >
                {/* Logo + Collapse */}
                <div
                    className={`flex items-center border-b border-white/10 shrink-0 ${collapsed ? "p-3 justify-center h-16" : "px-5 justify-between h-16"
                        }`}
                >
                    {!collapsed && (
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/20 shrink-0">
                                <ShieldCheck className="h-5 w-5 text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-bold text-white leading-none text-[15px]">SpeakUp</h1>
                                <p className="text-[10px] text-blue-300/70 mt-0.5 leading-none font-medium tracking-wide uppercase">
                                    Payatas D2
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`p-1.5 rounded-md transition-colors text-white/40 hover:text-white hover:bg-white/10 ${collapsed ? "mx-auto" : ""
                            }`}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>

                {/* Role label */}
                {!collapsed && session && (
                    <div className="px-4 pt-4 pb-1">
                        <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/30">
                            {session.role === "admin"
                                ? "Administration"
                                : session.role === "staff"
                                    ? "Staff Portal"
                                    : "Citizen Portal"}
                        </span>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                                    } ${active
                                        ? "bg-blue-500/20 text-white border-l-2 border-blue-400 pl-[10px]"
                                        : "text-white/55 hover:bg-white/[0.07] hover:text-white border-l-2 border-transparent"
                                    }`}
                            >
                                <item.icon
                                    className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : ""}`}
                                />
                                {!collapsed && (
                                    <span className="flex-1 truncate">{item.label}</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Divider */}
                <div className="mx-3 border-t border-white/10" />

                {/* Bottom Section */}
                <div className={`p-3 space-y-2 shrink-0 ${collapsed ? "items-center" : ""}`}>
                    {!collapsed && (
                        <div className="flex items-center justify-between px-1">
                            <LanguageToggle />
                            <ThemeToggle />
                        </div>
                    )}
                    {collapsed && (
                        <div className="flex flex-col items-center gap-2">
                            <ThemeToggle />
                        </div>
                    )}
                    {session && (
                        <div
                            className={`rounded-lg border border-white/10 bg-white/[0.05] ${collapsed ? "p-2" : "p-3"
                                }`}
                        >
                            <div className={`flex items-center gap-2.5 ${collapsed ? "flex-col" : "mb-2.5"}`}>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-300 shrink-0">
                                    <UserRound className="h-4 w-4" />
                                </div>
                                {!collapsed && (
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">
                                            {session.username}
                                        </p>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${session.role === "admin"
                                                    ? "bg-red-500/20 text-red-300"
                                                    : session.role === "staff"
                                                        ? "bg-amber-500/20 text-amber-300"
                                                        : "bg-blue-500/20 text-blue-300"
                                                }`}
                                        >
                                            {session.role}
                                        </span>
                                    </div>
                                )}
                                {!collapsed && (
                                    <NotificationBell role={session.role} reporterHash={session.reporter_hash} />
                                )}
                            </div>
                            <Link
                                href={session.role === "admin" ? "/admin/settings" : "/account"}
                                title={collapsed ? "Account Settings" : undefined}
                                className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors text-white/50 hover:text-white hover:bg-white/10 ${collapsed ? "w-full px-2" : "w-full"
                                    }`}
                            >
                                <UserRound className="h-3.5 w-3.5" />
                                {!collapsed && "Account Settings"}
                            </Link>
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                title={collapsed ? "Logout" : undefined}
                                className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors text-white/50 hover:text-white hover:bg-white/10 ${collapsed ? "w-full px-2" : "w-full"
                                    }`}
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                {!collapsed && "Logout"}
                            </button>
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
