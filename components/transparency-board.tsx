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
    photo_url?: string;
    resolution_photo_url?: string;
    actions_taken: { status: string; note: string; date: string; photo_url?: string }[];
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
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${isDark ? "bg-[#06382b] border-emerald-500/30 text-white/90" : "bg-white border-emerald-200 text-[#064e3b]"}`}>
                        <Search className="h-4 w-4 opacity-50" />
                        <span>Filter by category:</span>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className={`bg-transparent font-medium outline-none ${isDark ? "text-white [&>option]:bg-[#04271e] [&>option]:text-white" : "text-gray-900 [&>option]:bg-white [&>option]:text-gray-900"}`}
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
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-50 text-emerald-500" /></div>
            ) : displayReports.length === 0 ? (
                <div className={`p-8 text-center text-sm rounded-xl border border-dashed ${isDark ? "border-emerald-500/20 text-white/60" : "border-emerald-200 text-[#047857]"}`}>
                    {embedded ? "No resolved reports yet." : "No resolved reports found for this filter."}
                </div>
            ) : (
                <div className={embedded ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                    {displayReports.map((r) => (
                        <div
                            key={r.id}
                            className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
                                isDark
                                    ? "bg-[#06382b] border-emerald-500/30 hover:bg-[#084837] hover:border-emerald-400/50"
                                    : "bg-white border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-300"
                            } ${expandedId === r.id ? "ring-1 ring-emerald-500/40" : ""}`}
                            onClick={() => handleCardClick(r.id)}
                        >
                            <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? "bg-[#042d22] border-emerald-500/20" : "bg-[#e6f4ea] border-emerald-200"}`}>
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
                                {(r.resolution_photo_url || r.photo_url) && (
                                    <div className="mt-2 rounded-xl overflow-hidden border border-emerald-500/30 max-h-40">
                                        <img
                                            src={r.resolution_photo_url || r.photo_url}
                                            alt="Responder proof / resolution photo"
                                            className="w-full h-36 object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    </div>
                                )}
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
                                {r.feedback && r.feedback.count > 0 && (
                                    <div className={`mt-2 p-2.5 rounded-xl border text-xs ${isDark ? "bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-200" : "bg-[#e6f4ea] border-emerald-200 text-[#064e3b]"}`}>
                                        <div className="flex items-center justify-between gap-2 font-semibold">
                                            <span className="flex items-center gap-1.5 text-[11px]">
                                                <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> Complainant Feedback
                                            </span>
                                            {r.feedback.average_rating !== null && (
                                                <div className="flex items-center gap-1 text-[11px]">
                                                    <StarRow rating={r.feedback.average_rating} size={12} />
                                                    <span>{r.feedback.average_rating.toFixed(1)}/5</span>
                                                </div>
                                            )}
                                        </div>
                                        {r.feedback.entries[0]?.comment && (
                                            <p className={`mt-1 text-[11px] italic line-clamp-2 ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                &ldquo;{r.feedback.entries[0].comment}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                )}

                                {embedded && (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-[#059669]"}`}>
                                        <ArrowRight className="h-3 w-3" /> View details
                                    </span>
                                )}
                            </div>

                            {/* Expanded detail (non-embedded) */}
                            {!embedded && expandedId === r.id && (
                                <div className={`border-t px-4 py-3 space-y-3 ${isDark ? "border-emerald-500/20" : "border-gray-100"}`} onClick={(e) => e.stopPropagation()}>
                                    {r.actions_taken && r.actions_taken.length > 0 && (
                                        <div>
                                            <p className={`text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>Actions taken:</p>
                                            <ul className={`space-y-2 text-xs ${isDark ? "text-white/50" : "text-gray-600"}`}>
                                                {r.actions_taken.slice(-3).map((a, i) => (
                                                    <li key={i} className={`flex flex-col gap-1.5 p-2 rounded-lg ${isDark ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-gray-50"}`}>
                                                        <div className="flex items-start gap-2">
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                                            <span>{a.note}</span>
                                                        </div>
                                                        {a.photo_url && (
                                                            <div className="mt-1">
                                                                <span className="text-[10px] text-emerald-500 font-medium block mb-1">📷 Responder Photo / Proof:</span>
                                                                <img src={a.photo_url} alt="Responder proof" className="h-28 w-full object-cover rounded-lg border border-emerald-500/20" />
                                                            </div>
                                                        )}
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
                                                        <li key={i} className={`rounded-md px-2 py-1.5 ${isDark ? "bg-[#042d22]" : "bg-white/70"}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <StarRow rating={entry.rating} size={11} />
                                                                <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                                                                    {new Date(entry.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                                                </span>
                                                            </div>
                                                            {entry.comment && (
                                                                <p className={`mt-1 text-[11px] leading-snug ${isDark ? "text-white/65" : "text-gray-700"}`}>
                                                                    &quot;{entry.comment}&quot;
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
                        className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-[#059669] hover:bg-[#e6f4ea]"}`}
                    >
                        View all {reports.length} resolved reports →
                    </button>
                </div>
            )}
        </div>
    );
}
