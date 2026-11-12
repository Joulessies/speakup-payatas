"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ScrollText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    EOC_STATUS_LABELS,
    EOC_STATUSES,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    type EocStatus,
} from "@/types";

function urgencyText(severity: number) {
    if (severity >= 4) return "High";
    if (severity <= 2) return "Low";
    return "Medium";
}

type LogRow = {
    id: string;
    receipt_id: string | null;
    created_at: string;
    eoc_staff: string | null;
    nature: keyof typeof NATURE_OF_CONCERN_LABELS | null;
    source: keyof typeof INTAKE_SOURCE_LABELS;
    name: string | null;
    sex: string | null;
    age: number | null;
    address: string | null;
    area: keyof typeof BARANGAY_AREA_LABELS | null;
    contact: string | null;
    concern: string;
    category: keyof typeof CATEGORY_LABELS;
    severity: number;
    department: string | null;
    eoc_status: EocStatus;
    remarks: string | null;
    responders: string | null;
};

function todayInManila() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function clock(iso: string) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(new Date(iso));
}

export default function ConcernLog() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [date, setDate] = useState(todayInManila);
    const [rows, setRows] = useState<LogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    const exportExcel = async (targetDate: string) => {
        setExporting(true);
        const toastId = toast.loading("Generating logbook Excel sheet...");
        try {
            const res = await fetch(`/api/reports/log/export?date=${targetDate}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to download logbook Excel file.");
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `PAYATAS_SPEAK_UP_${targetDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Logbook Excel downloaded!", { id: toastId });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error exporting logbook", { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    const load = useCallback(async (selected: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/reports/log?date=${selected}`, { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load the log.");
            setRows(Array.isArray(data.rows) ? data.rows : []);
        } catch (err) {
            setRows([]);
            setError(err instanceof Error ? err.message : "Could not load the log.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(date);
    }, [date, load]);

    const changeStatus = async (row: LogRow, eocStatus: EocStatus) => {
        const previous = row.eoc_status;
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, eoc_status: eocStatus } : item));
        setSavingId(row.id);
        try {
            const res = await fetch("/api/reports/log", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report_id: row.id, eoc_status: eocStatus }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update the status.");
        } catch (err) {
            setRows((current) => current.map((item) => item.id === row.id ? { ...item, eoc_status: previous } : item));
            toast.error(err instanceof Error ? err.message : "Could not update the status.");
        } finally {
            setSavingId(null);
        }
    };

    const card = isDark ? "bg-[#06382b] border-emerald-500/20 text-white" : "bg-white border-emerald-200 text-[#064e3b]";
    const muted = isDark ? "text-white/50" : "text-gray-500";
    const field = `h-10 rounded-lg border px-3 text-sm ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"}`;

    return (
        <div className={`min-h-full ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div className="max-w-[1400px] mx-auto px-4 py-6 md:px-8 md:py-8 space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-emerald-500/15" : "bg-[#e6f4ea]"}`}>
                            <ScrollText className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>Concern Log</h1>
                            <p className={`text-sm mt-1 ${muted}`}>Concerns encoded for this day. Change the status here.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} aria-label="Log date" />
                        <button
                            type="button"
                            onClick={() => exportExcel(date)}
                            disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors"
                            title="Export this day's concerns into the official Barangay Payatas Excel Logbook"
                        >
                            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                            <span>{exporting ? "Exporting..." : "Export Excel (.xlsx)"}</span>
                        </button>
                    </div>
                </div>

                <div className={`rounded-2xl border overflow-hidden ${card}`}>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-16">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className={`text-sm ${muted}`}>Loading the log…</span>
                        </div>
                    ) : error ? (
                        <p className="p-6 text-sm text-red-500">{error}</p>
                    ) : rows.length === 0 ? (
                        <p className={`p-6 text-sm ${muted}`}>No encoded concerns on this day. Add one in Encode Report.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1500px] w-full text-left text-xs">
                                <thead className={isDark ? "bg-black/20 text-white/50" : "bg-emerald-50 text-[#047857]"}>
                                    <tr>
                                        {["Time", "EOC staff", "Nature", "Source", "Name", "Sex", "Age", "Address", "Area", "Contact", "Concern", "Type", "Urgency", "Department", "Status", "Remarks", "Responders"].map((heading) => (
                                            <th key={heading} className="px-3 py-2 font-semibold whitespace-nowrap">{heading}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className={`border-t align-top ${isDark ? "border-white/10" : "border-emerald-100"}`}>
                                            <td className="px-3 py-2 whitespace-nowrap font-medium">{clock(row.created_at)}</td>
                                            <td className="px-3 py-2">{row.eoc_staff || "—"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.nature ? NATURE_OF_CONCERN_LABELS[row.nature] : "—"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{INTAKE_SOURCE_LABELS[row.source]}</td>
                                            <td className="px-3 py-2">{row.name || "—"}</td>
                                            <td className="px-3 py-2 capitalize">{row.sex ? row.sex.replaceAll("_", " ") : "—"}</td>
                                            <td className="px-3 py-2">{row.age ?? "—"}</td>
                                            <td className="px-3 py-2 min-w-40">{row.address || "—"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.area ? BARANGAY_AREA_LABELS[row.area] : "—"}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">{row.contact || "—"}</td>
                                            <td className="px-3 py-2 min-w-56">{row.concern}</td>
                                            <td className="px-3 py-2 min-w-40">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                                            <td className="px-3 py-2">{urgencyText(row.severity)}</td>
                                            <td className="px-3 py-2 min-w-36">{row.department || "—"}</td>
                                            <td className="px-3 py-2">
                                                <select
                                                    aria-label={`Status for ${row.name || row.concern}`}
                                                    value={row.eoc_status}
                                                    disabled={savingId === row.id}
                                                    onChange={(event) => void changeStatus(row, event.target.value as EocStatus)}
                                                    className={`h-8 rounded-md border px-2 ${isDark ? "bg-zinc-950 border-white/10" : "bg-white border-gray-200"}`}
                                                >
                                                    {EOC_STATUSES.map((status) => (
                                                        <option key={status} value={status}>{EOC_STATUS_LABELS[status]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 min-w-40">{row.remarks || "—"}</td>
                                            <td className="px-3 py-2 min-w-32">{row.responders || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
