"use client";

import { useEffect } from "react";
import { LogOut, X, Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface LogoutConfirmDialogProps {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    loading?: boolean;
}

export default function LogoutConfirmDialog({ open, onCancel, onConfirm, loading = false }: LogoutConfirmDialogProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
                className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${
                    isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-white border-emerald-200"
                }`}
            >
                <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-emerald-500/20" : "border-emerald-100"}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? "bg-red-500/15" : "bg-red-50"}`}>
                            <LogOut className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-600"}`} />
                        </div>
                        <h2 id="logout-confirm-title" className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                            Log out
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/50 hover:bg-emerald-500/10" : "text-[#047857] hover:bg-[#e6f4ea]"}`}
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="px-5 py-5">
                    <p className={`text-sm ${isDark ? "text-white/75" : "text-[#064e3b]"}`}>
                        Are you sure you want to log out?
                    </p>
                </div>
                <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-100 bg-[#f4fbf7]"}`}>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${
                            isDark
                                ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                : "bg-[#e6f4ea] text-[#047857] hover:bg-emerald-100"
                        }`}
                    >
                        No
                    </button>
                    <button
                        type="button"
                        onClick={() => void onConfirm()}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                        Yes, log out
                    </button>
                </div>
            </div>
        </div>
    );
}
