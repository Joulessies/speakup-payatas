"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { useLanguage } from "./language-provider";
import ThemeToggle from "./theme-toggle";
import LanguageToggle from "./language-toggle";
import {
  ShieldCheck,
  FileWarning,
  Map,
  Search,
  TrendingUp,
  Brain,
  QrCode,
  LogOut,
  UserRound,
  Menu,
  X,
} from "lucide-react";

export default function NavBar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const [session, setSession] = useState<{ role: "admin" | "user"; username: string } | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          setSession(null);
          setSessionLoaded(true);
          return;
        }
        const data = await res.json();
        if (data?.authenticated) {
          setSession({ role: data.role, username: data.username });
        } else {
          setSession(null);
        }
        setSessionLoaded(true);
      } catch {
        setSession(null);
        setSessionLoaded(true);
      }
    })();
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const handleLogin = async () => {
    // If a stale/active session exists, clear it so /login won't be auto-redirected by middleware.
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const MAIN_NAV = [
    { href: "/", label: t.navReport, icon: FileWarning },
    { href: "/admin", label: t.navMap, icon: Map },
    { href: "/analytics", label: t.navAnalytics, icon: TrendingUp },
    { href: "/track", label: t.navTrack, icon: Search },
  ];

  const visibleMainNav = MAIN_NAV.filter((item) => {
    if (item.href === "/admin" || item.href === "/analytics") {
      if (!sessionLoaded) return true;
      return session?.role === "admin";
    }
    return true;
  });

  const isUtilActive = (href: string) => isActivePath(href);

  const isActivePath = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const UTIL_NAV = [
    { href: "/about", label: "About", icon: Brain },
    { href: "/qr", label: "QR", icon: QrCode },
  ];

  const navLinkClass = (href: string) => {
    const isActive = isActivePath(href);
    return `shrink-0 inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl text-sm font-medium leading-none transition-colors ${
      isActive
        ? isDark
          ? "bg-white/12 text-white"
          : "bg-gray-100 text-gray-900"
        : isDark
          ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    }`;
  };

  const authActionClass = `inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors ${
    isDark
      ? "text-white/70 hover:text-white hover:bg-white/[0.08]"
      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
  }`;

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav
        className={`hidden md:flex items-center justify-between gap-3 px-4 lg:px-6 h-14 border-b z-50 backdrop-blur-xl shadow-sm shrink-0 ${
          isDark
            ? "bg-black/60 border-white/[0.06]"
            : "bg-white/70 border-black/[0.06]"
        }`}
      >
        {/* Left: brand + main links */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-5">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 leading-none">
            <ShieldCheck
              className={`h-[18px] w-[18px] shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
            />
            <span
              className={`hidden lg:inline text-base font-semibold tracking-tight leading-none ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              SpeakUp
            </span>
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

        {/* Right: utilities */}
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
          {session && (
            <div className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border ${
              isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-black/[0.02] border-black/[0.06]"
            }`}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${
                isDark ? "bg-white/[0.08] text-white/70" : "bg-black/[0.06] text-gray-700"
              }`}>
                <UserRound className="h-3.5 w-3.5" />
              </span>
              <span className={`max-w-[120px] truncate text-[11px] ${
                isDark ? "text-white/65" : "text-gray-600"
              }`}>
                {session.username}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                isDark ? "bg-white/[0.08] text-white/65" : "bg-black/[0.06] text-gray-600"
              }`}>
                {session.role}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className={authActionClass}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          )}
          {!session && (
            <button
              type="button"
              onClick={handleLogin}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                isDark
                  ? "text-white/65 border-white/[0.1] hover:text-white hover:bg-white/[0.08]"
                  : "text-gray-700 border-black/[0.1] hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              Login
            </button>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl ${
          isDark
            ? "bg-black/80 border-white/[0.08]"
            : "bg-white/80 border-black/[0.08]"
        }`}
      >
        {mobileMoreOpen && (
          <div
            className={`mx-3 mb-2 mt-2 rounded-xl border p-2 ${
              isDark ? "bg-black/90 border-white/[0.08]" : "bg-white/95 border-black/[0.08]"
            }`}
          >
            <div className="grid grid-cols-2 gap-2">
              {UTIL_NAV.map((item) => {
                const active = isUtilActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMoreOpen(false)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? isDark
                          ? "bg-white/12 text-white"
                          : "bg-gray-100 text-gray-900"
                        : isDark
                          ? "text-white/65 hover:bg-white/[0.08]"
                          : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
          isDark ? "border-white/[0.08]" : "border-black/[0.08]"
        }`}>
          <div className="min-w-0 flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${
              isDark ? "bg-white/[0.08] text-white/70" : "bg-black/[0.06] text-gray-700"
            }`}>
              <UserRound className="h-3.5 w-3.5" />
            </span>
            <span className={`text-[11px] truncate ${isDark ? "text-white/55" : "text-gray-600"}`}>
              {session ? `${session.username} (${session.role})` : "Not signed in"}
            </span>
          </div>
          {session ? (
            <button
              type="button"
              onClick={handleLogout}
              className={authActionClass}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                isDark
                  ? "text-white/65 hover:text-white hover:bg-white/[0.08]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              Login
            </button>
          )}
        </div>
        <div className="flex items-stretch">
          {visibleMainNav.map((item) => {
            const isActive = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors active:scale-95 ${
                  isActive
                    ? isDark
                      ? "text-indigo-400"
                      : "text-indigo-600"
                    : isDark
                      ? "text-white/35"
                      : "text-gray-400"
                }`}
              >
                <item.icon
                  className={`h-[22px] w-[22px] ${isActive ? "scale-105" : ""} transition-transform`}
                />
                <span className={`w-full truncate px-1 text-center text-[10px] font-semibold leading-none ${isActive ? "" : "opacity-70"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMoreOpen((prev) => !prev)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors ${
              mobileMoreOpen
                ? isDark
                  ? "text-indigo-400"
                  : "text-indigo-600"
                : isDark
                  ? "text-white/35"
                  : "text-gray-400"
            }`}
          >
            {mobileMoreOpen ? <X className="h-[22px] w-[22px]" /> : <Menu className="h-[22px] w-[22px]" />}
            <span className={`w-full truncate px-1 text-center text-[10px] font-semibold leading-none ${mobileMoreOpen ? "" : "opacity-70"}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
