"use client";
import { useState, useEffect } from "react";
import { Loader2, Search, Trash2, Edit, Eye, CheckCircle, XCircle, MoreHorizontal, X, MapPin, ExternalLink, Maximize2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_LABELS } from "@/types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ImageLightbox } from "@/components/image-lightbox";

interface Report {
    id: string;
    category: string;
    description: string;
    status: string;
    verification_status: string;
    created_at: string;
    reporter_hash: string;
    latitude: number;
    longitude: number;
    photo_url?: string;
}

export default function AdminReportsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [viewTarget, setViewTarget] = useState<Report | null>(null);
    const [editTarget, setEditTarget] = useState<Report | null>(null);
    const [statusTarget, setStatusTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
    const pageSize = 10;

    const totalPages = Math.ceil(reports.length / pageSize);
    const paginatedReports = reports.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/reports?limit=20000");
            const data = await res.json();
            const allReports = data.reports ?? [];
            setReports(allReports);

            const params = new URLSearchParams(window.location.search);
            const targetId = params.get("id");
            if (targetId) {
                const found = allReports.find((r: Report) => r.id === targetId);
                if (found) {
                    setViewTarget(found);
                }
            }
        } catch {
            toast.error("Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    const [adminNotes, setAdminNotes] = useState<{ id: string; author_id: string; author_role: string; content: string; created_at: string }[]>([]);
    const [newAdminNote, setNewAdminNote] = useState("");
    const [savingAdminNote, setSavingAdminNote] = useState(false);

    const loadAdminNotes = async (reportId: string) => {
        try {
            const res = await fetch(`/api/reports/notes?report_id=${reportId}`);
            const data = await res.json();
            setAdminNotes(data.notes ?? []);
        } catch {
            setAdminNotes([]);
        }
    };

    useEffect(() => {
        const targetId = viewTarget?.id || editTarget?.id;
        if (targetId) {
            loadAdminNotes(targetId);
        } else {
            setAdminNotes([]);
        }
    }, [viewTarget, editTarget]);

    const handleAddAdminNote = async (reportId: string) => {
        if (!newAdminNote.trim()) return;
        setSavingAdminNote(true);
        try {
            const res = await fetch("/api/reports/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    author: "Admin",
                    author_role: "admin",
                    content: newAdminNote.trim(),
                })
            });
            if (res.ok) {
                toast.success("Internal note added");
                setNewAdminNote("");
                loadAdminNotes(reportId);
            }
        } catch {
            toast.error("Failed to add note");
        } finally {
            setSavingAdminNote(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Report deleted successfully");
                setReports(reports.filter((r) => r.id !== id));
            } else {
                toast.error("Failed to delete report");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleStatusUpdate = async (id: string, status: string, verificationStatus: string) => {
        try {
            const res = await fetch(`/api/reports`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    report_id: id, 
                    status, 
                    verification_status: verificationStatus
                })
            });
            if (res.ok) {
                toast.success(`Report ${status === 'resolved' ? 'approved' : 'marked as spam'} successfully`);
                setReports(reports.map(r => 
                    r.id === id ? { ...r, status, verification_status: verificationStatus } : r
                ));
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to update report status");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setStatusTarget(null);
        }
    };

    const handleEdit = async (id: string, updates: Partial<Report>) => {
        try {
            const res = await fetch(`/api/reports`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    report_id: id,
                    ...updates
                })
            });
            if (res.ok) {
                toast.success("Report updated successfully");
                setReports(reports.map(r => 
                    r.id === id ? { ...r, ...updates } : r
                ));
                setEditTarget(null);
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to update report");
            }
        } catch {
            toast.error("Network error");
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-background" : "bg-gray-50"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Manage Reports
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Full CRUD access for all submitted reports.
                        </p>
                    </div>
                </div>

                <div className={`rounded-2xl border overflow-hidden shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className={`border-b ${isDark ? "border-white/10 text-white/50 bg-white/[0.02]" : "border-gray-200 text-gray-500 bg-gray-50"}`}>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">ID</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Category</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Verification</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Reporter</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto opacity-50" />
                                        </td>
                                    </tr>
                                ) : reports.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className={`p-8 text-center border-dashed border ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                                            No reports found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedReports.map((r) => (
                                        <tr key={r.id} className={`border-b last:border-0 transition-colors ${isDark ? "border-white/[0.06] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50"}`}>
                                            <td className={`p-4 font-mono text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                                {r.id.split("-")[0]}
                                            </td>
                                            <td className={`p-4 font-medium ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] || r.category}
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className={`text-[10px] capitalize ${r.status === "resolved" ? "text-emerald-500 border-emerald-500/20" : "text-amber-500 border-amber-500/20"}`}>
                                                    {r.status.replace("_", " ")}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className={`text-[10px] capitalize ${r.verification_status === "spam" ? "text-red-500 border-red-500/20" : r.verification_status === "valid" ? "text-emerald-500 border-emerald-500/20" : "text-gray-500 border-gray-500/20"}`}>
                                                    {r.verification_status}
                                                </Badge>
                                            </td>
                                            <td className={`p-4 font-mono text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                                {r.reporter_hash.slice(0, 8)}...
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setViewTarget(r)}
                                                        className="p-2 rounded-lg transition-colors text-emerald-500 hover:bg-emerald-500/10"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditTarget(r)}
                                                        className="p-2 rounded-lg transition-colors text-amber-500 hover:bg-amber-500/10"
                                                        title="Edit Report"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    {r.status !== 'resolved' && (
                                                        <button
                                                            onClick={() => setStatusTarget({ id: r.id, action: 'approve' })}
                                                            className="p-2 rounded-lg transition-colors text-emerald-500 hover:bg-emerald-500/10"
                                                            title="Approve Report"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {r.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => setStatusTarget({ id: r.id, action: 'reject' })}
                                                            className="p-2 rounded-lg transition-colors text-orange-500 hover:bg-orange-500/10"
                                                            title="Reject Report"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setDeleteTarget(r.id)}
                                                        className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
                                                        title="Delete Report"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {reports.length > pageSize && (
                    <div className="flex flex-col md:flex-row items-center justify-between pt-4 gap-4">
                        <div className={`text-sm text-center md:text-left ${isDark ? "text-white/50" : "text-gray-500"}`}>
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, reports.length)} of {reports.length} reports
                        </div>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                            >
                                Prev
                            </button>

                            <div className="flex items-center gap-1 px-1 flex-wrap justify-center">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                                    if (p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1) {
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === p
                                                    ? (isDark ? "bg-[#e6f4ea]0 text-white" : "bg-[#e6f4ea]0 text-white")
                                                    : (isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700")
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    }
                                    if (Math.abs(currentPage - p) === 2) {
                                        return <span key={p} className={`px-1 text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`w-full max-w-sm p-5 rounded-2xl shadow-2xl border ${isDark ? "bg-[#0c1615] border-white/10" : "bg-white border-gray-200"}`}>
                        <div className="flex items-start justify-between mb-3.5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                                    <Trash2 className="h-4.5 w-4.5 text-red-500" />
                                </div>
                                <div>
                                    <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                        Delete Report
                                    </h2>
                                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                        This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className={`text-xs mb-5 ${isDark ? "text-white/70" : "text-gray-600"}`}>
                            Are you sure you want to delete this report? This will remove all associated notes and records permanently.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {viewTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${isDark ? "bg-[#0c1615] border-white/10" : "bg-white border-gray-200"}`}>
                        {/* Header */}
                        <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-100 bg-gray-50/70"}`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                    <Eye className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className={`text-sm sm:text-base font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                                            Report Details
                                        </h2>
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${viewTarget.status === "resolved" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-amber-500 border-amber-500/30 bg-amber-500/5"}`}>
                                            {viewTarget.status.replace("_", " ")}
                                        </Badge>
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${viewTarget.verification_status === "spam" ? "text-red-500 border-red-500/30 bg-red-500/5" : viewTarget.verification_status === "valid" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-gray-400 border-gray-500/30"}`}>
                                            {viewTarget.verification_status}
                                        </Badge>
                                    </div>
                                    <p className={`text-[11px] font-mono truncate mt-0.5 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                        ID: {viewTarget.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewTarget(null)}
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ml-2 ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body - 2 Columns */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Left Column: Info & Details (col-span-7) */}
                                <div className="md:col-span-7 space-y-3">
                                    {/* Category Pill / Card */}
                                    <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Category</span>
                                        <p className={`text-sm font-semibold mt-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                                            {CATEGORY_LABELS[viewTarget.category as keyof typeof CATEGORY_LABELS] || viewTarget.category}
                                        </p>
                                    </div>

                                    {/* Description */}
                                    <div className={`p-3.5 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Description</span>
                                        <p className={`mt-1 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                            {viewTarget.description}
                                        </p>
                                    </div>

                                    {/* Coordinates & Location */}
                                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <div>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Coordinates</span>
                                            <p className={`font-mono text-xs mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                {viewTarget.latitude.toFixed(6)}, {viewTarget.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps?q=${viewTarget.latitude},${viewTarget.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                        >
                                            <MapPin className="h-3 w-3" />
                                            Google Maps
                                        </a>
                                    </div>

                                    {/* Created & Reporter Meta */}
                                    <div className={`p-3 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <div>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Submitted</span>
                                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                {new Date(viewTarget.created_at).toLocaleDateString()} at {new Date(viewTarget.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Reporter ID</span>
                                            <p className={`font-mono text-[11px] truncate mt-0.5 ${isDark ? "text-white/70" : "text-gray-700"}`} title={viewTarget.reporter_hash}>
                                                {viewTarget.reporter_hash ? `${viewTarget.reporter_hash.slice(0, 10)}...${viewTarget.reporter_hash.slice(-8)}` : "Anonymous"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Photo Evidence & Internal Notes (col-span-5) */}
                                <div className="md:col-span-5 space-y-3">
                                    {/* Photo Evidence */}
                                    {viewTarget.photo_url ? (
                                        <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>Photo Evidence</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setLightboxImage({ src: viewTarget.photo_url!, alt: `Report ${viewTarget.id} Evidence` })}
                                                    className="text-[11px] text-emerald-500 hover:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium transition-colors"
                                                >
                                                    <Maximize2 className="h-3 w-3" />
                                                    Full screen
                                                </button>
                                            </div>
                                            <div
                                                onClick={() => setLightboxImage({ src: viewTarget.photo_url!, alt: `Report ${viewTarget.id} Evidence` })}
                                                className="group relative rounded-lg overflow-hidden bg-black/30 border border-white/5 h-44 flex items-center justify-center cursor-zoom-in"
                                                title="Click to view full screen"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={viewTarget.photo_url}
                                                    alt="Report Evidence"
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

                                    {/* Internal Notes Section */}
                                    <div className={`p-3 rounded-xl border space-y-2.5 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                        <div className="flex items-center justify-between">
                                            <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                                Internal Notes ({adminNotes.length})
                                            </h3>
                                            <span className="text-[9px] text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                                Staff Only
                                            </span>
                                        </div>
                                        {adminNotes.length === 0 ? (
                                            <p className={`text-xs italic py-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>No internal notes yet.</p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                                {adminNotes.map((n) => (
                                                    <div key={n.id} className={`p-2 rounded-lg border text-xs ${isDark ? "bg-white/[0.03] border-white/10 text-white/80" : "bg-white border-gray-200 text-gray-800"}`}>
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className="font-semibold text-emerald-500 capitalize">{n.author_id} ({n.author_role})</span>
                                                            <span className={`text-[9px] ${isDark ? "text-white/40" : "text-gray-400"}`}>{new Date(n.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-[11px] leading-relaxed">{n.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-1.5 pt-1">
                                            <input
                                                type="text"
                                                value={newAdminNote}
                                                onChange={(e) => setNewAdminNote(e.target.value)}
                                                placeholder="Add internal note..."
                                                className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border outline-none ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                                            />
                                            <button
                                                disabled={savingAdminNote || !newAdminNote.trim()}
                                                onClick={() => handleAddAdminNote(viewTarget.id)}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
                                            >
                                                Post
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${isDark ? "border-white/10 bg-white/[0.01]" : "border-gray-100 bg-gray-50/60"}`}>
                            <button
                                onClick={() => {
                                    setEditTarget(viewTarget);
                                    setViewTarget(null);
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5"
                            >
                                <Edit className="h-3.5 w-3.5" />
                                Edit Report
                            </button>
                            <button
                                onClick={() => setViewTarget(null)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-900"}`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${isDark ? "bg-[#0c1615] border-white/10" : "bg-white border-gray-200"}`}>
                        <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-100 bg-gray-50/70"}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <Edit className="h-4 w-4 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className={`text-sm sm:text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                        Edit Report
                                    </h2>
                                    <p className={`text-[11px] ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                        Update report details and statuses
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditTarget(null)}
                                className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                            <div>
                                <label className={`text-[11px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Category</label>
                                <select
                                    value={editTarget.category}
                                    onChange={(e) => setEditTarget({ ...editTarget, category: e.target.value })}
                                    className={`mt-1 w-full px-3 py-2 rounded-lg text-xs sm:text-sm border outline-none ${isDark ? "bg-white/5 border-white/10 text-white [&>option]:bg-[#112240] [&>option]:text-white" : "bg-white border-gray-200 text-gray-900 [&>option]:bg-white [&>option]:text-gray-900"}`}
                                >
                                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`text-[11px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Description</label>
                                <textarea
                                    value={editTarget.description}
                                    onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })}
                                    rows={3}
                                    className={`mt-1 w-full px-3 py-2 rounded-lg text-xs sm:text-sm border resize-none outline-none ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`text-[11px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Status</label>
                                    <select
                                        value={editTarget.status}
                                        onChange={(e) => setEditTarget({ ...editTarget, status: e.target.value })}
                                        className={`mt-1 w-full px-3 py-2 rounded-lg text-xs sm:text-sm border outline-none ${isDark ? "bg-white/5 border-white/10 text-white [&>option]:bg-[#112240] [&>option]:text-white" : "bg-white border-gray-200 text-gray-900 [&>option]:bg-white [&>option]:text-gray-900"}`}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`text-[11px] font-semibold uppercase tracking-wider block ${isDark ? "text-white/40" : "text-gray-400"}`}>Verification</label>
                                    <select
                                        value={editTarget.verification_status}
                                        onChange={(e) => setEditTarget({ ...editTarget, verification_status: e.target.value })}
                                        className={`mt-1 w-full px-3 py-2 rounded-lg text-xs sm:text-sm border outline-none ${isDark ? "bg-white/5 border-white/10 text-white [&>option]:bg-[#112240] [&>option]:text-white" : "bg-white border-gray-200 text-gray-900 [&>option]:bg-white [&>option]:text-gray-900"}`}
                                    >
                                        <option value="unreviewed">Unreviewed</option>
                                        <option value="valid">Valid</option>
                                        <option value="spam">Spam</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className={`px-5 py-3 border-t flex gap-2.5 shrink-0 ${isDark ? "border-white/10 bg-white/[0.01]" : "border-gray-100 bg-gray-50/60"}`}>
                            <button
                                onClick={() => setEditTarget(null)}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleEdit(editTarget.id, {
                                    category: editTarget.category,
                                    description: editTarget.description,
                                    status: editTarget.status,
                                    verification_status: editTarget.verification_status
                                })}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Update Modal */}
            {statusTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className={`w-full max-w-sm p-5 rounded-2xl shadow-2xl border ${isDark ? "bg-[#0c1615] border-white/10" : "bg-white border-gray-200"}`}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    statusTarget.action === 'approve' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-orange-500/15 text-orange-500'
                                }`}>
                                    {statusTarget.action === 'approve' ? (
                                        <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
                                    ) : (
                                        <XCircle className="h-4.5 w-4.5 text-orange-500" />
                                    )}
                                </div>
                                <div>
                                    <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                        {statusTarget.action === 'approve' ? 'Approve Report' : 'Reject Report'}
                                    </h2>
                                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                        Confirm report moderation
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setStatusTarget(null)}
                                className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className={`text-xs mb-5 ${isDark ? "text-white/70" : "text-gray-600"}`}>
                            Are you sure you want to {statusTarget.action} this report?
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setStatusTarget(null)}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleStatusUpdate(
                                    statusTarget.id,
                                    statusTarget.action === 'approve' ? 'resolved' : 'pending',
                                    statusTarget.action === 'approve' ? 'valid' : 'spam'
                                )}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-colors ${
                                    statusTarget.action === 'approve' 
                                        ? 'bg-emerald-500 hover:bg-emerald-600' 
                                        : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                            >
                                {statusTarget.action === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
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
