"use client";
import { useEffect } from "react";
import { X, MapPin, ExternalLink, AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";
import {
    getBrowserDisplayName,
    getOsDisplayName,
    getStepsForPlatform,
    type PlatformInfo,
} from "@/lib/geolocation-help";

interface GpsHelpDialogProps {
    open: boolean;
    onClose: () => void;
    platform: PlatformInfo | null;
}

export default function GpsHelpDialog({ open, onClose, platform }: GpsHelpDialogProps) {
    const { theme } = useTheme();
    const { t, locale } = useLanguage();
    const isDark = theme === "dark";

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open || !platform) return null;

    const steps = getStepsForPlatform(platform, locale);
    const browserName = getBrowserDisplayName(platform.browser);
    const osName = getOsDisplayName(platform.os);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gps-help-title"
            onClick={onClose}
        >
            <div
                className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] ${
                    isDark
                        ? "bg-[#0f1014] border border-white/10 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className={`flex items-center justify-between px-5 py-4 border-b ${
                        isDark ? "border-white/10" : "border-gray-200"
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                                isDark ? "bg-indigo-500/15" : "bg-indigo-50"
                            }`}
                        >
                            <MapPin className={`h-4 w-4 ${isDark ? "text-indigo-300" : "text-indigo-600"}`} />
                        </div>
                        <div className="min-w-0">
                            <h2 id="gps-help-title" className="text-base font-semibold truncate">
                                {t.locationHelpDialogTitle}
                            </h2>
                            <p
                                className={`text-[11px] truncate ${
                                    isDark ? "text-white/45" : "text-gray-500"
                                }`}
                            >
                                {t.locationHelpDetectedLabel} {browserName} · {osName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className={`shrink-0 p-1.5 rounded-lg ${
                            isDark
                                ? "hover:bg-white/10 text-white/60"
                                : "hover:bg-gray-100 text-gray-500"
                        }`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {!platform.isSecureContext && (
                        <div
                            className={`flex items-start gap-2 p-3 rounded-xl border ${
                                isDark
                                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                                    : "bg-red-50 border-red-200 text-red-800"
                            }`}
                        >
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <p className="text-xs leading-relaxed">{t.locationInsecureBanner}</p>
                        </div>
                    )}

                    {platform.isInAppWebView && (
                        <div
                            className={`flex items-start gap-2 p-3 rounded-xl border ${
                                isDark
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                                    : "bg-amber-50 border-amber-200 text-amber-800"
                            }`}
                        >
                            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
                            <p className="text-xs leading-relaxed">
                                {t.locationInAppBrowserBanner(platform.inAppName ?? browserName)}
                            </p>
                        </div>
                    )}

                    <p className={`text-xs leading-relaxed ${isDark ? "text-white/70" : "text-gray-700"}`}>
                        {t.locationHelpDialogIntro}
                    </p>

                    {steps.map((group, gi) => {
                        const isMapFallback = gi === steps.length - 1;
                        return (
                            <section
                                key={gi}
                                className={`rounded-xl border p-3 ${
                                    isMapFallback
                                        ? isDark
                                            ? "bg-indigo-500/10 border-indigo-500/30"
                                            : "bg-indigo-50 border-indigo-200"
                                        : isDark
                                            ? "bg-white/[0.03] border-white/10"
                                            : "bg-gray-50 border-gray-200"
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    {isMapFallback ? (
                                        <MapPin
                                            className={`h-4 w-4 shrink-0 ${
                                                isDark ? "text-indigo-300" : "text-indigo-600"
                                            }`}
                                        />
                                    ) : (
                                        <Smartphone
                                            className={`h-4 w-4 shrink-0 ${
                                                isDark ? "text-white/60" : "text-gray-500"
                                            }`}
                                        />
                                    )}
                                    <h3
                                        className={`text-sm font-semibold ${
                                            isDark ? "text-white" : "text-gray-900"
                                        }`}
                                    >
                                        {group.heading}
                                    </h3>
                                </div>
                                <ol className="space-y-1.5">
                                    {group.steps.map((step, si) => (
                                        <li
                                            key={si}
                                            className={`flex gap-2 text-xs leading-relaxed ${
                                                isDark ? "text-white/70" : "text-gray-700"
                                            }`}
                                        >
                                            <span
                                                className={`shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                                    isMapFallback
                                                        ? isDark
                                                            ? "bg-indigo-500/30 text-indigo-200"
                                                            : "bg-indigo-200 text-indigo-800"
                                                        : isDark
                                                            ? "bg-indigo-500/20 text-indigo-300"
                                                            : "bg-indigo-100 text-indigo-700"
                                                }`}
                                            >
                                                {si + 1}
                                            </span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        );
                    })}

                    <p className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                        {t.locationHelpUseMapHint}
                    </p>
                </div>

                <div className={`px-5 py-3 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
                    <Button type="button" onClick={onClose} className="w-full">
                        {t.locationHelpCloseLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
