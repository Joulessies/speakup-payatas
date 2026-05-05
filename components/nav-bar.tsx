"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { useLanguage } from "./language-provider";
import ThemeToggle from "./theme-toggle";
import LanguageToggle from "./language-toggle";
import NotificationBell from "./notification-bell";
import { ShieldCheck, FileWarning, Map, Search, TrendingUp, Brain, QrCode, LogOut, UserRound, Menu, X, LayoutDashboard, Eye, MessageSquare, Shield, } from "lucide-react";

export default function NavBar() {
    const pathname = usePathname();
    const { theme } = useTheme();
    const { t } = useLanguage();
    const isDark = theme === "dark";
    const [session, setSession] = useState<{ role: "admin" | "staff" | "user"; username: string } | null>(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);
    const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) { setSession(null); setSessionLoaded(true); return; }
                const data = await res.json();
                if (data?.authenticated) setSession({ role: data.role, username: data.username });
                else setSession(null);
                setSessionLoaded(true);
            } catch { setSession(null); setSessionLoaded(true); }
        })();
    }, [pathname]);

    const handleLogout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
    const handleLogin = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };

    const isAdmin = session?.role === "admin";
    const isStaff = session?.role === "staff";
    const isUser = session?.role === "user";

    const MAIN_NAV = [
        { href: "/", label: t.navReport, icon: FileWarning, roles: ["user"] },
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["user"] },
        { href: "/map", label: t.navCommunityMap, icon: Map, roles: ["user", "staff"] },
        { href: "/staff", label: "Staff", icon: Shield, roles: ["staff"] },
        { href: "/admin", label: t.navMap, icon: Map, roles: ["admin"] },
        { href: "/admin/reports", label: "Manage Reports", icon: Search, roles: ["admin"] },
        { href: "/admin/users", label: "Manage Users", icon: UserRound, roles: ["admin"] },
        { href: "/analytics", label: t.navAnalytics, icon: TrendingUp, roles: ["admin"] },
        { href: "/track", label: t.navTrack, icon: Search, roles: ["user"] },
    ];

    const visibleMainNav = MAIN_NAV.filter((item) => {
        if (!sessionLoaded) return item.roles.includes("user");
        return session ? item.roles.includes(session.role) : item.roles.includes("user");
    });

    const isActivePath = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    const UTIL_NAV = [
        { href: "/transparency", label: "Transparency", icon: Eye },
        { href: "/feedback", label: "Feedback", icon: MessageSquare },
        { href: "/about", label: "About", icon: Brain },
        { href: "/qr", label: "QR", icon: QrCode },
    ];

    const navLinkClass = (href: string) => {
        const isActive = isActivePath(href);
        return `shrink-0 inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl text-sm font-medium leading-none transition-colors ${isActive
            ? isDark ? "bg-white/12 text-white" : "bg-gray-100 text-gray-900"
            : isDark ? "text-white/60 hover:text-white hover:bg-white/[0.06]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`;
    };

    const authActionClass = `inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors ${isDark
        ? "text-white/70 hover:text-white hover:bg-white/[0.08]" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"}`;

    const roleBadgeColor = session?.role === "admin" ? "bg-red-500/20 text-red-300" : session?.role === "staff" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300";

    return (<>
        {/* Desktop nav */}
        <nav className={`hidden md:flex items-center justify-between gap-3 px-4 lg:px-6 h-14 border-b z-50 backdrop-blur-xl shadow-sm shrink-0 ${isDark ? "bg-black/60 border-white/[0.06]" : "bg-white/70 border-black/[0.06]"}`}>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-5">
                <Link href="/" className="inline-flex shrink-0 items-center gap-2 leading-none">
                    <ShieldCheck className={`h-[18px] w-[18px] shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                    <span className={`hidden lg:inline text-base font-semibold tracking-tight leading-none ${isDark ? "text-white" : "text-gray-900"}`}>SpeakUp</span>
                </Link>
                <div className={`hidden lg:block w-px h-5 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                <div className="flex min-w-0 items-center gap-0.5">
                    {visibleMainNav.map((item) => (
                        <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="leading-none">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <div className="hidden lg:flex items-center gap-0.5">
                    {UTIL_NAV.map((item) => (
                        <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="hidden xl:inline text-xs leading-none">{item.label}</span>
                        </Link>
                    ))}
                    <div className={`w-px h-5 mx-1 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                </div>
                {session && <NotificationBell role={session.role} />}
                {session && (
                    <div className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.02] border-black/[0.06]"}`}>
                        <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${isDark ? "bg-white/[0.08] text-white/70" : "bg-black/[0.06] text-gray-700"}`}>
                            <UserRound className="h-3.5 w-3.5" />
                        </span>
                        <span className={`max-w-[100px] truncate text-[11px] ${isDark ? "text-white/65" : "text-gray-600"}`}>{session.username}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? roleBadgeColor : "bg-black/[0.06] text-gray-600"}`}>{session.role}</span>
                        <button type="button" onClick={handleLogout} className={authActionClass}><LogOut className="h-3.5 w-3.5" />Logout</button>
                    </div>
                )}
                {!session && (
                    <button type="button" onClick={handleLogin} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? "text-white/65 border-white/[0.1] hover:text-white hover:bg-white/[0.08]" : "text-gray-700 border-black/[0.1] hover:text-gray-900 hover:bg-gray-100"}`}>Login</button>
                )}
                <LanguageToggle />
                <ThemeToggle />
            </div>
        </nav>

        {/* Mobile nav */}
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl ${isDark ? "bg-black/80 border-white/[0.08]" : "bg-white/80 border-black/[0.08]"}`}>
            {mobileMoreOpen && (
                <div className={`mx-3 mb-2 mt-2 rounded-xl border p-2 ${isDark ? "bg-black/90 border-white/[0.08]" : "bg-white/95 border-black/[0.08]"}`}>
                    <div className="grid grid-cols-2 gap-2">
                        {UTIL_NAV.map((item) => (
                            <Link key={item.href} href={item.href} onClick={() => setMobileMoreOpen(false)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isActivePath(item.href)
                                ? isDark ? "bg-white/12 text-white" : "bg-gray-100 text-gray-900"
                                : isDark ? "text-white/65 hover:bg-white/[0.08]" : "text-gray-600 hover:bg-gray-100"}`}>
                                <item.icon className="h-4 w-4" />{item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
            <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`}>
                <div className="min-w-0 flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${isDark ? "bg-white/[0.08] text-white/70" : "bg-black/[0.06] text-gray-700"}`}>
                        <UserRound className="h-3.5 w-3.5" />
                    </span>
                    <span className={`text-[11px] truncate ${isDark ? "text-white/55" : "text-gray-600"}`}>
                        {session ? `${session.username} (${session.role})` : "Not signed in"}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {session && <NotificationBell role={session.role} />}
                    {session ? (
                        <button type="button" onClick={handleLogout} className={authActionClass}><LogOut className="h-3.5 w-3.5" />Logout</button>
                    ) : (
                        <button type="button" onClick={handleLogin} className={`text-[11px] px-2 py-1 rounded-md ${isDark ? "text-white/65 hover:bg-white/[0.08]" : "text-gray-600 hover:bg-gray-100"}`}>Login</button>
                    )}
                </div>
            </div>
            <div className="flex items-stretch">
                {visibleMainNav.slice(0, 4).map((item) => {
                    const isActive = isActivePath(item.href);
                    return (
                        <Link key={item.href} href={item.href} className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors active:scale-95 ${isActive ? isDark ? "text-indigo-400" : "text-indigo-600" : isDark ? "text-white/35" : "text-gray-400"}`}>
                            <item.icon className={`h-[22px] w-[22px] ${isActive ? "scale-105" : ""} transition-transform`} />
                            <span className={`w-full truncate px-1 text-center text-[10px] font-semibold leading-none ${isActive ? "" : "opacity-70"}`}>{item.label}</span>
                        </Link>
                    );
                })}
                <button type="button" onClick={() => setMobileMoreOpen((prev) => !prev)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors ${mobileMoreOpen ? isDark ? "text-indigo-400" : "text-indigo-600" : isDark ? "text-white/35" : "text-gray-400"}`}>
                    {mobileMoreOpen ? <X className="h-[22px] w-[22px]" /> : <Menu className="h-[22px] w-[22px]" />}
                    <span className={`w-full truncate px-1 text-center text-[10px] font-semibold leading-none ${mobileMoreOpen ? "" : "opacity-70"}`}>More</span>
                </button>
            </div>
        </nav>
    </>);
}
