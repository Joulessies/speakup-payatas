"use client";
import { useState, useEffect } from "react";
import { Loader2, Search, MapPin, Calendar, CheckCircle2, Star, MessageSquare, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_LABELS } from "@/types";
import { useRouter } from "next/navigation";

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

export default function TransparencyBoard({ embedded, reporterHash }: { embedded?: boolean; reporterHash?: string }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const router = useRouter();
    const [reports, setReports] = useState<ResolvedReport[]>([]);
    const [summary, setSummary] = useState<OverallFeedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

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

    // In embedded mode show only first 3 cards
    const displayReports = embedded ? reports.slice(0, 3) : reports;

    const handleCardClick = (reportId: string) => {
        if (embedded) {
            router.push(`/transparency`);
        } else {
            setExpandedId(expandedId === reportId ? null : reportId);
        }
    };

    return (
        <div className="space-y-4">
            {!embedded && (
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
            )}

            {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
            ) : displayReports.length === 0 ? (
                <div className={`p-8 text-center text-sm rounded-2xl border border-dashed ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                    {embedded ? "No resolved reports yet." : "No resolved reports found for this filter."}
                </div>
            ) : (
                <div className={embedded ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                    {displayReports.map((r) => (
                        <div
                            key={r.id}
                            className={`rounded-2xl border overflow-hidden transition-all cursor-pointer ${
                                isDark
                                    ? "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.12]"
                                    : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
                            } ${expandedId === r.id ? "ring-1 ring-indigo-500/30" : ""}`}
                            onClick={() => handleCardClick(r.id)}
                        >
                            <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-gray-50 border-gray-100"}`}>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                        {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] || r.category}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {r.feedback && r.feedback.count > 0 && r.feedback.average_rating !== null && (
                                        <span className={`text-[10px] flex items-center gap-1 ${isDark ? "text-amber-300" : "text-amber-600"}`}>
                                            <Star className="h-3 w-3 fill-current" />{r.feedback.average_rating.toFixed(1)}
                                        </span>
                                    )}
                                    {!embedded && (
                                        expandedId === r.id
                                            ? <ChevronUp className="h-4 w-4 opacity-40" />
                                            : <ChevronDown className="h-4 w-4 opacity-40" />
                                    )}
                                </div>
                            </div>
                            <div className="p-4 flex-1 space-y-3">
                                <p className={`text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                    {r.description || <span className="italic opacity-50">No description provided</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <div className={`flex items-center gap-1 text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                        <Calendar className="h-3 w-3" />
                                        Resolved {new Date(r.resolved_at).toLocaleDateString()}
                                    </div>
                                    {!embedded && (
                                        <div className={`flex items-center gap-1 text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                            <MapPin className="h-3 w-3" />
                                            Approx: {r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}
                                        </div>
                                    )}
                                </div>
                                {embedded && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
                                        <ArrowRight className="h-3 w-3" /> View details
                                    </span>
                                )}
                            </div>

                            {/* Expanded detail (non-embedded) */}
                            {!embedded && expandedId === r.id && (
                                <div className={`border-t px-4 py-3 space-y-3 ${isDark ? "border-white/[0.06]" : "border-gray-100"}`} onClick={(e) => e.stopPropagation()}>
                                    {r.actions_taken && r.actions_taken.length > 0 && (
                                        <div>
                                            <p className={`text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>Actions taken:</p>
                                            <ul className={`space-y-1 text-xs ${isDark ? "text-white/50" : "text-gray-600"}`}>
                                                {r.actions_taken.slice(-3).map((a, i) => (
                                                    <li key={i} className={`flex items-start gap-2 px-2 py-1 rounded-lg ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}>
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                                        {a.note}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {r.feedback && r.feedback.count > 0 && (
                                        <div className={`rounded-xl px-3 py-2 text-xs ${isDark ? "bg-emerald-500/[0.06]" : "bg-emerald-50/50"}`}>
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <MessageSquare className="h-3 w-3" />
                                                    Resident feedback ({r.feedback.count})
                                                </div>
                                                {r.feedback.average_rating !== null && (
                                                    <div className="inline-flex items-center gap-1">
                                                        <StarRow rating={r.feedback.average_rating} size={12} />
                                                        <span className="font-semibold">{r.feedback.average_rating.toFixed(1)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {r.feedback.entries.length > 0 && (
                                                <ul className="space-y-1.5">
                                                    {r.feedback.entries.slice(0, 3).map((entry, i) => (
                                                        <li key={i} className={`rounded-md px-2 py-1.5 ${isDark ? "bg-white/[0.03]" : "bg-white/70"}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <StarRow rating={entry.rating} size={11} />
                                                                <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                                                                    {new Date(entry.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                                                </span>
                                                            </div>
                                                            {entry.comment && (
                                                                <p className={`mt-1 text-[11px] leading-snug ${isDark ? "text-white/65" : "text-gray-700"}`}>
                                                                    "{entry.comment}"
                                                                </p>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {embedded && reports.length > 3 && (
                <div className="text-center pt-1">
                    <button
                        onClick={() => router.push("/transparency")}
                        className={`text-xs font-medium px-4 py-2 rounded-xl transition-colors ${isDark ? "text-indigo-400 hover:bg-indigo-500/10" : "text-indigo-600 hover:bg-indigo-50"}`}
                    >
                        View all {reports.length} resolved reports →
                    </button>
                </div>
            )}
        </div>
    );
}
