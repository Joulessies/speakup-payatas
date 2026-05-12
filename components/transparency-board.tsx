"use client";
import { useState, useEffect } from "react";
import { Loader2, Search, MapPin, Calendar, CheckCircle2, Star, MessageSquare } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_LABELS } from "@/types";

interface FeedbackEntry {
    rating: number;
    comment: string;
    date: string;
}

interface FeedbackSummary {
    count: number;
    average_rating: number | null;
    entries: FeedbackEntry[];
}

interface ResolvedReport {
    id: string;
    category: string;
    description: string;
    latitude: number;
    longitude: number;
    created_at: string;
    resolved_at: string;
    actions_taken: { status: string; note: string; date: string }[];
    feedback?: FeedbackSummary;
}

interface OverallFeedback {
    total_feedback: number;
    average_rating: number | null;
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    style={{ width: size, height: size }}
                    className={i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-white/15"}
                />
            ))}
        </span>
    );
}

export default function TransparencyBoard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<ResolvedReport[]>([]);
    const [summary, setSummary] = useState<OverallFeedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const url = categoryFilter === "all" ? "/api/transparency" : `/api/transparency?category=${categoryFilter}`;
                const res = await fetch(url);
                const data = await res.json();
                setReports(data.reports ?? []);
                setSummary(data.feedback_summary ?? null);
            } catch { }
            finally { setLoading(false); }
        })();
    }, [categoryFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${isDark ? "bg-white/[0.03] border-white/10 text-white/70" : "bg-white border-gray-200 text-gray-700"}`}>
                    <Search className="h-4 w-4 opacity-50" />
                    <span>Filter by category:</span>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className={`bg-transparent font-medium outline-none ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                        <option value="all">All Categories</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                {summary && summary.total_feedback > 0 && summary.average_rating !== null && (
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${isDark ? "bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                        <StarRow rating={summary.average_rating} />
                        <span className="font-semibold">{summary.average_rating.toFixed(1)}/5</span>
                        <span className="opacity-70">avg from {summary.total_feedback} resident{summary.total_feedback === 1 ? "" : "s"}</span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
            ) : reports.length === 0 ? (
                <div className={`p-12 text-center text-sm rounded-2xl border border-dashed ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                    No resolved reports found for this filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reports.map((r) => (
                        <div key={r.id} className={`flex flex-col rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100 shadow-sm"}`}>
                            <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-gray-50 border-gray-100"}`}>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                        {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] || r.category}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 flex-1 space-y-3">
                                <p className={`text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                    {r.description || <span className="italic opacity-50">No description provided</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 mt-4">
                                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                        <MapPin className="h-3 w-3" />
                                        Approx: {r.latitude}, {r.longitude}
                                    </div>
                                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                        <Calendar className="h-3 w-3" />
                                        Resolved {new Date(r.resolved_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            {r.actions_taken && r.actions_taken.length > 0 && (
                                <div className={`px-4 py-3 border-t text-xs ${isDark ? "bg-black/20 border-white/[0.06] text-white/60" : "bg-gray-50 border-gray-100 text-gray-600"}`}>
                                    <p className="font-medium mb-1">Actions taken:</p>
                                    <ul className="space-y-1 list-disc list-inside">
                                        {r.actions_taken.slice(-2).map((a, i) => (
                                            <li key={i} className="truncate">{a.note}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {r.feedback && r.feedback.count > 0 && (
                                <div className={`px-4 py-3 border-t text-xs ${isDark ? "bg-emerald-500/[0.04] border-white/[0.06] text-white/70" : "bg-emerald-50/50 border-gray-100 text-gray-700"}`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <MessageSquare className="h-3 w-3" />
                                            Resident feedback
                                        </div>
                                        {r.feedback.average_rating !== null && (
                                            <div className="inline-flex items-center gap-1">
                                                <StarRow rating={r.feedback.average_rating} size={12} />
                                                <span className="font-semibold">{r.feedback.average_rating.toFixed(1)}</span>
                                                <span className="opacity-60">({r.feedback.count})</span>
                                            </div>
                                        )}
                                    </div>
                                    {r.feedback.entries.length > 0 && (
                                        <ul className="space-y-1.5">
                                            {r.feedback.entries.map((entry, i) => (
                                                <li key={i} className={`rounded-md px-2 py-1.5 ${isDark ? "bg-white/[0.03]" : "bg-white/70"}`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <StarRow rating={entry.rating} size={11} />
                                                        <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                                                            {new Date(entry.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                                        </span>
                                                    </div>
                                                    {entry.comment && (
                                                        <p className={`mt-1 text-[11px] leading-snug ${isDark ? "text-white/65" : "text-gray-700"}`}>
                                                            “{entry.comment}”
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
