"use client";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, FileWarning, Shield, ThumbsUp, Send, Eye, Wrench, Copy, Check, } from "lucide-react";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import { toast } from "sonner";
import ReportFeedback from "@/components/report-feedback";
interface TrackedReport {
    id: string;
    receipt_id?: string;
    category: string;
    description: string;
    severity: number;
    status: string;
    created_at: string;
    action_history?: {
        id: string;
        status: "pending" | "verified" | "in_progress" | "resolved";
        note: string;
        actor: string;
        created_at: string;
        photo_url?: string;
    }[];
}
const STATUS_STEPS = [
    { key: "pending", mobileLabel: "Sub", icon: Send, color: "text-amber-400" },
    { key: "verified", mobileLabel: "Ver", icon: Eye, color: "text-blue-400" },
    { key: "in_progress", mobileLabel: "Prog", icon: Wrench, color: "text-indigo-400" },
    { key: "resolved", mobileLabel: "Done", icon: Shield, color: "text-green-400" },
];
function getStatusIndex(status: string): number {
    const idx = STATUS_STEPS.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
}
function getStatusLabel(t: ReturnType<typeof import("@/lib/i18n").getTranslations>, key: string) {
    switch (key) {
        case "pending":
            return t.trackSubmitted;
        case "verified":
            return t.trackVerified;
        case "in_progress":
            return t.trackInProgress;
        case "resolved":
            return t.trackResolved;
        default:
            return t.trackPending;
    }
}
export default function TrackPage() {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const isDark = theme === "dark";
    const [queryInput, setQueryInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState<TrackedReport[] | null>(null);
    const [confirmations, setConfirmations] = useState<Record<string, number>>({});
    const [confirming, setConfirming] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [lastQuery, setLastQuery] = useState("");
    const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);
    const copyReceipt = async (receiptId: string) => {
        try {
            await navigator.clipboard.writeText(receiptId);
            setCopiedReceipt(receiptId);
            toast.success("Receipt code copied");
            window.setTimeout(() => setCopiedReceipt((prev) => (prev === receiptId ? null : prev)), 1500);
        } catch {
            toast.error("Could not copy. Please copy manually.");
        }
    };
    const normalizeInput = (value: string) => value
        .trim()
        .replaceAll("`", "")
        .replace("…", "")
        .replace(/\s+/g, "");
    const handleUseMyHash = async () => {
        const generated = await generateReporterHash(getDeviceId());
        setQueryInput(generated.slice(0, 12));
        setSearchError(null);
    };
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedQuery = normalizeInput(queryInput);
        if (!normalizedQuery)
            return;
        const looksLikeReceipt = normalizedQuery.toUpperCase().startsWith("SPK-");
        if (!looksLikeReceipt && normalizedQuery.length < 8) {
            setSearchError(t.trackMinCharsError);
            setReports(null);
            return;
        }
        setSearchError(null);
        setLastQuery(normalizedQuery);
        setLoading(true);
        try {
            const res = await fetch(`/api/track?q=${encodeURIComponent(normalizedQuery)}`);
            if (!res.ok) {
                throw new Error("Track search failed");
            }
            const data = await res.json();
            setReports(data.reports ?? []);
            const countEntries = await Promise.all((data.reports ?? []).map(async (r: TrackedReport) => {
                try {
                    const cRes = await fetch(`/api/upvote?report_id=${r.id}`);
                    const cData = await cRes.json();
                    return [r.id, cData.confirmations ?? 0] as const;
                }
                catch {
                    return [r.id, 0] as const;
                }
            }));
            const counts = Object.fromEntries(countEntries);
            setConfirmations(counts);
        }
        catch {
            setSearchError(t.trackSearchFailedError);
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
        }
        catch { }
        setConfirming(null);
    };
    return (<div className={`flex flex-1 flex-col items-center px-4 py-6 pb-24 md:py-12 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      <div className="w-full max-w-2xl">
        
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${isDark ? "bg-indigo-500/10" : "bg-indigo-50"}`}>
            <Search className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}/>
          </div>
          <h1 className={`text-xl md:text-2xl font-bold tracking-tight mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
            {t.trackTitle}
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            {t.trackDescription}
          </p>
        </div>

        
        <Card className={`mb-6 ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
              <Input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder={t.trackPlaceholder} className={`font-mono text-sm ${isDark ? "bg-white/[0.06] border-white/10 text-white placeholder:text-white/30" : "bg-white border-gray-200"}`}/>
              <Button type="submit" disabled={loading || !normalizeInput(queryInput)} className="w-full shrink-0 sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : t.trackSearch}
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleUseMyHash} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${isDark
            ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"}`}>
                {t.trackUseMyId}
              </button>
              {queryInput && (<button type="button" onClick={() => {
                setQueryInput("");
                setReports(null);
                setSearchError(null);
                setLastQuery("");
            }} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${isDark
                ? "bg-white/[0.03] text-white/45 hover:bg-white/[0.08] hover:text-white/70"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
                  {t.trackClear}
                </button>)}
            </div>

            <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
              {t.trackTip}
            </p>

            {searchError && (<p className={`text-xs ${isDark ? "text-red-300" : "text-red-600"}`}>{searchError}</p>)}
          </CardContent>
        </Card>

        
        {reports !== null && (<>
            {reports.length === 0 ? (<Card className={isDark ? "bg-white/[0.03] border-white/[0.06]" : ""}>
                <CardContent className="py-10 text-center">
                  <FileWarning className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-white/20" : "text-gray-300"}`}/>
                  <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>
                    {t.trackNoResults}
                  </p>
                </CardContent>
              </Card>) : (<div>
                <h2 className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                  {t.trackReports} ({reports.length})
                </h2>
                {lastQuery && (<p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-gray-500"}`}>
                    {t.trackResultsFor(lastQuery)} <span className="font-mono">{lastQuery}</span>
                  </p>)}
                <div className="flex flex-col gap-3">
                  {reports.map((report) => {
                    const statusIdx = getStatusIndex(report.status);
                    const confCount = confirmations[report.id] ?? 0;
                    return (<Card key={report.id} className={isDark ? "bg-white/[0.03] border-white/[0.06]" : ""}>
                        <CardHeader className="px-4 py-3 pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className={`text-sm font-semibold capitalize ${isDark ? "text-white" : ""}`}>
                              {report.category}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {confCount > 0 && (<Badge variant="outline" className={`gap-1 text-[10px] ${isDark ? "border-emerald-500/20 text-emerald-400" : "border-emerald-200 text-emerald-600"}`}>
                                  <ThumbsUp className="h-3 w-3"/>
                                  {confCount}
                                </Badge>)}
                            </div>
                          </div>
                          <CardDescription className={`text-xs ${isDark ? "text-white/30" : ""}`}>
                            {new Date(report.created_at).toLocaleDateString("en-PH", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                        })}
                          </CardDescription>
                          {report.receipt_id && (<div className="mt-1 flex items-center gap-1.5">
                              <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-500"}`}>Receipt:</span>
                              <button
                                type="button"
                                onClick={() => copyReceipt(report.receipt_id!)}
                                title="Copy receipt code"
                                aria-label={`Copy receipt code ${report.receipt_id}`}
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                                    isDark
                                        ? "bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                }`}
                              >
                                <span>{report.receipt_id}</span>
                                {copiedReceipt === report.receipt_id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>)}
                        </CardHeader>

                        <CardContent className="px-4 pb-4 space-y-3">
                          {report.description && (<p className={`text-sm ${isDark ? "text-white/60" : "text-gray-600"}`}>
                              {report.description}
                            </p>)}

                          
                          <div className="pb-1">
                            <div className="grid grid-cols-4 items-start gap-1 w-full">
                            {STATUS_STEPS.map((step, i) => {
                            const isComplete = i <= statusIdx;
                            const isCurrent = i === statusIdx;
                            return (<div key={step.key} className="relative flex flex-col items-center">
                                  {i < STATUS_STEPS.length - 1 && (<div className={`absolute top-3.5 left-[52%] w-full h-0.5 rounded-full ${i < statusIdx
                                        ? isDark ? "bg-white/15" : "bg-gray-200"
                                        : isDark ? "bg-white/[0.04]" : "bg-gray-100"}`}/>)}
                                  <div className="relative z-10 flex flex-col items-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isCurrent
                                    ? `${step.color} ring-2 ring-offset-1 ${isDark ? "ring-white/10 ring-offset-black/50 bg-white/10" : "ring-gray-200 ring-offset-white bg-gray-50"}`
                                    : isComplete
                                        ? isDark ? "bg-white/10" : "bg-gray-100"
                                        : isDark ? "bg-white/[0.04]" : "bg-gray-50"}`}>
                                      <step.icon className={`h-3.5 w-3.5 ${isComplete ? step.color : isDark ? "text-white/15" : "text-gray-300"}`}/>
                                    </div>
                                    <span className={`text-[8px] mt-1 font-medium ${isCurrent
                                    ? isDark ? "text-white/80" : "text-gray-900"
                                    : isComplete
                                        ? isDark ? "text-white/40" : "text-gray-500"
                                        : isDark ? "text-white/15" : "text-gray-300"}`}>
                                      <span className="sm:hidden">{step.mobileLabel}</span>
                                      <span className="hidden sm:inline">{getStatusLabel(t, step.key)}</span>
                                    </span>
                                  </div>
                                </div>);
                        })}
                            </div>
                          </div>

                          
                          {report.action_history && report.action_history.length > 0 && (<div className={`rounded-xl p-3 ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}>
                              <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Action History
                              </p>
                              <div className="space-y-2">
                                {report.action_history
                                .slice()
                                .sort((a, b) => new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime())
                                .map((entry) => (<div key={entry.id} className="flex flex-col gap-1.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className={`text-xs ${isDark ? "text-white/75" : "text-gray-700"}`}>
                                            {entry.note}
                                          </p>
                                          <p className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-500"}`}>
                                            {entry.actor}
                                          </p>
                                        </div>
                                        <p className={`text-[10px] whitespace-nowrap ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                          {new Date(entry.created_at).toLocaleDateString("en-PH", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </p>
                                      </div>
                                      {entry.photo_url && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={entry.photo_url}
                                          alt={`Photo attached when status changed to ${entry.status}`}
                                          className="w-full max-h-48 object-cover rounded-lg border border-dashed"
                                        />
                                      )}
                                    </div>))}
                              </div>
                            </div>)}

                          
                          {report.status === "resolved" && (
                            <ReportFeedback reportId={report.id} />
                          )}
                          
                          <button onClick={() => handleUpvote(report.id)} disabled={confirming === report.id} className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors ${isDark
                            ? "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
                            {confirming === report.id ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<ThumbsUp className="h-3.5 w-3.5"/>)}
                            {t.trackConfirmReport}
                          </button>
                        </CardContent>
                      </Card>);
                })}
                </div>
              </div>)}
          </>)}
      </div>
    </div>);
}
