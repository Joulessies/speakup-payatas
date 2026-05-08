"use client";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, Users, FileWarning, MapPin, BarChart3, Shield, AlertTriangle, CheckCircle2, TrendingUp, ArrowUpRight, Clock } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types";

interface AdminStats {
    totalReports: number;
    totalUsers: number;
    activeHotspots: number;
    unreviewedCount: number;
    spamCount: number;
    resolvedCount: number;
    byCategory: Record<string, number>;
    recentReports: {
        id: string;
        category: string;
        status: string;
        verification_status: string;
        created_at: string;
        description: string;
    }[];
}

export default function AdminDashboard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch reports
            const reportsRes = await fetch("/api/reports?limit=500");
            const reportsData = await reportsRes.json();
            const reports = reportsData.reports || [];

            // Fetch users
            const usersRes = await fetch("/api/users");
            const usersData = await usersRes.json();
            const users = usersData.users || [];

            // Calculate stats
            const stats: AdminStats = {
                totalReports: reports.length,
                totalUsers: users.length,
                activeHotspots: 0, // Will be updated from clusters API
                unreviewedCount: reports.filter((r: any) => r.verification_status === "unreviewed").length,
                spamCount: reports.filter((r: any) => r.verification_status === "spam").length,
                resolvedCount: reports.filter((r: any) => r.status === "resolved").length,
                byCategory: {},
                recentReports: reports.slice(0, 5),
            };

            reports.forEach((r: any) => {
                const cat = r.category || "other";
                stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
            });

            // Fetch hotspots
            try {
                const clustersRes = await fetch("/api/clusters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ window: "30d" }),
                });
                const clustersData = await clustersRes.json();
                stats.activeHotspots = clustersData.clusters?.length || 0;
            } catch {
                // Hotspots fetch failed, continue without it
            }

            setStats(stats);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-red-500/15" : "bg-red-50"}`}>
                        <LayoutDashboard className={`h-6 w-6 ${isDark ? "text-red-400" : "text-red-600"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Admin Dashboard
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            System overview and management.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Link href="/admin/reports" className={`p-4 rounded-2xl border transition-colors ${isDark ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]" : "bg-white border-gray-100 hover:bg-gray-50"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <FileWarning className={`h-4 w-4 ${isDark ? "text-white/40" : "text-gray-500"}`} />
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Total Reports</span>
                            </div>
                            <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stats.totalReports}</p>
                        </Link>
                        <Link href="/admin/users" className={`p-4 rounded-2xl border transition-colors ${isDark ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]" : "bg-white border-gray-100 hover:bg-gray-50"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Users className={`h-4 w-4 ${isDark ? "text-white/40" : "text-gray-500"}`} />
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Total Users</span>
                            </div>
                            <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stats.totalUsers}</p>
                        </Link>
                        <Link href="/admin" className={`p-4 rounded-2xl border transition-colors ${isDark ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]" : "bg-white border-gray-100 hover:bg-gray-50"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin className={`h-4 w-4 ${isDark ? "text-white/40" : "text-gray-500"}`} />
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Active Hotspots</span>
                            </div>
                            <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stats.activeHotspots}</p>
                        </Link>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Resolved</span>
                            </div>
                            <p className={`text-2xl font-bold text-emerald-500`}>{stats.resolvedCount}</p>
                        </div>
                    </div>
                ) : null}

                {/* Alert Cards */}
                {stats && stats.unreviewedCount > 0 && (
                    <Link href="/admin/reports" className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${isDark ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20" : "bg-amber-50 border-amber-100 hover:bg-amber-100"}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-amber-500/20" : "bg-amber-100"}`}>
                            <Clock className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                                {stats.unreviewedCount} Unreviewed Reports
                            </h3>
                            <p className={`text-xs ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}>
                                Reports waiting for verification
                            </p>
                        </div>
                        <ArrowUpRight className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                    </Link>
                )}

                {stats && stats.spamCount > 0 && (
                    <div className={`p-4 rounded-2xl border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100"}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-red-500/20" : "bg-red-100"}`}>
                                <AlertTriangle className={`h-5 w-5 ${isDark ? "text-red-400" : "text-red-600"}`} />
                            </div>
                            <div>
                                <h3 className={`font-semibold ${isDark ? "text-red-300" : "text-red-700"}`}>
                                    {stats.spamCount} Spam Reports Detected
                                </h3>
                                <p className={`text-xs ${isDark ? "text-red-400/70" : "text-red-600/70"}`}>
                                    Reports marked as spam by staff
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Breakdown */}
                {stats && Object.keys(stats.byCategory).length > 0 && (
                    <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Reports by Category
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(stats.byCategory).map(([category, count]) => (
                                <div key={category} className={`p-3 rounded-xl ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                                    <span className={`text-[11px] ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
                                    </span>
                                    <p className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/admin"
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
                            isDark
                                ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20"
                                : "bg-indigo-50 border-indigo-100 hover:bg-indigo-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                            <MapPin className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Hotspot Map</h3>
                            <p className={`text-xs ${isDark ? "text-indigo-400/70" : "text-indigo-600/70"}`}>View incident clusters</p>
                        </div>
                    </Link>
                    <Link
                        href="/admin/reports"
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
                            isDark
                                ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-emerald-50 border-emerald-100 hover:bg-emerald-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                            <Shield className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>Manage Reports</h3>
                            <p className={`text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"}`}>Verify and manage reports</p>
                        </div>
                    </Link>
                    <Link
                        href="/analytics"
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
                            isDark
                                ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20"
                                : "bg-amber-50 border-amber-100 hover:bg-amber-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-amber-500/20" : "bg-amber-100"}`}>
                            <BarChart3 className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>Analytics</h3>
                            <p className={`text-xs ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}>Detailed statistics</p>
                        </div>
                    </Link>
                </div>

                {/* Recent Reports */}
                {stats && stats.recentReports.length > 0 && (
                    <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Recent Reports
                            </h2>
                            <Link href="/admin/reports" className={`text-xs ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}>
                                View all
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {stats.recentReports.map((report) => (
                                <div key={report.id} className={`p-3 rounded-xl flex items-center justify-between ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={isDark ? "border-white/10 text-white/70" : ""}>
                                            {CATEGORY_LABELS[report.category as keyof typeof CATEGORY_LABELS] || report.category}
                                        </Badge>
                                        <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                            {report.description?.slice(0, 40) || "No description"}...
                                        </span>
                                    </div>
                                    <Badge className={`text-[10px] ${
                                        report.verification_status === "valid" ? "bg-emerald-500/10 text-emerald-500"
                                        : report.verification_status === "spam" ? "bg-red-500/10 text-red-500"
                                        : report.verification_status === "duplicate" ? "bg-amber-500/10 text-amber-500"
                                        : "bg-blue-500/10 text-blue-500"
                                    }`}>
                                        {report.verification_status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
