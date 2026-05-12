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
    const [session, setSession] = useState<{ role: "admin" | "staff" | "user"; username: string } | null>(null);
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
                    setSession({ role: data.role, username: data.username });
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
            window.location.href = "/login";
        } finally {
            setLoggingOut(false);
            setShowLogoutConfirm(false);
        }
    };

    const isActive = (href: string) => {
        if (href === "/") {
            return pathname === "/";
        }
        return pathname.startsWith(href);
    };

    const getNavItems = (): NavItem[] => {
        if (!session) return [];

        switch (session.role) {
            case "user":
                return [
                    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/", label: "Reports", icon: FileWarning },
                    { href: "/track", label: "Track", icon: Search },
                    { href: "/transparency", label: "Transparency", icon: Eye },
                    { href: "/feedback", label: "Feedback", icon: MessageSquare },
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
            <aside className={`hidden md:flex flex-col h-screen fixed left-0 top-0 border-r z-40 transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"} ${isDark ? "bg-[#0a0a0f] border-white/[0.08]" : "bg-white border-gray-200"}`}>
                {/* Logo and Collapse Toggle */}
                <div className={`flex items-center border-b border-dashed border-gray-700 ${collapsed ? "p-3 justify-center" : "p-5 justify-between"}`}>
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                                <ShieldCheck className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                            </div>
                            <div>
                                <h1 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>SpeakUp</h1>
                                <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>Payatas</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-500"} ${collapsed ? "mx-auto" : ""}`}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={`flex items-center rounded-xl text-sm font-medium transition-all ${
                                collapsed ? "justify-center p-3" : "gap-3 px-3 py-3"
                            } ${
                                isActive(item.href)
                                    ? isDark
                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                        : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : isDark
                                    ? "text-white/70 hover:bg-white/[0.05] hover:text-white"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1">{item.label}</span>
                                    {isActive(item.href) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                </>
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Bottom Section */}
                <div className={`p-3 border-t border-dashed border-gray-700 space-y-3 ${collapsed ? "items-center" : ""}`}>
                    {!collapsed && (
                        <div className="flex items-center justify-between">
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
                        <div className={`rounded-xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-gray-50 border-gray-200"} ${collapsed ? "p-2" : "p-3"}`}>
                            <div className={`flex items-center gap-3 ${collapsed ? "flex-col" : "mb-2"}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/10 text-white/70" : "bg-gray-200 text-gray-700"}`}>
                                    <UserRound className="h-4 w-4" />
                                </div>
                                {!collapsed && (
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>{session.username}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded ${roleBadgeColor}`}>{session.role}</span>
                                    </div>
                                )}
                                {!collapsed && <NotificationBell role={session.role} />}
                            </div>
                            <Link
                                href={session.role === "admin" ? "/admin/settings" : "/account"}
                                title={collapsed ? "Account Settings" : undefined}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? "text-white/60 hover:text-white hover:bg-white/[0.08]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"} ${collapsed ? "w-full px-2" : "w-full"}`}
                            >
                                <UserRound className="h-3.5 w-3.5" />
                                {!collapsed && "Account Settings"}
                            </Link>
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                title={collapsed ? "Logout" : undefined}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? "text-white/60 hover:text-white hover:bg-white/[0.08]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"} ${collapsed ? "w-full px-2" : "w-full"}`}
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                {!collapsed && "Logout"}
                            </button>
                        </div>
                    )}
                </div>
            </aside>
            {/* Desktop Collapsed Spacer */}
            <div className={`hidden md:block ${collapsed ? "w-[72px]" : "w-[260px]"} shrink-0 transition-all duration-300`} />
            <LogoutConfirmDialog
                open={showLogoutConfirm}
                loading={loggingOut}
                onCancel={() => setShowLogoutConfirm(false)}
                onConfirm={handleLogout}
            />
        </>
    );
}
