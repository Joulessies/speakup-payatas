"use client";
import { useState, useEffect } from "react";
import { Loader2, CheckCircle, ShieldAlert, Copy, Check, MessageSquare, AlertTriangle, ShieldCheck } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS, type ReportCategory } from "@/types";

interface Report {
    id: string;
    category: string;
    description: string;
    verification_status: "unreviewed" | "valid" | "spam" | "duplicate";
    status: string;
    created_at: string;
    submitted_at?: string;
    ai_category?: string;
    admin_category?: string;
    is_flagged?: boolean;
    flag_reason?: string;
}

export default function VerificationPanel({ role }: { role: "admin" | "staff" }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [filter, setFilter] = useState<"unreviewed" | "valid" | "spam" | "duplicate">("unreviewed");
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [expandedNote, setExpandedNote] = useState<string | null>(null);

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?verification=${filter}`);
            const data = await res.json();
            setReports(data.reports ?? []);
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [filter]);

    const handleVerify = async (reportId: string, status: "valid" | "spam" | "duplicate") => {
        setSaving(reportId);
        try {
            await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    verification_status: status,
                    actor: role === "admin" ? "Admin" : "Staff",
                }),
            });
            await loadReports();
        } catch { }
        finally {
            setSaving(null);
        }
    };

    const handleAddNote = async (reportId: string) => {
        const note = notes[reportId]?.trim();
        if (!note) return;
        setSaving(`note_${reportId}`);
        try {
            await fetch("/api/reports/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    author: role === "admin" ? "Admin" : "Staff",
                    author_role: role,
                    content: note,
                }),
            });
            setNotes({ ...notes, [reportId]: "" });
            setExpandedNote(null);
            // Optionally reload notes
        } catch { }
        finally {
            setSaving(null);
        }
    };

    const handleCategoryChange = async (reportId: string, newCategory: string) => {
        if (role !== "admin") return;
        setSaving(reportId);
        try {
            await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    admin_category: newCategory,
                    actor: "Admin",
                }),
            });
            await loadReports();
        } catch { }
        finally {
            setSaving(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 w-fit">
                {["unreviewed", "valid", "spam", "duplicate"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                            filter === f ? (isDark ? "bg-white/10 text-white" : "bg-white shadow text-gray-900") : (isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-900")
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin opacity-50" />
                </div>
            ) : reports.length === 0 ? (
                <div className={`p-8 text-center text-sm rounded-xl border border-dashed ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                    No reports in this queue.
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report) => {
                        const rawCat = (report.admin_category || report.category) as string;
                        const categorySelectValue: ReportCategory = rawCat in CATEGORY_LABELS
                            ? (rawCat as ReportCategory)
                            : "other";
                        return (<div key={report.id} className={`rounded-xl border p-4 ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-white"}`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className={isDark ? "border-white/10 text-white/70" : ""}>
                                            {CATEGORY_LABELS[report.admin_category || report.category as keyof typeof CATEGORY_LABELS] || report.category}
                                        </Badge>
                                        {report.is_flagged && (
                                            <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                                                <AlertTriangle className="h-3 w-3 mr-1" /> Flagged
                                            </Badge>
                                        )}
                                        <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                            {new Date(report.submitted_at || report.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm mt-2 font-medium ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                        {report.description || <span className="italic opacity-50">No description provided</span>}
                                    </p>
                                    {report.is_flagged && (
                                        <p className="text-[10px] text-red-400 mt-1">
                                            Reason: {report.flag_reason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {filter === "unreviewed" && (
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dashed border-border/50">
                                    <button
                                        onClick={() => handleVerify(report.id, "valid")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                    >
                                        {saving === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        Valid
                                    </button>
                                    <button
                                        onClick={() => handleVerify(report.id, "spam")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    >
                                        <ShieldAlert className="h-3.5 w-3.5" /> Spam
                                    </button>
                                    <button
                                        onClick={() => handleVerify(report.id, "duplicate")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                    >
                                        <Copy className="h-3.5 w-3.5" /> Duplicate
                                    </button>
                                </div>
                            )}

                            {role === "admin" && (<div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] ${isDark ? "text-white/50" : "text-gray-500"}`}>Override Category:</span>
                                <Select value={categorySelectValue} onValueChange={(v) => handleCategoryChange(report.id, v)} disabled={saving === report.id}>
                                  <SelectTrigger size="sm" className={`min-w-[200px] text-xs ${isDark ? "border-white/10 bg-white/5 text-white [&_svg]:text-white/50" : ""}`}>
                                    <SelectValue/>
                                  </SelectTrigger>
                                  <SelectContent className={isDark ? "border-white/10 bg-zinc-950 text-white" : ""}>
                                    {(Object.entries(CATEGORY_LABELS) as [ReportCategory, string][]).map(([k, v]) => (<SelectItem key={k} value={k} className={`text-xs ${isDark ? "focus:bg-white/10 focus:text-white data-highlighted:bg-white/10 data-highlighted:text-white" : ""}`}>
                                        {v}
                                      </SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>)}

                            <div className="mt-3 pt-3 border-t border-border/50">
                                {expandedNote === report.id ? (
                                    <div className="flex items-start gap-2">
                                        <textarea
                                            className={`flex-1 min-h-[60px] text-xs p-2 rounded-lg resize-none ${isDark ? "bg-black/20 border-white/10 text-white" : "bg-gray-50 border-gray-200"}`}
                                            placeholder="Add internal staff note..."
                                            value={notes[report.id] || ""}
                                            onChange={(e) => setNotes({ ...notes, [report.id]: e.target.value })}
                                        />
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleAddNote(report.id)}
                                                disabled={saving === `note_${report.id}` || !notes[report.id]?.trim()}
                                                className="h-7 px-3 text-[10px] font-medium rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                                            >
                                                {saving === `note_${report.id}` ? "Saving" : "Save"}
                                            </button>
                                            <button
                                                onClick={() => setExpandedNote(null)}
                                                className="h-7 px-3 text-[10px] font-medium rounded border border-border hover:bg-muted"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setExpandedNote(report.id)}
                                        className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
                                    >
                                        <MessageSquare className="h-3 w-3" /> Add Internal Note
                                    </button>
                                )}
                            </div>
                        </div>);
                    })}
                </div>
            )}
        </div>
    );
}
