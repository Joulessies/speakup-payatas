"use client";
import { useState, useEffect } from "react";
import { Loader2, CheckCircle, ShieldAlert, Copy, Check, MessageSquare, AlertTriangle, ShieldCheck, Clock, Wrench, Shield, Search, Filter, Eye, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MapPin, Image, Calendar, User, MoreHorizontal, Trash2, RefreshCw, Download } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, type ReportCategory } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import StatusUpdateDialog, { type StaffStatus } from "@/components/status-update-dialog";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending", color: "text-amber-500" },
    { value: "verified", label: "Verified", color: "text-blue-500" },
    { value: "in_progress", label: "In Progress", color: "text-indigo-500" },
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

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports?limit=500`);
            const data = await res.json();
            const allReports = data.reports ?? [];
            setReports(allReports);

            applyFilters(allReports, searchQuery, categoryFilter, sortBy);
        } catch {
            setReports([]);
            setFilteredReports([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (reportsToFilter: Report[], query: string, catFilter: string, sort: string, resetPage: boolean = true) => {
        // Always honor the active verification_status tab so reports correctly leave the list after being marked.
        let filtered = reportsToFilter.filter((r) => r.verification_status === filter);

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

    const handleVerify = async (reportId: string, status: "valid" | "spam" | "duplicate") => {
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
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 w-fit">
                {["unreviewed", "valid", "spam", "duplicate"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                            filter === f ? (isDark ? "bg-white/10 text-white" : "bg-white shadow text-gray-900") : (isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-900")
                        }`}
                    >
                        {f} ({getCount(f)})
                    </button>
                ))}
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by description, ID, or tracking code..."
                            className={`pl-10 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg transition-colors ${showFilters ? (isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900") : (isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-600")}`}
                    >
                        <Filter className="h-4 w-4" />
                    </button>
                    <button
                        onClick={loadReports}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-600"}`}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={exportFiltered}
                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-gray-100 text-gray-600"}`}
                        title="Export to CSV"
                    >
                        <Download className="h-4 w-4" />
                    </button>
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
                                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
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
                                    className={`text-xs ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
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
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"}`}>
                    <span className={`text-sm font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
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
                        className={`text-xs ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
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
                        return (<div key={report.id} className={`rounded-xl border p-4 transition-colors ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-white"} ${isSelected ? (isDark ? "ring-1 ring-indigo-500/50" : "ring-1 ring-indigo-300") : ""}`}>
                            <div className="flex items-start gap-3">
                                {/* Selection Checkbox */}
                                {filter === "unreviewed" && (
                                    <button
                                        onClick={() => toggleSelectReport(report.id)}
                                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                            isSelected
                                                ? "bg-indigo-500 border-indigo-500 text-white"
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
                                            {CATEGORY_LABELS[report.admin_category || report.category as keyof typeof CATEGORY_LABELS] || report.category}
                                        </Badge>
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
                                    <p className={`text-sm mt-2 font-medium ${isDark ? "text-white/90" : "text-gray-800"}`}>
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
                                            className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
                                        >
                                            <Eye className="h-3 w-3" /> View Details
                                        </button>
                                    </div>
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
                                                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                                                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
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
                                            ? isDark ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"
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

            {/* Detail Modal */}
            {detailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}>
                        <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
                            <div className="flex items-center gap-3">
                                <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Report Details</h2>
                                <Badge variant="outline" className={isDark ? "border-white/10 text-white/70" : ""}>
                                    {CATEGORY_LABELS[detailModal.admin_category || detailModal.category as keyof typeof CATEGORY_LABELS] || detailModal.category}
                                </Badge>
                            </div>
                            <button
                                onClick={() => setDetailModal(null)}
                                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                            >
                                <X className={`h-5 w-5 ${isDark ? "text-white/60" : "text-gray-600"}`} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Report ID and Tracking */}
                            <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Report ID</span>
                                        <p className={`font-mono ${isDark ? "text-white/80" : "text-gray-700"}`}>{detailModal.id}</p>
                                    </div>
                                    {detailModal.receipt_id && (
                                        <div>
                                            <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Tracking Code</span>
                                            <p className={`font-mono ${isDark ? "text-white/80" : "text-gray-700"}`}>{detailModal.receipt_id}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Submitted</span>
                                        <p className={isDark ? "text-white/80" : "text-gray-700"}>
                                            {new Date(detailModal.submitted_at || detailModal.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Status</span>
                                        <div className="flex items-center gap-2">
                                            <Badge className={`
                                                ${detailModal.verification_status === "valid" ? "bg-emerald-500/10 text-emerald-500" : ""}
                                                ${detailModal.verification_status === "spam" ? "bg-red-500/10 text-red-500" : ""}
                                                ${detailModal.verification_status === "duplicate" ? "bg-amber-500/10 text-amber-500" : ""}
                                                ${detailModal.verification_status === "unreviewed" ? "bg-blue-500/10 text-blue-500" : ""}
                                            `}>
                                                {detailModal.verification_status}
                                            </Badge>
                                            <Badge className={`
                                                ${detailModal.status === "resolved" ? "bg-emerald-500/10 text-emerald-500" : ""}
                                                ${detailModal.status === "in_progress" ? "bg-indigo-500/10 text-indigo-500" : ""}
                                                ${detailModal.status === "pending" ? "bg-amber-500/10 text-amber-500" : ""}
                                            `}>
                                                {detailModal.status.replace("_", " ")}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>Description</h3>
                                <p className={`text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                    {detailModal.description || <span className="italic opacity-50">No description provided</span>}
                                </p>
                            </div>

                            {/* Severity */}
                            {detailModal.severity && (
                                <div>
                                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>Severity</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <div
                                                    key={i}
                                                    className={`w-8 h-2 rounded-full ${
                                                        i <= (detailModal.severity || 0)
                                                            ? i >= 4 ? "bg-red-500" : i >= 3 ? "bg-orange-500" : "bg-emerald-500"
                                                            : isDark ? "bg-white/10" : "bg-gray-200"
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                            {detailModal.severity}/5
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {(detailModal.lat || detailModal.lng) && (
                                <div>
                                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>Location</h3>
                                    <div className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                                        <MapPin className={`h-4 w-4 ${isDark ? "text-white/50" : "text-gray-500"}`} />
                                        <span className={`text-sm ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                            Lat: {detailModal.lat?.toFixed(6)}, Lng: {detailModal.lng?.toFixed(6)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Photo */}
                            {detailModal.photo_url && (
                                <div>
                                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>Photo Evidence</h3>
                                    <img
                                        src={detailModal.photo_url}
                                        alt="Report evidence"
                                        className="w-full max-h-64 object-contain rounded-xl border border-dashed"
                                    />
                                </div>
                            )}

                            {/* Action History */}
                            {detailModal.action_history && detailModal.action_history.length > 0 && (
                                <div>
                                    <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/50" : "text-gray-500"}`}>Action History</h3>
                                    <div className="space-y-2">
                                        {detailModal.action_history.map((action, i) => (
                                            <div key={i} className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                        {action.status.replace("_", " ")}
                                                    </span>
                                                    <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                        by {action.actor}
                                                    </span>
                                                </div>
                                                {action.note && (
                                                    <p className={`text-xs mt-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>{action.note}</p>
                                                )}
                                                {action.photo_url && (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={action.photo_url}
                                                        alt={`Update attachment for ${action.status}`}
                                                        className="mt-2 w-full max-h-48 object-cover rounded-lg border"
                                                    />
                                                )}
                                                <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                                    {new Date(action.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className={`flex items-center gap-2 p-4 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}>
                            {filter === "unreviewed" && detailModal.verification_status === "unreviewed" && (
                                <>
                                    <button
                                        onClick={() => { handleVerify(detailModal.id, "valid"); setDetailModal(null); }}
                                        disabled={saving === detailModal.id}
                                        className="flex-1 flex items-center justify-center gap-2 h-10 text-sm font-medium rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                    >
                                        {saving === detailModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                        Mark as Valid
                                    </button>
                                    <button
                                        onClick={() => { handleVerify(detailModal.id, "spam"); setDetailModal(null); }}
                                        disabled={saving === detailModal.id}
                                        className="flex-1 flex items-center justify-center gap-2 h-10 text-sm font-medium rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    >
                                        <ShieldAlert className="h-4 w-4" />
                                        Mark as Spam
                                    </button>
                                </>
                            )}
                            {detailModal.verification_status === "valid" && (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>Update Status:</span>
                                    <div className="flex gap-2 flex-wrap">
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
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                                        isCurrentStatus
                                                            ? isDark
                                                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                            : isDark
                                                            ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1]"
                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    <Icon className={`h-3.5 w-3.5 ${option.color}`} />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <StatusUpdateDialog
                open={Boolean(statusUpdateTarget)}
                reportId={statusUpdateTarget?.reportId ?? ""}
                targetStatus={statusUpdateTarget?.status ?? null}
                onCancel={() => setStatusUpdateTarget(null)}
                onSubmit={submitStatusUpdate}
            />
        </div>
    );
}
