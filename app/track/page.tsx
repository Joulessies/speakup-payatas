"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  FileWarning,
  Clock,
  CheckCircle2,
  Shield,
  ThumbsUp,
  Send,
  Eye,
  Wrench,
} from "lucide-react";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";

interface TrackedReport {
  id: string;
  category: string;
  description: string;
  severity: number;
  status: string;
  created_at: string;
}

const STATUS_STEPS = [
  { key: "pending", label: "Submitted", icon: Send, color: "text-amber-400" },
  { key: "verified", label: "Verified", icon: Eye, color: "text-blue-400" },
  { key: "in_progress", label: "In Progress", icon: Wrench, color: "text-indigo-400" },
  { key: "resolved", label: "Resolved", icon: Shield, color: "text-green-400" },
];

function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function TrackPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<TrackedReport[] | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hash.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/track?hash=${encodeURIComponent(hash.trim())}`);
      const data = await res.json();
      setReports(data.reports ?? []);

      // Fetch confirmation counts
      const counts: Record<string, number> = {};
      for (const r of data.reports ?? []) {
        try {
          const cRes = await fetch(`/api/upvote?report_id=${r.id}`);
          const cData = await cRes.json();
          counts[r.id] = cData.confirmations ?? 0;
        } catch {
          counts[r.id] = 0;
        }
      }
      setConfirmations(counts);
    } catch {
      setReports([]);
    }
    setLoading(false);
  };

  const handleUpvote = async (reportId: string) => {
    setConfirming(reportId);
    try {
      const reporterHash = await generateReporterHash(getDeviceId());
      const res = await fetch("/api/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, reporter_hash: reporterHash }),
      });
      const data = await res.json();
      setConfirmations((prev) => ({ ...prev, [reportId]: data.confirmations ?? (prev[reportId] ?? 0) }));
    } catch { /* silent */ }
    setConfirming(null);
  };

  return (
    <div className={`flex flex-1 flex-col items-center px-4 py-6 pb-24 md:py-12 overflow-y-auto ${
      isDark ? "bg-[#0a0a0f]" : "bg-gray-50"
    }`}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${
            isDark ? "bg-indigo-500/10" : "bg-indigo-50"
          }`}>
            <Search className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          </div>
          <h1 className={`text-xl md:text-2xl font-bold tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            {t.trackTitle}
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            {t.trackDescription}
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder={t.trackPlaceholder}
            className={`font-mono text-sm ${
              isDark ? "bg-white/[0.06] border-white/10 text-white placeholder:text-white/30" : "bg-white border-gray-200"
            }`}
          />
          <Button type="submit" disabled={loading || !hash.trim()} className="w-full shrink-0 sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.trackSearch}
          </Button>
        </form>

        {/* Results */}
        {reports !== null && (
          <>
            {reports.length === 0 ? (
              <Card className={isDark ? "bg-white/[0.03] border-white/[0.06]" : ""}>
                <CardContent className="py-10 text-center">
                  <FileWarning className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                  <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>
                    {t.trackNoResults}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div>
                <h2 className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  {t.trackReports} ({reports.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {reports.map((report) => {
                    const statusIdx = getStatusIndex(report.status);
                    const confCount = confirmations[report.id] ?? 0;

                    return (
                      <Card key={report.id} className={isDark ? "bg-white/[0.03] border-white/[0.06]" : ""}>
                        <CardHeader className="px-4 py-3 pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className={`text-sm font-semibold capitalize ${isDark ? "text-white" : ""}`}>
                              {report.category}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {confCount > 0 && (
                                <Badge variant="outline" className={`gap-1 text-[10px] ${isDark ? "border-emerald-500/20 text-emerald-400" : "border-emerald-200 text-emerald-600"}`}>
                                  <ThumbsUp className="h-3 w-3" />
                                  {confCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardDescription className={`text-xs ${isDark ? "text-white/30" : ""}`}>
                            {new Date(report.created_at).toLocaleDateString("en-PH", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="px-4 pb-4 space-y-3">
                          {report.description && (
                            <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-600"}`}>
                              {report.description}
                            </p>
                          )}

                          {/* Resolution Timeline */}
                          <div className="flex items-center gap-0 w-full">
                            {STATUS_STEPS.map((step, i) => {
                              const isComplete = i <= statusIdx;
                              const isCurrent = i === statusIdx;
                              return (
                                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                      isCurrent
                                        ? `${step.color} ring-2 ring-offset-1 ${isDark ? "ring-white/10 ring-offset-black/50 bg-white/10" : "ring-gray-200 ring-offset-white bg-gray-50"}`
                                        : isComplete
                                          ? isDark ? "bg-white/10" : "bg-gray-100"
                                          : isDark ? "bg-white/[0.04]" : "bg-gray-50"
                                    }`}>
                                      <step.icon className={`h-3.5 w-3.5 ${
                                        isComplete ? step.color : isDark ? "text-white/15" : "text-gray-300"
                                      }`} />
                                    </div>
                                    <span className={`text-[8px] mt-1 font-medium ${
                                      isCurrent
                                        ? isDark ? "text-white/80" : "text-gray-900"
                                        : isComplete
                                          ? isDark ? "text-white/40" : "text-gray-500"
                                          : isDark ? "text-white/15" : "text-gray-300"
                                    }`}>
                                      {step.label}
                                    </span>
                                  </div>
                                  {i < STATUS_STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full ${
                                      i < statusIdx
                                        ? isDark ? "bg-white/15" : "bg-gray-200"
                                        : isDark ? "bg-white/[0.04]" : "bg-gray-100"
                                    }`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Upvote button */}
                          <button
                            onClick={() => handleUpvote(report.id)}
                            disabled={confirming === report.id}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors ${
                              isDark
                                ? "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                                : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }`}
                          >
                            {confirming === report.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-3.5 w-3.5" />
                            )}
                            Confirm this report
                          </button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
