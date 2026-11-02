"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, CheckCircle, ShieldAlert, Copy, Check, MessageSquare, AlertTriangle, ShieldCheck, Clock, Wrench, Shield, Search, Filter, Eye, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MapPin, Image, Calendar, User, MoreHorizontal, Trash2, RefreshCw, Download, Undo, Sparkles, ExternalLink, Maximize2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, type ReportCategory } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import StatusUpdateDialog, { type StaffStatus } from "@/components/status-update-dialog";
import { ImageLightbox } from "@/components/image-lightbox";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending", color: "text-amber-500" },
    { value: "verified", label: "Verified", color: "text-emerald-500" },
    { value: "in_progress", label: "In Progress", color: "text-emerald-500" },
    { value: "resolved", label: "Resolved", color: "text-emerald-500" },
];

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    pending: Clock,
    verified: CheckCircle,
    in_progress: Wrench,
    resolved: Shield,
};

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
    photo_url?: string;
    receipt_id?: string;
    lat?: number;
    lng?: number;
    severity?: number;
    reporter_id?: string;
    action_history?: {
        id: string;
        status: string;
        note: string;
        actor: string;
        created_at: string;
        photo_url?: string;
    }[];
}

export default function VerificationPanel({ role }: { role: "admin" | "staff" }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<Report[]>([]);
    const [filteredReports, setFilteredReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [filter, setFilter] = useState<"unreviewed" | "valid" | "spam" | "duplicate">("unreviewed");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "severity">("newest");
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [expandedNote, setExpandedNote] = useState<string | null>(null);
    const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
    const [detailModal, setDetailModal] = useState<Report | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [statusUpdateTarget, setStatusUpdateTarget] = useState<{ reportId: string; status: StaffStatus } | null>(null);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
    const [activeReportNotes, setActiveReportNotes] = useState<{
        id: string;
        author_id: string;
        author_role: "admin" | "staff";
        content: string;
        created_at: string;
    }[]>([]);
    const [newDetailNote, setNewDetailNote] = useState("");
    const [savingDetailNote, setSavingDetailNote] = useState(false);

    const loadReportNotes = async (reportId: string) => {
        try {
            const res = await fetch(`/api/reports/notes?report_id=${reportId}`);
            const data = await res.json();
            setActiveReportNotes(data.notes ?? []);
        } catch {
            setActiveReportNotes([]);
        }
    };

    useEffect(() => {
        if (detailModal?.id) {
            loadReportNotes(detailModal.id);
        } else {
            setActiveReportNotes([]);
        }
    }, [detailModal]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?limit=500`);
            const data = await res.json();
            const allReports = data.reports ?? [];
            setReports(allReports);

            applyFilters(allReports, searchQuery, categoryFilter, sortBy);

            // Auto-open report from URL search param if present
            const params = new URLSearchParams(window.location.search);
            const targetId = params.get("id");
            if (targetId) {
                const found = allReports.find((r: Report) => r.id === targetId);
                if (found) {
                    setDetailModal(found);
                }
            }
        } catch {
            setReports([]);
            setFilteredReports([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (reportsToFilter: Report[], query: string, catFilter: string, sort: string, resetPage: boolean = true) => {
        // Exclude resolved and rejected complaints from verification queues (Staff 1.1)
        // Apply 7-day limit for unreviewed queue (Staff 1)
        let filtered = reportsToFilter.filter((r) => {
            if (r.status === "resolved" || r.status === "rejected") return false;
            if (filter === "unreviewed") {
                const reportTime = new Date(r.created_at || r.submitted_at || Date.now()).getTime();
                const isOlderThan7Days = (Date.now() - reportTime) > 7 * 24 * 60 * 60 * 1000;
                if (isOlderThan7Days) return false;
            }
            return r.verification_status === filter;
        });

        // Search filter
        if (query.trim()) {
            const q = query.toLowerCase();
            filtered = filtered.filter(r =>
                r.description?.toLowerCase().includes(q) ||
                r.id?.toLowerCase().includes(q) ||
                r.receipt_id?.toLowerCase().includes(q) ||
                r.category?.toLowerCase().includes(q)
            );
        }

        // Category filter
        if (catFilter !== "all") {
            filtered = filtered.filter(r => r.category === catFilter || r.admin_category === catFilter);
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (sort) {
                case "newest":
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case "oldest":
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case "severity":
                    return (b.severity || 0) - (a.severity || 0);
                default:
                    return 0;
            }
        });

        setFilteredReports(filtered);
        if (resetPage) {
            setCurrentPage(1); 
        }
    };

    // Get counts from full reports array
    const getCount = (status: string) => reports.filter(r => r.verification_status === status).length;

    useEffect(() => {
        loadReports();
    }, []);

    useEffect(() => {
        applyFilters(reports, searchQuery, categoryFilter, sortBy);
    }, [filter, searchQuery, categoryFilter, sortBy, reports]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedReports = filteredReports.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const goToPrevious = () => goToPage(currentPage - 1);
    const goToNext = () => goToPage(currentPage + 1);

    const handleVerify = async (reportId: string, status: "unreviewed" | "valid" | "spam" | "duplicate") => {
        setSaving(reportId);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    verification_status: status,
                    actor: role === "admin" ? "Admin" : "Staff",
                }),
            });

            const data = await res.json().catch(() => ({ error: "Server error" }));

            const statusLabels: Record<string, string> = {
                unreviewed: "Unreviewed",
                valid: "Valid",
                spam: "Spam",
                duplicate: "Duplicate"
            };
            toast.success(`Report marked as ${statusLabels[status]}`, {
                description: "The report has been moved to the appropriate queue."
            });

            // Remove from selection if it was selected
            if (selectedReports.has(reportId)) {
                const newSet = new Set(selectedReports);
                newSet.delete(reportId);
                setSelectedReports(newSet);
            }

            await loadReports();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error("Failed to verify report", {
                description: message
            });
            console.error("Verification error:", error);
        } finally {
            setSaving(null);
        }
    };

    const handleRejectReport = async (reportId: string) => {
        setSaving(reportId);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    status: "rejected",
                    verification_status: "spam",
                    actor: role === "admin" ? "Admin" : "Staff",
                    note: "Report rejected by verification team.",
                }),
            });
            if (res.ok) {
                toast.success("Report rejected & removed from queue", {
                    description: "User notification dispatched."
                });
                fetch("/api/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recipient_role: "user",
                        type: "warning",
                        title: "Report Status Update: Rejected",
                        message: `Your report (ID: ${reportId.slice(0, 8)}) was reviewed and rejected.`,
                        report_id: reportId,
                    })
                }).catch(() => {});
            }
            await loadReports();
        } catch {
            toast.error("Failed to reject report");
        } finally {
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

    const handleStatusUpdate = async (reportId: string, newStatus: string) => {
        // Open the status update dialog so the staff/admin can attach a photo + note.
        setStatusUpdateTarget({ reportId, status: newStatus as StaffStatus });
    };

    const submitStatusUpdate = async ({ reportId, status, note, photoDataUrl }: { reportId: string; status: StaffStatus; note: string; photoDataUrl: string | null }) => {
        setSaving(`status_${reportId}`);
        try {
            const res = await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    status,
                    actor: role === "admin" ? "Admin" : "Staff",
                    note,
                    photo_url: photoDataUrl ?? undefined,
                }),
            });
            const data = await res.json().catch(() => ({ error: "Server error" }));
            if (!res.ok) {
                throw new Error(typeof data?.error === "string" ? data.error : "Status update failed.");
            }
            toast.success(`Report marked as ${status.replace("_", " ")}`, {
                description: photoDataUrl ? "Photo attached to the action history." : undefined,
            });
            setStatusUpdateTarget(null);
            await loadReports();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Status update failed.";
            toast.error("Couldn't update status", { description: msg });
        }
        finally {
            setSaving(null);
        }
    };

    const handleBulkVerify = async (status: "valid" | "spam" | "duplicate") => {
        if (selectedReports.size === 0) return;
        setSaving("bulk");
        const count = selectedReports.size;
        try {
            const promises = Array.from(selectedReports).map(async (id) => {
                const res = await fetch("/api/reports", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        report_id: id,
                        verification_status: status,
                        actor: role === "admin" ? "Admin" : "Staff",
                    }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({ error: "Server error" }));
                    throw new Error(`Report ${id.slice(0, 8)}: ${data.error || res.status}`);
                }
                return res.json();
            });

            await Promise.all(promises);

            const statusLabels: Record<string, string> = {
                valid: "Valid",
                spam: "Spam",
                duplicate: "Duplicate"
            };
            toast.success(`${count} reports marked as ${statusLabels[status]}`, {
                description: "All selected reports have been processed."
            });

            setSelectedReports(new Set());
            await loadReports();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error("Failed to process reports", {
                description: message
            });
            console.error("Bulk verification error:", error);
        } finally {
            setSaving(null);
        }
    };

    const toggleSelectReport = (id: string) => {
        const newSet = new Set(selectedReports);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedReports(newSet);
    };

    const selectAll = () => {
        if (selectedReports.size === filteredReports.length) {
            setSelectedReports(new Set());
        } else {
            setSelectedReports(new Set(filteredReports.map(r => r.id)));
        }
    };

    const exportFiltered = () => {
        const data = filteredReports.map(r => ({
            id: r.id,
            receipt_id: r.receipt_id,
            category: r.category,
            status: r.status,
            verification_status: r.verification_status,
            description: r.description,
            created_at: r.created_at,
            severity: r.severity,
        }));
        const csv = [
            ["ID", "Receipt ID", "Category", "Status", "Verification", "Description", "Created At", "Severity"].join(","),
            ...data.map(r => [
                r.id, r.receipt_id, r.category, r.status, r.verification_status,
                `"${(r.description || "").replace(/"/g, '""')}"`, r.created_at, r.severity
            ].join(","))
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reports-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const allCategories = Array.from(new Set(reports.flatMap(r => [r.category, r.admin_category].filter(Boolean))));

    return (
        <div className="space-y-4">
            {/* Status Filter Tabs - Responsive Grid that never clips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-black/10 dark:bg-black/30 border border-white/5 w-full">
                {["unreviewed", "valid", "spam", "duplicate"].map((f) => {
                    const count = getCount(f);
                    const isActive = filter === f;
                    return (
                        <button
                            key={f}
                            onClick={() => { setFilter(f as "unreviewed" | "valid" | "spam" | "duplicate"); setCurrentPage(1); }}
                            className={`px-2 py-2 text-xs font-semibold rounded-lg capitalize transition-all flex items-center justify-center gap-1.5 min-w-0 ${
                                isActive
                                    ? isDark
                                        ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm"
                                        : "bg-white shadow text-emerald-800 border border-emerald-200"
                                    : isDark
                                        ? "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                            <span className="truncate">{f}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                isActive
                                    ? isDark
                                        ? "bg-emerald-400/30 text-emerald-100"
                                        : "bg-emerald-100 text-emerald-800"
                                    : isDark
                                        ? "bg-white/10 text-white/60"
                                        : "bg-gray-200 text-gray-700"
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search and Action Toolbar */}
            <div className="flex flex-col gap-2">
                <div className="relative w-full">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                    <Input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search reports or tracking code..."
                        className={`pl-9 pr-8 h-9 text-xs rounded-xl ${isDark ? "bg-white/[0.03] border-white/10 focus:border-emerald-500/50" : "bg-white border-gray-200"}`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${isDark ? "text-white/40 hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                            showFilters
                                ? isDark
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isDark
                                    ? "bg-white/[0.03] text-white/60 hover:bg-white/[0.08] border-white/10"
                                    : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
                        }`}
                    >
                        <Filter className="h-3 w-3" />
                        <span>Filter & Sort</span>
                        {(categoryFilter !== "all" || sortBy !== "newest") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                    </button>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={loadReports}
                            disabled={loading}
                            className={`flex items-center justify-center h-8 px-2 rounded-lg border text-xs gap-1 transition-colors ${
                                isDark ? "bg-white/[0.03] text-white/60 hover:bg-white/[0.08] border-white/10" : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
                            }`}
                            title="Refresh queue"
                        >
                            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                            <span className="text-[11px]">Refresh</span>
                        </button>
                        <button
                            onClick={exportFiltered}
                            className={`flex items-center justify-center h-8 px-2 rounded-lg border text-xs gap-1 transition-colors ${
                                isDark ? "bg-white/[0.03] text-white/60 hover:bg-white/[0.08] border-white/10" : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
                            }`}
                            title="Export to CSV"
                        >
                            <Download className="h-3 w-3" />
                            <span className="text-[11px]">Export</span>
                        </button>
                    </div>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Category:</span>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className={`w-[150px] text-xs ${isDark ? "bg-white/5 border-white/10" : ""}`}>
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent className={isDark ? "bg-zinc-900 border-white/10" : ""}>
                                        <SelectItem value="all">All categories</SelectItem>
                                        {allCategories.map(cat => (
                                            <SelectItem key={cat} value={cat || "other"}>
                                                {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>Sort by:</span>
                                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "oldest" | "severity")}>
                                    <SelectTrigger className={`w-[130px] text-xs ${isDark ? "bg-white/5 border-white/10" : ""}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className={isDark ? "bg-zinc-900 border-white/10" : ""}>
                                        <SelectItem value="newest">Newest first</SelectItem>
                                        <SelectItem value="oldest">Oldest first</SelectItem>
                                        <SelectItem value="severity">Severity (high-low)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(searchQuery || categoryFilter !== "all") && (
                                <button
                                    onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }}
                                    className={`text-xs ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedReports.size > 0 && filter === "unreviewed" && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-[#e6f4ea] border-emerald-100"}`}>
                    <span className={`text-sm font-semibold ${isDark ? "text-emerald-300" : "text-[#047857]"}`}>
                        {selectedReports.size} selected
                    </span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBulkVerify("valid")}
                        disabled={saving === "bulk"}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                        {saving === "bulk" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Mark Valid
                    </button>
                    <button
                        onClick={() => handleBulkVerify("spam")}
                        disabled={saving === "bulk"}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-all"
                    >
                        <ShieldAlert className="h-3 w-3" />
                        Mark Spam
                    </button>
                    <button
                        onClick={() => handleBulkVerify("duplicate")}
                        disabled={saving === "bulk"}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-all"
                    >
                        <Copy className="h-3 w-3" />
                        Mark Duplicate
                    </button>
                    <button
                        onClick={() => setSelectedReports(new Set())}
                        className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Results Count and Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        Showing {filteredReports.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredReports.length)} of {filteredReports.length} reports
                    </span>
                    {/* Items per page selector */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>Per page:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                            <SelectTrigger className={`w-[60px] h-7 text-xs ${isDark ? "bg-white/5 border-white/10" : ""}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={isDark ? "bg-zinc-900 border-white/10" : ""}>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {filter === "unreviewed" && filteredReports.length > 0 && (
                    <button
                        onClick={selectAll}
                        className={`text-xs ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                    >
                        {selectedReports.size === filteredReports.length ? "Deselect all" : "Select all"}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin opacity-50" />
                </div>
            ) : filteredReports.length === 0 ? (
                <div className={`p-8 text-center text-sm rounded-xl border border-dashed ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                    {searchQuery || categoryFilter !== "all" ? "No reports match your filters." : "No reports in this queue."}
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedReports.map((report) => {
                        const rawCat = (report.admin_category || report.category) as string;
                        const categorySelectValue: ReportCategory = rawCat in CATEGORY_LABELS
                            ? (rawCat as ReportCategory)
                            : "other";
                        const isSelected = selectedReports.has(report.id);
                        return (<div key={report.id} className={`rounded-xl border p-4 transition-colors ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-white"} ${isSelected ? (isDark ? "ring-1 ring-emerald-500/50" : "ring-1 ring-emerald-300") : ""}`}>
                            <div className="flex items-start gap-3">
                                {/* Selection Checkbox */}
                                {filter === "unreviewed" && (
                                    <button
                                        onClick={() => toggleSelectReport(report.id)}
                                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                            isSelected
                                                ? "bg-emerald-500 border-emerald-500 text-white"
                                                : isDark
                                                ? "border-white/30 hover:border-white/50"
                                                : "border-gray-300 hover:border-gray-400"
                                        }`}
                                    >
                                        {isSelected && <Check className="h-3.5 w-3.5" />}
                                    </button>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className={isDark ? "border-white/10 text-white/70" : ""}>
                                            {CATEGORY_LABELS[(report.admin_category || report.category) as ReportCategory] || report.category}
                                        </Badge>
                                        {report.ai_category && (
                                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] gap-1">
                                                <Sparkles className="h-3 w-3" />
                                                AI: {CATEGORY_LABELS[report.ai_category as ReportCategory] || report.ai_category}
                                            </Badge>
                                        )}
                                        {report.is_flagged && (
                                            <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                                                <AlertTriangle className="h-3 w-3 mr-1" /> Flagged
                                            </Badge>
                                        )}
                                        {report.severity && report.severity >= 4 && (
                                            <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                                                High Severity
                                            </Badge>
                                        )}
                                        <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                            {new Date(report.submitted_at || report.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm mt-2 font-medium break-all ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                        {report.description || <span className="italic opacity-50">No description provided</span>}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        {report.receipt_id && (
                                            <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-600"}`}>
                                                {report.receipt_id}
                                            </code>
                                        )}
                                        <button
                                            onClick={() => setDetailModal(report)}
                                            className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                        >
                                            <Eye className="h-3 w-3" /> View Details
                                        </button>
                                    </div>
                                    {report.is_flagged && (
                                        <p className="text-[10px] text-red-400 mt-1">
                                            Reason: {report.flag_reason}
                                        </p>
                                    )}
                                    {report.photo_url && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLightboxImage({ src: report.photo_url!, alt: `Report ${report.receipt_id || report.id} Attachment` });
                                            }}
                                            className="group mt-3 relative rounded-lg overflow-hidden border max-w-xs h-32 bg-muted flex items-center justify-center cursor-zoom-in"
                                            title="Click to view full screen"
                                        >
                                            <img
                                                src={report.photo_url}
                                                alt="Report attachment"
                                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop";
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[1px]">
                                                <Maximize2 className="h-3.5 w-3.5" />
                                                Full screen
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {filter === "unreviewed" && (
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dashed border-border/50">
                                    <button
                                        onClick={() => handleVerify(report.id, "valid")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                    >
                                        {saving === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        Mark Valid
                                    </button>
                                    <button
                                        onClick={() => handleVerify(report.id, "spam")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                    >
                                        <ShieldAlert className="h-3.5 w-3.5" /> Mark Spam
                                    </button>
                                    <button
                                        onClick={() => handleVerify(report.id, "duplicate")}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                    >
                                        <Copy className="h-3.5 w-3.5" /> Duplicate
                                    </button>
                                    <button
                                        onClick={() => handleRejectReport(report.id)}
                                        disabled={saving === report.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                        title="Reject report and notify user"
                                    >
                                        <X className="h-3.5 w-3.5 text-red-400" /> Reject
                                    </button>
                                </div>
                            )}

                            {/* Status Update for verified reports */}
                            {filter !== "unreviewed" && report.verification_status === "valid" && (
                                <div className="mt-4 pt-3 border-t border-dashed border-border/50">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] ${isDark ? "text-white/50" : "text-gray-500"}`}>Update Status:</span>
                                        <div className="flex gap-1 flex-wrap">
                                            {STATUS_OPTIONS.map((option) => {
                                                const Icon = STATUS_ICONS[option.value];
                                                const isCurrentStatus = report.status === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => !isCurrentStatus && handleStatusUpdate(report.id, option.value)}
                                                        disabled={saving === `status_${report.id}` || isCurrentStatus}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors ${
                                                            isCurrentStatus
                                                                ? isDark
                                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                                    : "bg-[#e6f4ea] text-[#047857] border border-emerald-200"
                                                                : isDark
                                                                ? "bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                                        }`}
                                                    >
                                                        {saving === `status_${report.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className={`h-3 w-3 ${option.color}`} />}
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {filter !== "unreviewed" && (
                                <div className="mt-3 pt-3 border-t border-dashed border-border/50 flex items-center justify-between gap-4">
                                    <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                        Currently marked as <strong className="capitalize text-emerald-400">{report.verification_status}</strong>
                                    </span>
                                    <button
                                        onClick={() => handleVerify(report.id, "unreviewed")}
                                        disabled={saving === report.id}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                                            isDark
                                                ? "border-white/10 hover:bg-white/5 text-white/80"
                                                : "border-gray-200 hover:bg-gray-50 text-gray-700"
                                        }`}
                                    >
                                        <Undo className="h-3.5 w-3.5" />
                                        {saving === report.id ? "Reverting…" : "Undo / Revert to Unreviewed"}
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

                            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                                {report.action_history && report.action_history.filter(a => a.note).length > 0 && (
                                    <div className="space-y-1.5 mb-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-emerald-400" : "text-[#059669]"}`}>
                                            📝 Internal Notes ({report.action_history.filter(a => a.note).length}):
                                        </span>
                                        {report.action_history.filter(a => a.note).map((a, idx) => (
                                            <div key={idx} className={`p-2 rounded-lg text-xs border ${isDark ? "bg-white/[0.03] border-white/10 text-white/80" : "bg-emerald-50/60 border-emerald-100 text-[#064e3b]"}`}>
                                                <span className="font-semibold">{a.actor}:</span> {a.note}
                                                <span className={`block text-[9px] mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>{new Date(a.created_at).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                                className="h-7 px-3 text-[10px] font-medium rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
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
                                        className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                    >
                                        <MessageSquare className="h-3 w-3" /> Add Internal Note
                                    </button>
                                )}
                            </div>
                        </div>);
                    })}
                </div>
            )}

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className={`flex items-center justify-between pt-4 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
                    <button
                        onClick={goToPrevious}
                        disabled={currentPage === 1}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            currentPage === 1
                                ? isDark ? "text-white/30" : "text-gray-400"
                                : isDark ? "text-white/70 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Show pages around current page
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }

                            const isActive = pageNum === currentPage;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => goToPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                        isActive
                                            ? isDark ? "bg-[#e6f4ea]0 text-white" : "bg-[#047857] text-white"
                                            : isDark ? "text-white/70 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        {totalPages > 5 && currentPage < totalPages - 2 && (
                            <>
                                <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>...</span>
                                <button
                                    onClick={() => goToPage(totalPages)}
                                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                        isDark ? "text-white/70 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    {totalPages}
                                </button>
                            </>
                        )}
                    </div>

                    <button
                        onClick={goToNext}
                        disabled={currentPage === totalPages}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            currentPage === totalPages
                                ? isDark ? "text-white/30" : "text-gray-400"
                                : isDark ? "text-white/70 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Detail Modal — portalled to body to escape sidebar's backdrop-blur containing block */}
            {detailModal && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "bg-[#0c1615] border-white/10" : "bg-white border-gray-200"}`}>
                        {/* Header */}
                        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-100 bg-gray-50/70"}`}>
                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                <h2 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Report Details</h2>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isDark ? "border-white/10 text-white/70" : ""}`}>
                                    {CATEGORY_LABELS[(detailModal.admin_category || detailModal.category) as ReportCategory] || detailModal.category}
                                </Badge>
                                {detailModal.ai_category && (
                                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-1.5 py-0 gap-1">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        AI: {CATEGORY_LABELS[detailModal.ai_category as ReportCategory] || detailModal.ai_category}
                                    </Badge>
                                )}
                            </div>
                            <button
                                onClick={() => setDetailModal(null)}
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ml-2 ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body - 2 Columns */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Left Column: Info, Details & Meta (col-span-7) */}
                                <div className="md:col-span-7 space-y-3">
                                    {/* Report ID, Tracking & Statuses */}
                                    <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Report ID</span>
                                                <p className={`font-mono text-xs truncate mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>{detailModal.id}</p>
                                            </div>
                                            {detailModal.receipt_id && (
                                                <div>
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Tracking Code</span>
                                                    <p className={`font-mono text-xs truncate mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>{detailModal.receipt_id}</p>
                                                </div>
                                            )}
                                            <div>
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Submitted</span>
                                                <p className={`text-xs mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                    {new Date(detailModal.submitted_at || detailModal.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </p>
                                            </div>
                                            <div>
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Status</span>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <Badge className={`text-[10px] px-1.5 py-0 capitalize ${
                                                        detailModal.verification_status === "valid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                        detailModal.verification_status === "spam" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                        detailModal.verification_status === "duplicate" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                                    }`}>
                                                        {detailModal.verification_status}
                                                    </Badge>
                                                    <Badge className={`text-[10px] px-1.5 py-0 capitalize ${
                                                        detailModal.status === "resolved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                        detailModal.status === "in_progress" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                        "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                    }`}>
                                                        {detailModal.status.replace("_", " ")}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className={`p-3.5 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <h3 className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>Description</h3>
                                        <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                            {detailModal.description || <span className="italic opacity-50">No description provided</span>}
                                        </p>
                                    </div>

                                    {/* Severity */}
                                    {detailModal.severity && (
                                        <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>Severity</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map((i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-5 h-1.5 rounded-full ${
                                                                i <= (detailModal.severity || 0)
                                                                    ? i >= 4 ? "bg-red-500" : i >= 3 ? "bg-orange-500" : "bg-emerald-500"
                                                                    : isDark ? "bg-white/10" : "bg-gray-200"
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                                <span className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                    {detailModal.severity}/5
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Location */}
                                    {(detailModal.lat || detailModal.lng) && (
                                        <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <div>
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Location</span>
                                                <p className={`font-mono text-xs mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                    {detailModal.lat?.toFixed(6)}, {detailModal.lng?.toFixed(6)}
                                                </p>
                                            </div>
                                            <a
                                                href={`https://www.google.com/maps?q=${detailModal.lat},${detailModal.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                            >
                                                <MapPin className="h-3 w-3" />
                                                Google Maps
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Photo Evidence, History & Notes (col-span-5) */}
                                <div className="md:col-span-5 space-y-3">
                                    {/* Photo Evidence */}
                                    {detailModal.photo_url ? (
                                        <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>Photo Evidence</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setLightboxImage({ src: detailModal.photo_url!, alt: `Report ${detailModal.receipt_id || detailModal.id} Evidence` })}
                                                    className="text-[11px] text-emerald-500 hover:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium transition-colors"
                                                >
                                                    <Maximize2 className="h-3 w-3" />
                                                    Full screen
                                                </button>
                                            </div>
                                            <div
                                                onClick={() => setLightboxImage({ src: detailModal.photo_url!, alt: `Report ${detailModal.receipt_id || detailModal.id} Evidence` })}
                                                className="group relative rounded-lg overflow-hidden bg-black/30 border border-white/5 h-40 flex items-center justify-center cursor-zoom-in"
                                                title="Click to view full screen"
                                            >
                                                <img
                                                    src={detailModal.photo_url}
                                                    alt="Report evidence"
                                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[1px]">
                                                    <Maximize2 className="h-4 w-4" />
                                                    View Fullscreen
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`p-3 rounded-xl border text-center py-5 ${isDark ? "bg-white/[0.02] border-white/10 text-white/40" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                                            <p className="text-xs">No photo evidence attached</p>
                                        </div>
                                    )}

                                    {/* Action History */}
                                    {detailModal.action_history && detailModal.action_history.length > 0 && (
                                        <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>Action History</h3>
                                            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                                {detailModal.action_history.map((action, i) => (
                                                    <div key={i} className={`p-2 rounded-lg border text-xs ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-gray-200"}`}>
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className={`font-semibold capitalize text-[11px] ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                                {action.status.replace("_", " ")}
                                                            </span>
                                                            <span className={`text-[9px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                                by {action.actor}
                                                            </span>
                                                        </div>
                                                        {action.note && (
                                                            <p className={`text-[11px] ${isDark ? "text-white/60" : "text-gray-600"}`}>{action.note}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Internal Notes Timeline and Form */}
                                    <div className={`p-3 rounded-xl border space-y-2.5 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                                Internal Notes ({activeReportNotes.length})
                                            </h3>
                                            <span className="text-[9px] text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                                Staff Only
                                            </span>
                                        </div>

                                        {activeReportNotes.length === 0 ? (
                                            <p className={`text-xs italic py-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                No internal notes yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                                {activeReportNotes.map((note) => (
                                                    <div
                                                        key={note.id}
                                                        className={`p-2 rounded-lg border text-xs ${
                                                            note.author_role === "admin"
                                                                ? isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#e6f4ea]/50 border-emerald-100"
                                                                : isDark ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className={`font-semibold capitalize flex items-center gap-1 ${
                                                                note.author_role === "admin" ? "text-emerald-400" : "text-gray-400"
                                                            }`}>
                                                                {note.author_id}
                                                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 capitalize">
                                                                    {note.author_role}
                                                                </Badge>
                                                            </span>
                                                            <span className={`text-[9px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                                                {new Date(note.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className={`text-[11px] leading-relaxed ${isDark ? "text-white/80" : "text-gray-700"}`}>{note.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-1.5 pt-1">
                                            <textarea
                                                value={newDetailNote}
                                                onChange={(e) => setNewDetailNote(e.target.value)}
                                                placeholder={`Add note...`}
                                                rows={1}
                                                className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg resize-none outline-none focus:ring-1 focus:ring-emerald-500/30 ${
                                                    isDark ? "bg-white/[0.03] border border-white/10 text-white placeholder-white/30" : "bg-white border border-gray-200 text-gray-900 placeholder-gray-400"
                                                }`}
                                            />
                                            <button
                                                disabled={savingDetailNote || !newDetailNote.trim()}
                                                onClick={async () => {
                                                    if (!newDetailNote.trim()) return;
                                                    setSavingDetailNote(true);
                                                    try {
                                                        await fetch("/api/reports/notes", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                report_id: detailModal.id,
                                                                author: role === "admin" ? "Admin" : "Staff",
                                                                author_role: role,
                                                                content: newDetailNote.trim(),
                                                            }),
                                                        });
                                                        setNewDetailNote("");
                                                        await loadReportNotes(detailModal.id);
                                                        toast.success("Note saved successfully.");
                                                    } catch {
                                                        toast.error("Failed to save note.");
                                                    } finally {
                                                        setSavingDetailNote(false);
                                                    }
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shrink-0"
                                            >
                                                {savingDetailNote ? "Saving" : "Post"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className={`flex items-center gap-2 px-5 py-3 border-t shrink-0 ${isDark ? "border-white/10 bg-white/[0.01]" : "border-gray-100 bg-gray-50/60"}`}>
                            {filter === "unreviewed" && detailModal.verification_status === "unreviewed" && (
                                <>
                                    <button
                                        onClick={() => { handleVerify(detailModal.id, "valid"); setDetailModal(null); }}
                                        disabled={saving === detailModal.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                    >
                                        {saving === detailModal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        Mark as Valid
                                    </button>
                                    <button
                                        onClick={() => { handleVerify(detailModal.id, "spam"); setDetailModal(null); }}
                                        disabled={saving === detailModal.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    >
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Mark as Spam
                                    </button>
                                    <button
                                        onClick={() => { handleRejectReport(detailModal.id); setDetailModal(null); }}
                                        disabled={saving === detailModal.id}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-zinc-800/80 text-white hover:bg-red-700 transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5 text-red-400" />
                                        Reject Report
                                    </button>
                                </>
                            )}
                            {detailModal.verification_status === "valid" && (
                                <div className="flex-1 flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Update Status:</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {STATUS_OPTIONS.map((option) => {
                                            const Icon = STATUS_ICONS[option.value];
                                            const isCurrentStatus = detailModal.status === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        handleStatusUpdate(detailModal.id, option.value);
                                                    }}
                                                    disabled={saving === `status_${detailModal.id}` || isCurrentStatus}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                                        isCurrentStatus
                                                            ? isDark
                                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                                : "bg-[#e6f4ea] text-[#047857] border border-emerald-200"
                                                            : isDark
                                                            ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1]"
                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    <Icon className={`h-3 w-3 ${option.color}`} />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => setDetailModal(null)}
                                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ml-auto ${isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-900"}`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {typeof document !== "undefined" && createPortal(
                <StatusUpdateDialog
                    open={Boolean(statusUpdateTarget)}
                    reportId={statusUpdateTarget?.reportId ?? ""}
                    targetStatus={statusUpdateTarget?.status ?? null}
                    onCancel={() => setStatusUpdateTarget(null)}
                    onSubmit={submitStatusUpdate}
                />,
            document.body)}
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
