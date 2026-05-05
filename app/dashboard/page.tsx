"use client";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, Search, ChevronRight, FileWarning, CheckCircle2, ShieldAlert } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import { CATEGORY_LABELS } from "@/types";
import Link from "next/link";

interface MyReport {
    id: string;
    category: string;
    status: string;
    verification_status: string;
    created_at: string;
    description: string;
}

export default function UserDashboard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<MyReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const hash = await generateReporterHash(getDeviceId());
                const res = await fetch(`/api/reports/my?reporter_hash=${hash}`);
                const data = await res.json();
                setReports(data.reports ?? []);
            } catch { }
            finally { setLoading(false); }
        })();
    }, []);

    const pending = reports.filter(r => r.status === "pending" || r.status === "in_progress").length;
    const resolved = reports.filter(r => r.status === "resolved").length;

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                            <LayoutDashboard className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                My Dashboard
                            </h1>
                            <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Track your reports and see community updates.
                            </p>
                        </div>
                    </div>
                    <Link href="/" className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600`}>
                        <FileWarning className="h-4 w-4" /> New Report
                    </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Total</span>
                        <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-900"}`}>{reports.length}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Pending</span>
                        <p className={`text-2xl font-bold mt-1 text-amber-500`}>{pending}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Resolved</span>
                        <p className={`text-2xl font-bold mt-1 text-emerald-500`}>{resolved}</p>
                    </div>
                    <Link href="/transparency" className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors ${isDark ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20" : "bg-indigo-50 border-indigo-100 hover:bg-indigo-100"}`}>
                        <Search className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        <span className={`text-xs font-medium ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Transparency Board</span>
                    </Link>
                </div>

                <div className={`p-4 md:p-6 rounded-2xl border shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        Report History
                    </h2>
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin opacity-50" /></div>
                    ) : reports.length === 0 ? (
                        <div className={`p-8 text-center text-sm rounded-xl border border-dashed ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                            You haven't submitted any reports yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reports.map((r) => (
                                <Link href={`/track?id=${r.id}`} key={r.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${isDark ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]" : "bg-white border-gray-100 hover:bg-gray-50"}`}>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] || r.category}
                                            </span>
                                            <Badge variant="outline" className={`text-[10px] ${
                                                r.status === "resolved" ? "text-emerald-500 border-emerald-500/20" :
                                                r.status === "in_progress" ? "text-blue-500 border-blue-500/20" :
                                                "text-amber-500 border-amber-500/20"
                                            }`}>
                                                {r.status.replace("_", " ")}
                                            </Badge>
                                            {r.verification_status === "spam" && (
                                                <Badge variant="destructive" className="bg-red-500/10 text-red-500"><ShieldAlert className="w-3 h-3 mr-1"/> Spam</Badge>
                                            )}
                                        </div>
                                        <p className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                            {r.description || "No description"}
                                        </p>
                                        <p className={`text-[10px] mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                            {new Date(r.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                                        </p>
                                    </div>
                                    <ChevronRight className={`h-5 w-5 shrink-0 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
