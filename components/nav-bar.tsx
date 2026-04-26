"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

export default function NavBar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const MAIN_NAV = [
    { href: "/", label: t.navReport, icon: FileWarning },
    { href: "/admin", label: t.navMap, icon: Map },
    { href: "/analytics", label: t.navAnalytics, icon: TrendingUp },
    { href: "/track", label: t.navTrack, icon: Search },
  ];

  const UTIL_NAV = [
    { href: "/about", label: "About", icon: Brain },
    { href: "/qr", label: "QR", icon: QrCode },
  ];

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    return `shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? isDark
          ? "bg-white/12 text-white"
          : "bg-gray-100 text-gray-900"
        : isDark
          ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    }`;
  };

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav
        className={`hidden md:flex items-center justify-between gap-3 px-4 lg:px-6 h-14 border-b z-50 backdrop-blur-xl shrink-0 ${
          isDark
            ? "bg-black/60 border-white/[0.06]"
            : "bg-white/70 border-black/[0.06]"
        }`}
      >
        {/* Left: brand + main links */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <ShieldCheck
              className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
            />
            <span
              className={`hidden lg:inline text-base font-semibold tracking-tight ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              SpeakUp
            </span>
          </Link>

          <div className={`hidden lg:block w-px h-5 ${isDark ? "bg-white/10" : "bg-black/10"}`} />

          <div className="flex min-w-0 items-center gap-0.5">
            {MAIN_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: utilities */}
        <div className="flex shrink-0 items-center gap-0.5">
          <div className="hidden lg:flex items-center gap-0.5">
            {UTIL_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                <item.icon className="h-4 w-4" />
                <span className="hidden 2xl:inline text-xs">{item.label}</span>
              </Link>
            ))}
            <div className={`w-px h-5 mx-1 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
          </div>
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
        <div className="flex items-stretch">
          {MAIN_NAV.map((item) => {
            const isActive = pathname === item.href;
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
        </div>
      </nav>
    </>
  );
}
