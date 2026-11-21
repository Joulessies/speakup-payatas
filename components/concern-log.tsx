"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Loader2,
    ScrollText,
    FileSpreadsheet,
    Upload,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    SendHorizontal,
    FileWarning,
    Edit2,
    Check,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
    BARANGAY_AREAS,
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    CONCERN_DEPARTMENTS,
    EOC_STATUS_LABELS,
    EOC_STATUSES,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    type BarangayArea,
    type EocStatus,
} from "@/types";

function urgencyBadge(severity: number) {
    if (severity >= 4) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/20">HIGH</span>;
    }
    if (severity <= 2) {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/20">LOW</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">MEDIUM</span>;
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

    // Filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [areaFilter, setAreaFilter] = useState<string>("all");
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Inline edit states
    const [editingField, setEditingField] = useState<{ id: string; field: "responders" | "remarks" } | null>(null);
    const [editValue, setEditValue] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        event.target.value = "";
        setImporting(true);
        const toastId = toast.loading("Importing records from Excel...");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/reports/log/import", {
                method: "POST",
                body: formData,
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Failed to import records from Excel.");
            }

            toast.success(data.message || `Successfully imported ${data.imported} records!`, { id: toastId });
            await load(date);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error importing Excel", { id: toastId });
        } finally {
            setImporting(false);
        }
    };

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

    const exportTemplate = async () => {
        setExporting(true);
        const toastId = toast.loading("Generating official blank template...");
        try {
            const res = await fetch("/api/reports/log/export?template=1");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to download template.");
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "PAYATAS_SPEAK_UP_TEMPLATE.xlsx";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Official blank template downloaded!", { id: toastId });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error exporting template", { id: toastId });
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

    const updateRecord = async (
        row: LogRow,
        updates: { eoc_status?: EocStatus; department?: string; responders?: string; remarks?: string }
    ) => {
        const previous = { ...row };
        setRows((current) =>
            current.map((item) => {
                if (item.id !== row.id) return item;
                return {
                    ...item,
                    ...(updates.eoc_status && { eoc_status: updates.eoc_status }),
                    ...(updates.department !== undefined && { department: updates.department }),
                    ...(updates.responders !== undefined && { responders: updates.responders }),
                    ...(updates.remarks !== undefined && { remarks: updates.remarks }),
                };
            })
        );

        setSavingId(row.id);
        try {
            const res = await fetch("/api/reports/log", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ report_id: row.id, ...updates }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to update record.");
            toast.success("Log updated successfully");
        } catch (err) {
            setRows((current) => current.map((item) => (item.id === row.id ? previous : item)));
            toast.error(err instanceof Error ? err.message : "Could not update the record.");
        } finally {
            setSavingId(null);
        }
    };

    // Filtered rows
    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            if (areaFilter !== "all" && r.area !== areaFilter) return false;
            if (deptFilter !== "all" && (r.department || "").toUpperCase() !== deptFilter.toUpperCase()) return false;
            if (statusFilter !== "all" && r.eoc_status !== statusFilter) return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = (r.name || "").toLowerCase().includes(term);
                const matchReceipt = (r.receipt_id || "").toLowerCase().includes(term);
                const matchAddress = (r.address || "").toLowerCase().includes(term);
                const matchConcern = (r.concern || "").toLowerCase().includes(term);
                const matchResponders = (r.responders || "").toLowerCase().includes(term);
                if (!matchName && !matchReceipt && !matchAddress && !matchConcern && !matchResponders) {
                    return false;
                }
            }
            return true;
        });
    }, [rows, areaFilter, deptFilter, statusFilter, searchTerm]);

    // KPI Counts
    const stats = useMemo(() => {
        let responded = 0;
        let transferred = 0;
        let pending = 0;
        let missionOrder = 0;

        rows.forEach((r) => {
            if (r.eoc_status === "responded") responded++;
            else if (r.eoc_status === "transferred") transferred++;
            else if (r.eoc_status === "pending_with_mission_order") missionOrder++;
            else pending++;
        });

        return { total: rows.length, responded, transferred, pending, missionOrder };
    }, [rows]);

    const card = isDark ? "bg-[#06382b] border-emerald-500/20 text-white" : "bg-white border-emerald-200 text-[#064e3b]";
    const muted = isDark ? "text-white/50" : "text-gray-500";
    const field = `h-9 rounded-lg border px-3 text-xs ${
        isDark ? "bg-white/5 border-white/10 text-white placeholder-white/30" : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
    }`;

    return (
        <div className={`min-h-full ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-8 md:py-8 space-y-5">
                {/* Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-emerald-500/15" : "bg-[#e6f4ea]"}`}>
                            <ScrollText className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                Barangay EOC Incident Logbook
                            </h1>
                            <p className={`text-xs md:text-sm mt-0.5 ${muted}`}>
                                Official 17-column logbook adhering to Quezon City Barangay Payatas standards.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            className={field}
                            aria-label="Log date"
                        />
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
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleImportExcel}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing || exporting}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                isDark
                                    ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                                    : "border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/60"
                            }`}
                            title="Import records from an official Payatas Excel Logbook (.xlsx)"
                        >
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            <span>{importing ? "Importing..." : "Import Excel (.xlsx)"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={exportTemplate}
                            disabled={exporting || importing}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                                isDark ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" : "border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50"
                            }`}
                            title="Download blank official Barangay Payatas logbook template"
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Official Template</span>
                        </button>
                    </div>
                </div>

                {/* KPI Status Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-emerald-100"}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold uppercase ${muted}`}>Total Today</span>
                            <ScrollText className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className={`text-xl font-bold mt-1 ${isDark ? "text-white" : "text-emerald-950"}`}>{stats.total}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Responded</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{stats.responded}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400">Transferred</span>
                            <SendHorizontal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-300">{stats.transferred}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200"}`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">Mission Order</span>
                            <FileWarning className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <p className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-300">{stats.missionOrder}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-500/10 border-slate-500/20" : "bg-slate-50 border-slate-200"}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold uppercase ${muted}`}>Pending</span>
                            <Clock className="h-4 w-4 text-slate-400" />
                        </div>
                        <p className={`text-xl font-bold mt-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>{stats.pending}</p>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${card}`}>
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className={`absolute left-2.5 top-2.5 h-3.5 w-3.5 ${muted}`} />
                            <input
                                type="text"
                                placeholder="Search by name, address, receipt, concern..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 ${field}`}
                            />
                        </div>
                        <select
                            value={areaFilter}
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className={field}
                            aria-label="Filter by Area"
                        >
                            <option value="all">All Areas (Payatas)</option>
                            {BARANGAY_AREAS.map((a) => (
                                <option key={a} value={a}>
                                    {BARANGAY_AREA_LABELS[a]}
                                </option>
                            ))}
                        </select>
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className={field}
                            aria-label="Filter by Department"
                        >
                            <option value="all">All Departments</option>
                            {CONCERN_DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={field}
                            aria-label="Filter by EOC Status"
                        >
                            <option value="all">All Statuses</option>
                            {EOC_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {EOC_STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={muted}>
                            Showing <strong>{filteredRows.length}</strong> of {rows.length}
                        </span>
                    </div>
                </div>

                {/* Table Card */}
                <div className={`rounded-2xl border overflow-hidden shadow-sm ${card}`}>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-16">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                            <span className={`text-sm ${muted}`}>Loading the official EOC logbook…</span>
                        </div>
                    ) : error ? (
                        <p className="p-6 text-sm text-red-500">{error}</p>
                    ) : filteredRows.length === 0 ? (
                        <div className="text-center py-12 px-4 space-y-2">
                            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-700"}`}>
                                No records match your criteria for this date.
                            </p>
                            <p className={`text-xs ${muted}`}>
                                Try switching the date or clearing active search filters.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1700px] w-full text-left text-xs border-collapse">
                                <thead className={isDark ? "bg-black/30 text-white/60" : "bg-emerald-800 text-white"}>
                                    <tr>
                                        {[
                                            "DATE & TIME",
                                            "EOC STAFF",
                                            "NATURE OF CONCERN",
                                            "SOURCE OF CONCERN",
                                            "NAME",
                                            "SEX",
                                            "AGE",
                                            "ADDRESS",
                                            "AREA",
                                            "CONTACT NUMBER",
                                            "CONCERN",
                                            "TYPE OF CONCERN",
                                            "URGENCY",
                                            "CONCERN DEPARTMENT",
                                            "STATUS",
                                            "REMARKS",
                                            "RESPONDERS",
                                        ].map((heading) => (
                                            <th key={heading} className="px-3.5 py-3 font-bold text-[11px] tracking-wide whitespace-nowrap border-b border-emerald-900">
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-100 dark:divide-white/5">
                                    {filteredRows.map((row, idx) => {
                                        const isOdd = idx % 2 === 1;
                                        return (
                                            <tr
                                                key={row.id}
                                                className={`align-top transition-colors ${
                                                    isDark
                                                        ? isOdd
                                                            ? "bg-white/[0.02] hover:bg-white/[0.05]"
                                                            : "bg-transparent hover:bg-white/[0.04]"
                                                        : isOdd
                                                        ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                                                        : "bg-white hover:bg-emerald-50/40"
                                                }`}
                                            >
                                                {/* Date & Time */}
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-center">
                                                    {clock(row.created_at)}
                                                    {row.receipt_id && (
                                                        <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                            {row.receipt_id}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* EOC Staff */}
                                                <td className="px-3 py-2.5 font-medium whitespace-nowrap">{row.eoc_staff || "System"}</td>

                                                {/* Nature */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                                        {row.nature ? NATURE_OF_CONCERN_LABELS[row.nature] : "Report"}
                                                    </span>
                                                </td>

                                                {/* Source */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs">{INTAKE_SOURCE_LABELS[row.source] || row.source}</span>
                                                </td>

                                                {/* Name */}
                                                <td className="px-3 py-2.5 font-medium min-w-[120px]">{row.name || "Anonymous"}</td>

                                                {/* Sex */}
                                                <td className="px-3 py-2.5 capitalize text-center">{row.sex ? row.sex.replaceAll("_", " ") : "—"}</td>

                                                {/* Age */}
                                                <td className="px-3 py-2.5 text-center">{row.age ?? "—"}</td>

                                                {/* Address */}
                                                <td className="px-3 py-2.5 min-w-[160px] max-w-[220px] break-words">{row.address || "Payatas, Quezon City"}</td>

                                                {/* Area */}
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                                                    {row.area ? BARANGAY_AREA_LABELS[row.area] : "Others"}
                                                </td>

                                                {/* Contact */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-center font-mono">{row.contact || "—"}</td>

                                                {/* Concern */}
                                                <td className="px-3 py-2.5 min-w-[220px] max-w-[320px] break-words leading-relaxed">{row.concern}</td>

                                                {/* Type of Concern (Category) */}
                                                <td className="px-3 py-2.5 min-w-[150px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                    {CATEGORY_LABELS[row.category] ?? row.category}
                                                </td>

                                                {/* Urgency */}
                                                <td className="px-3 py-2.5 text-center">{urgencyBadge(row.severity)}</td>

                                                {/* Concern Department Dropdown */}
                                                <td className="px-3 py-2.5 min-w-[180px]">
                                                    <select
                                                        aria-label={`Department for ${row.name || row.concern}`}
                                                        value={row.department || "BDRRM Office"}
                                                        disabled={savingId === row.id}
                                                        onChange={(e) => void updateRecord(row, { department: e.target.value })}
                                                        className={`w-full h-8 rounded-lg border px-2 text-xs font-medium cursor-pointer transition-colors ${
                                                            isDark
                                                                ? "bg-zinc-900 border-white/10 text-emerald-300 hover:border-emerald-500/40"
                                                                : "bg-white border-gray-200 text-emerald-800 hover:border-emerald-500"
                                                        }`}
                                                    >
                                                        {CONCERN_DEPARTMENTS.map((dept) => (
                                                            <option key={dept} value={dept}>
                                                                {dept}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* EOC Status Dropdown */}
                                                <td className="px-3 py-2.5 min-w-[160px]">
                                                    <select
                                                        aria-label={`Status for ${row.name || row.concern}`}
                                                        value={row.eoc_status}
                                                        disabled={savingId === row.id}
                                                        onChange={(e) => void updateRecord(row, { eoc_status: e.target.value as EocStatus })}
                                                        className={`w-full h-8 rounded-lg border px-2 text-xs font-bold cursor-pointer transition-colors ${
                                                            row.eoc_status === "responded"
                                                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                                                : row.eoc_status === "transferred"
                                                                ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                                                                : row.eoc_status === "pending_with_mission_order"
                                                                ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                                                                : "bg-slate-500/15 border-slate-500/30 text-slate-600 dark:text-slate-400"
                                                        }`}
                                                    >
                                                        {EOC_STATUSES.map((status) => (
                                                            <option key={status} value={status}>
                                                                {EOC_STATUS_LABELS[status]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Remarks (Editable) */}
                                                <td className="px-3 py-2.5 min-w-[160px] max-w-[240px]">
                                                    {editingField?.id === row.id && editingField.field === "remarks" ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className={`h-7 px-2 text-xs rounded border flex-1 ${
                                                                    isDark ? "bg-black border-white/20 text-white" : "bg-white border-gray-300"
                                                                }`}
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    void updateRecord(row, { remarks: editValue });
                                                                    setEditingField(null);
                                                                }}
                                                                className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingField(null)}
                                                                className="p-1 rounded text-red-500 hover:bg-red-500/10"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => {
                                                                setEditingField({ id: row.id, field: "remarks" });
                                                                setEditValue(row.remarks || "");
                                                            }}
                                                            className="cursor-pointer group flex items-center justify-between gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400"
                                                            title="Click to edit remarks"
                                                        >
                                                            <span className="line-clamp-2">{row.remarks || "—"}</span>
                                                            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Responders (Editable) */}
                                                <td className="px-3 py-2.5 min-w-[140px] max-w-[200px]">
                                                    {editingField?.id === row.id && editingField.field === "responders" ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className={`h-7 px-2 text-xs rounded border flex-1 ${
                                                                    isDark ? "bg-black border-white/20 text-white" : "bg-white border-gray-300"
                                                                }`}
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    void updateRecord(row, { responders: editValue });
                                                                    setEditingField(null);
                                                                }}
                                                                className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingField(null)}
                                                                className="p-1 rounded text-red-500 hover:bg-red-500/10"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => {
                                                                setEditingField({ id: row.id, field: "responders" });
                                                                setEditValue(row.responders || "");
                                                            }}
                                                            className="cursor-pointer group flex items-center justify-between gap-1 text-xs hover:text-emerald-600 dark:hover:text-emerald-400"
                                                            title="Click to edit responders"
                                                        >
                                                            <span className="font-medium">{row.responders || "—"}</span>
                                                            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
