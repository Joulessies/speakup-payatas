"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, MessageSquare, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import { toast } from "sonner";

interface Props {
    reportId: string;
    /** If false (default), the form stays collapsed until the user opens it. */
    defaultOpen?: boolean;
}

interface ExistingFeedback {
    rating: number;
    comment: string;
    updated_at?: string;
}

/**
 * Per-report satisfaction feedback widget. Reads any existing feedback the same device left,
 * and lets the user update or submit a new rating + optional comment.
 */
export default function ReportFeedback({ reportId, defaultOpen = false }: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [open, setOpen] = useState(defaultOpen);
    const [loaded, setLoaded] = useState(false);
    const [existing, setExisting] = useState<ExistingFeedback | null>(null);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const hash = await generateReporterHash(getDeviceId());
                const res = await fetch(`/api/feedback?report_id=${encodeURIComponent(reportId)}&reporter_hash=${encodeURIComponent(hash)}`);
                if (!res.ok) return;
                const data = await res.json();
                const first = Array.isArray(data?.feedback) && data.feedback.length > 0 ? data.feedback[0] : null;
                if (!cancelled && first) {
                    setExisting({ rating: first.rating, comment: first.comment ?? "", updated_at: first.updated_at });
                    setRating(first.rating);
                    setComment(first.comment ?? "");
                }
            } catch {
                /* ignore — best-effort load */
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reportId]);

    const submit = async () => {
        if (rating === 0) {
            toast.error("Please pick a rating from 1 to 5 stars.");
            return;
        }
        setSubmitting(true);
        try {
            const hash = await generateReporterHash(getDeviceId());
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reporter_hash: hash, report_id: reportId, rating, comment }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Could not save feedback.");
            setExisting({ rating, comment, updated_at: new Date().toISOString() });
            toast.success(existing ? "Feedback updated. Thank you!" : "Feedback submitted. Thank you!");
            if (!defaultOpen) setOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save feedback.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!loaded) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isDark ? "bg-white/[0.03] text-white/50" : "bg-gray-50 text-gray-500"}`}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking feedback…
            </div>
        );
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                    existing
                        ? isDark
                            ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/[0.1]"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : isDark
                            ? "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
                <span className="inline-flex items-center gap-2">
                    {existing ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    {existing ? `You rated this ${existing.rating}/5` : "Rate the barangay's response"}
                </span>
                <span className="opacity-70">{existing ? "Edit" : "Add feedback"}</span>
            </button>
        );
    }

    return (
        <div className={`rounded-xl border p-3 space-y-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-gray-50 border-gray-100"}`}>
            <div className="flex items-center justify-between gap-2">
                <p className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>
                    How satisfied are you with the barangay's response?
                </p>
                {!defaultOpen && (
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className={`text-[10px] ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-700"}`}
                    >
                        Cancel
                    </button>
                )}
            </div>
            <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="p-1 transition-transform hover:scale-110"
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    >
                        <Star
                            className={`h-6 w-6 transition-colors ${
                                star <= (hover || rating) ? "text-amber-400 fill-amber-400" : isDark ? "text-white/15" : "text-gray-300"
                            }`}
                        />
                    </button>
                ))}
            </div>
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional — tell us what worked well or what could improve."
                rows={3}
                className={`w-full p-2 text-xs rounded-lg resize-none border ${
                    isDark
                        ? "bg-black/30 border-white/10 text-white placeholder:text-white/30"
                        : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                }`}
            />
            <div className="flex items-center justify-end">
                <Button type="button" onClick={submit} disabled={submitting || rating === 0} size="sm" className="gap-1.5">
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : existing ? <Check className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                    {existing ? "Update feedback" : "Submit feedback"}
                </Button>
            </div>
            {existing?.updated_at && (
                <p className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                    Last submitted {new Date(existing.updated_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
            )}
        </div>
    );
}
