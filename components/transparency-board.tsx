"use client";
import { useState, useEffect } from "react";
import { Loader2, Search, MapPin, Calendar, CheckCircle2, Star, MessageSquare, ChevronDown, ChevronUp, ArrowRight, Maximize2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_COLORS, CATEGORY_LABELS, CONFIDENTIAL_CATEGORIES, REPORT_CATEGORIES, resolveCategory } from "@/types";
import { useRouter } from "next/navigation";
import { ImageLightbox } from "@/components/image-lightbox";

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
    /** Null when the concern was encoded without a map pin. */
    latitude: number | null;
    longitude: number | null;
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
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

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
                            {REPORT_CATEGORIES.filter((k) => !CONFIDENTIAL_CATEGORIES.includes(k)).map((k) => (
                                <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
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
                <div className={embedded ? "grid grid-cols-1 md:grid-cols-3 gap-3.5" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                    {displayReports.map((r) => {
                        const catKey = resolveCategory(r.category) ?? "other";
                        const catColor = CATEGORY_COLORS[catKey] || "#10b981";
                        const catLabel = CATEGORY_LABELS[catKey] || r.category;

                        return (
                            <div
                                key={r.id}
                                className={`group rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                                    isDark
                                        ? "bg-[#042018]/90 border-emerald-500/20 hover:border-emerald-400/40 hover:bg-[#062c22] hover:shadow-xl hover:shadow-emerald-950/50 hover:-translate-y-0.5"
                                        : "bg-white border-emerald-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 hover:bg-emerald-50/20 hover:-translate-y-0.5"
                                } ${expandedId === r.id ? "ring-2 ring-emerald-500/50" : ""}`}
                                onClick={() => handleCardClick(r.id)}
                            >
                                <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
                                    isDark ? "bg-white/[0.02] border-emerald-500/15" : "bg-gray-50/70 border-emerald-100"
                                }`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full truncate"
                                            style={{
                                                backgroundColor: `${catColor}18`,
                                                color: catColor,
                                                border: `1px solid ${catColor}35`
                                            }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                                            <span className="truncate">{catLabel}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {r.feedback && r.feedback.count > 0 && r.feedback.average_rating !== null ? (
                                            <span className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                                isDark ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" : "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                                <Star className="h-3 w-3 fill-current text-amber-400" />
                                                <span>{r.feedback.average_rating.toFixed(1)}</span>
                                            </span>
                                        ) : (
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                                isDark ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            }`}>
                                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                                <span>Resolved</span>
                                            </span>
                                        )}
                                        {!embedded && (
                                            expandedId === r.id
                                                ? <ChevronUp className="h-4 w-4 opacity-50" />
                                                : <ChevronDown className="h-4 w-4 opacity-50" />
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                                    <div className="space-y-3">
                                        <p className={`text-xs md:text-sm leading-relaxed ${embedded ? "line-clamp-3 min-h-[3.6rem]" : ""} ${
                                            isDark ? "text-white/85" : "text-gray-700"
                                        }`}>
                                            {r.description || <span className="italic opacity-50">No description provided</span>}
                                        </p>
                                        {(r.resolution_photo_url || r.photo_url) && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLightboxImage({ src: (r.resolution_photo_url || r.photo_url)!, alt: "Resolution Proof" });
                                                }}
                                                className="group/img relative rounded-lg overflow-hidden border border-emerald-500/25 max-h-32 cursor-zoom-in mt-1"
                                                title="Click to view full screen"
                                            >
                                                <img
                                                    src={r.resolution_photo_url || r.photo_url}
                                                    alt="Responder proof / resolution photo"
                                                    className="w-full h-28 object-cover group-hover/img:scale-105 transition-transform duration-200"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[1px]">
                                                    <Maximize2 className="h-3.5 w-3.5" />
                                                    View Fullscreen
                                                </div>
                                            </div>
                                        )}
                                        {r.feedback && r.feedback.count > 0 && r.feedback.entries[0]?.comment && (
                                            <div className={`p-2.5 rounded-lg border text-[11px] ${
                                                isDark ? "bg-white/[0.03] border-white/10 text-emerald-200" : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                                            }`}>
                                                <div className="flex items-center gap-1.5 font-medium mb-1 text-[10px] opacity-75">
                                                    <MessageSquare className="h-3 w-3 text-emerald-400" />
                                                    <span>Resident Feedback</span>
                                                </div>
                                                <p className="italic line-clamp-2">
                                                    &ldquo;{r.feedback.entries[0].comment}&rdquo;
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`pt-2.5 border-t flex items-center justify-between text-[11px] ${
                                        isDark ? "border-emerald-500/15" : "border-emerald-100"
                                    }`}>
                                        <div className={`flex items-center gap-1.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                            <Calendar className="h-3.5 w-3.5 opacity-70" />
                                            <span>
                                                {new Date(r.resolved_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                        </div>
                                        {embedded ? (
                                            <span className={`inline-flex items-center gap-1 font-semibold transition-all ${
                                                isDark ? "text-emerald-400 group-hover:text-emerald-300" : "text-[#059669] group-hover:text-[#047857]"
                                            }`}>
                                                <span>View details</span>
                                                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                            </span>
                                        ) : (
                                            r.latitude != null && r.longitude != null && (
                                                <div className={`flex items-center gap-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                    <MapPin className="h-3 w-3" />
                                                    Approx location
                                                </div>
                                            )
                                        )}
                                    </div>
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
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLightboxImage({ src: a.photo_url!, alt: "Responder Action Proof" });
                                                                }}
                                                                className="group mt-1 relative rounded-lg overflow-hidden border border-emerald-500/20 cursor-zoom-in"
                                                                title="Click to view full screen"
                                                            >
                                                                <span className="text-[10px] text-emerald-500 font-medium block p-1 bg-emerald-500/10">📷 Responder Photo / Proof:</span>
                                                                <img src={a.photo_url} alt="Responder proof" className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[1px]">
                                                                    <Maximize2 className="h-3.5 w-3.5" />
                                                                    Full screen
                                                                </div>
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
                    );
                })}
                </div>
            )}

            {embedded && reports.length > 0 && (
                <div className={`mt-2 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs ${
                    isDark ? "border-emerald-500/15 text-white/55" : "border-emerald-100 text-gray-500"
                }`}>
                    <span className="flex items-center gap-2 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span>Showing 3 recent community resolutions &bull; {reports.length} total resolved in Payatas</span>
                    </span>
                    <button
                        onClick={() => router.push("/transparency")}
                        className={`font-semibold hover:underline flex items-center gap-1 transition-colors text-xs ${
                            isDark ? "text-emerald-300 hover:text-emerald-200" : "text-[#059669] hover:text-[#047857]"
                        }`}
                    >
                        <span>Open public directory</span>
                        <ArrowRight className="h-3 w-3" />
                    </button>
                </div>
            )}
            {/* Fullscreen Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage.src}
                    alt={lightboxImage.alt}
                    isOpen={Boolean(lightboxImage)}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </div>
    );
}
