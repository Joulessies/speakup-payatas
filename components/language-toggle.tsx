"use client";

import { useLanguage } from "./language-provider";
import { useTheme } from "./theme-provider";

export default function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "fil" : "en")}
      className={`px-2 py-1 rounded-lg text-[11px] font-bold tracking-wider transition-colors ${
        isDark
          ? "bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white"
          : "bg-black/[0.04] text-gray-500 hover:bg-black/[0.08] hover:text-gray-900"
      } ${className ?? ""}`}
      aria-label="Toggle language"
    >
      {locale === "en" ? "FIL" : "EN"}
    </button>
  );
}
