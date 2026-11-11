"use client";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
    BARANGAY_AREA_LABELS,
    EOC_STATUS_LABELS,
    GENDER_LABELS,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    type ReportIntakeDetails,
} from "@/types";

const WIDE_FIELDS = new Set(["Address", "Remarks"]);

/** Private complainant / intake details for one report. Renders nothing when the report has none. */
export function IntakeDetailsCard({ reportId, isDark }: { reportId: string; isDark: boolean }) {
    const [loaded, setLoaded] = useState<{ reportId: string; details: ReportIntakeDetails | null } | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/reports/intake?report_id=${encodeURIComponent(reportId)}`, { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : { details: null }))
            .then((data) => {
                if (!cancelled) setLoaded({ reportId, details: data?.details ?? null });
            })
            .catch(() => {
                if (!cancelled) setLoaded({ reportId, details: null });
            });
        return () => {
            cancelled = true;
        };
    }, [reportId]);

    // Ignore details still held from a previously opened report.
    const details = loaded?.reportId === reportId ? loaded.details : null;
    if (!details) return null;

    const fields: [string, string | null | undefined][] = [
        ["Received via", details.source === "web" ? null : INTAKE_SOURCE_LABELS[details.source]],
        ["Nature", details.nature_of_concern ? NATURE_OF_CONCERN_LABELS[details.nature_of_concern] : null],
        ["EOC staff", details.eoc_staff],
        ["Log status", details.eoc_status ? EOC_STATUS_LABELS[details.eoc_status] : null],
        ["Complainant", details.reporter_name],
        ["Contact", details.reporter_contact],
        ["Age", details.reporter_age != null ? String(details.reporter_age) : null],
        ["Sex", details.reporter_gender ? GENDER_LABELS[details.reporter_gender] : null],
        ["Area", details.area ? BARANGAY_AREA_LABELS[details.area] : null],
        ["Concern department", details.concern_department],
        ["Responders", details.responders],
        ["Encoded by", details.encoded_by],
        ["Address", details.reporter_address],
        ["Remarks", details.remarks],
    ];
    const shown = fields.filter((field): field is [string, string] => Boolean(field[1]));
    if (shown.length === 0) return null;

    return (<div className={`p-3 rounded-xl border ${isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {details.source === "web" ? "Reporter profile" : "Intake details"}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                <LockKeyhole className="h-3 w-3" />
                Staff only
            </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {shown.map(([label, value]) => (<div key={label} className={WIDE_FIELDS.has(label) ? "sm:col-span-2" : undefined}>
                <dt className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-500"}`}>{label}</dt>
                <dd className={`text-xs mt-0.5 break-words whitespace-pre-line ${isDark ? "text-white/85" : "text-gray-800"}`}>{value}</dd>
            </div>))}
        </dl>
    </div>);
}
