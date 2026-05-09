"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import {
    LayoutDashboard,
    FileWarning,
    Search,
    Eye,
    MessageSquare,
    Shield,
    BarChart3,
    Users,
    Map,
    UserRound,
    LogOut,
} from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

export default function BottomNav() {
    const pathname = usePathname();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [session, setSession] = useState<{ role: "admin" | "staff" | "user"; username: string } | null>(null);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) {
                    setSession(null);
                    return;
                }
                const data = await res.json();
                setSession(data);
            } catch {
                setSession(null);
            }
        })();
    }, []);

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
                    { href: "/staff", label: "Verify", icon: Shield },
                    { href: "/staff/summary", label: "Summary", icon: BarChart3 },
                ];
            case "admin":
                return [
                    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
                    { href: "/admin", label: "Map", icon: Map },
                    { href: "/admin/reports", label: "Reports", icon: FileWarning },
                    { href: "/admin/users", label: "Users", icon: Users },
                    { href: "/analytics", label: "Analytics", icon: BarChart3 },
                ];
            default:
                return [];
        }
    };

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const navItems = getNavItems();

    if (!session) return null;

    return (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t ${isDark 
            ? "bg-[#0a0a0f] border-white/[0.08]" 
            : "bg-white border-gray-200"}`}>
            <div className="flex items-center justify-around py-2">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                            isActive(item.href)
                                ? isDark
                                    ? "text-indigo-400"
                                    : "text-indigo-600"
                                : isDark
                                ? "text-white/50 hover:text-white/70"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium leading-none">
                            {item.label}
                        </span>
                    </Link>
                ))}
                
                {/* Account Settings Button */}
                <Link
                    href="/admin/settings"
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                        isActive("/admin/settings")
                            ? isDark
                                ? "text-indigo-400"
                                : "text-indigo-600"
                            : isDark
                            ? "text-white/50 hover:text-white/70"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <UserRound className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none">
                        Settings
                    </span>
                </Link>
                
                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                        isDark
                            ? "text-white/50 hover:text-white/70"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none">
                        Logout
                    </span>
                </button>
            </div>
        </div>
    );
}
