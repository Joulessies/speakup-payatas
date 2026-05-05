"use client";
import { useState, useEffect } from "react";
import { Loader2, Search, Trash2, Edit } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_LABELS } from "@/types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
}

export default function AdminReportsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const pageSize = 10;

    const totalPages = Math.ceil(reports.length / pageSize);
    const paginatedReports = reports.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/reports?limit=20000");
            const data = await res.json();
            setReports(data.reports ?? []);
        } catch {
            toast.error("Failed to load reports");
        } finally {
            setLoading(false);
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

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
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
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setDeleteTarget(r.id)}
                                                    className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
                                                    title="Delete Report"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
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
                                                    ? (isDark ? "bg-indigo-500 text-white" : "bg-indigo-500 text-white")
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${isDark ? "bg-[#12121a] border border-white/10" : "bg-white border border-gray-100"}`}>
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Delete Report
                                </h2>
                                <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-gray-500"}`}>
                                    Are you sure you want to delete this report? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
