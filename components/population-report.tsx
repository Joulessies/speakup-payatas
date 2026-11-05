"use client";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    AGE_GROUPS,
    BARANGAY_AREAS,
    BARANGAY_AREA_LABELS,
    INTAKE_SOURCES,
    INTAKE_SOURCE_LABELS,
    type AgeGroupKey,
    type GenderBucket,
    type PopulationReport,
} from "@/types";

const NOT_SPECIFIED_COLOR = "#9ca3af";

const GENDER_BUCKETS: { key: GenderBucket; label: string; color: string }[] = [
    { key: "male", label: "Male", color: "#3b82f6" },
    { key: "female", label: "Female", color: "#ec4899" },
    { key: "other", label: "Other", color: "#a855f7" },
    { key: "not_specified", label: "Not specified", color: NOT_SPECIFIED_COLOR },
];

const AGE_ROWS: { key: AgeGroupKey | "not_specified"; label: string; color: string }[] = [
    ...AGE_GROUPS.map((group) => ({ key: group.key, label: group.label, color: "#10b981" })),
    { key: "not_specified", label: "Not specified", color: NOT_SPECIFIED_COLOR },
];

interface BarItem {
    key: string;
    label: string;
    count: number;
    color: string;
}

function percent(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
}

function BarList({ items, total, isDark }: { items: BarItem[]; total: number; isDark: boolean }) {
    return (<div className="space-y-2.5">
        {items.map((item) => {
            const pct = percent(item.count, total);
            return (<div key={item.key} className="flex items-center gap-3">
                <span className={`text-xs w-32 sm:w-48 truncate ${isDark ? "text-white/60" : "text-gray-600"}`} title={item.label}>
                    {item.label}
                </span>
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
                <span className={`text-xs font-mono w-16 text-right shrink-0 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                    {item.count} ({pct}%)
                </span>
            </div>);
        })}
    </div>);
}

export default function PopulationReportSection({ population, isDark }: { population: PopulationReport | null; isDark: boolean }) {
    const cardClass = `p-5 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`;
    const titleClass = `text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`;
    const mutedClass = `text-xs ${isDark ? "text-white/40" : "text-gray-500"}`;

    const header = (<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h2 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                <Users className="h-5 w-5 text-emerald-500" />
                Population Report
            </h2>
            <p className={`${mutedClass} mt-1 max-w-2xl`}>
                Age and gender of the people behind the reports, as shared on the report form or recorded by staff when encoding a concern. Counted per report.
            </p>
        </div>
        {population && (<Badge variant="outline" className={`w-fit ${isDark ? "border-white/10 text-white/50" : "border-gray-200 text-gray-600"}`}>
            All time · {population.total_reports} reports
        </Badge>)}
    </div>);

    if (!population) {
        return (<section className="space-y-3">
            {header}
            <div className={cardClass}>
                <p className={mutedClass}>
                    Population data isn&apos;t available. Make sure sql/011_add_population_and_intake_fields.sql has been run in the Supabase SQL Editor.
                </p>
            </div>
        </section>);
    }

    const total = population.total_reports;
    const encodedCount = total - (population.sources.web ?? 0);
    const genderItems: BarItem[] = GENDER_BUCKETS.map((bucket) => ({ ...bucket, count: population.gender[bucket.key] ?? 0 }));
    const ageRows = AGE_ROWS.map((row) => {
        const cells = population.age_by_gender[row.key];
        return { ...row, cells, count: GENDER_BUCKETS.reduce((sum, bucket) => sum + (cells?.[bucket.key] ?? 0), 0) };
    });
    const sourceItems: BarItem[] = INTAKE_SOURCES.map((source) => ({
        key: source,
        label: INTAKE_SOURCE_LABELS[source],
        count: population.sources[source] ?? 0,
        color: source === "web" ? "#10b981" : "#0ea5e9",
    }));
    const areaItems: BarItem[] = BARANGAY_AREAS.map((area) => ({
        key: area,
        label: BARANGAY_AREA_LABELS[area],
        count: population.areas[area] ?? 0,
        color: "#0ea5e9",
    }));
    const areaTotal = areaItems.reduce((sum, item) => sum + item.count, 0);

    const stats = [
        { label: "Reports with age", value: population.with_age, hint: `${percent(population.with_age, total)}% of all reports` },
        { label: "Reports with gender", value: population.with_gender, hint: `${percent(population.with_gender, total)}% of all reports` },
        { label: "Average age", value: population.average_age ?? "—", hint: population.with_age > 0 ? `From ${population.with_age} reports` : "No ages recorded yet" },
        { label: "Encoded by staff", value: encodedCount, hint: "Messenger, SMS, calls, walk-ins, referrals" },
    ];

    const cellClass = `py-2 px-2 text-right font-mono ${isDark ? "text-white/70" : "text-gray-700"}`;
    const rowBorder = `border-t ${isDark ? "border-white/[0.06]" : "border-gray-100"}`;

    return (<section className="space-y-4">
        {header}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (<div key={stat.label} className="flex flex-col gap-1 p-4 rounded-2xl border bg-card border-border">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{stat.label}</span>
                <span className="text-[10px] text-muted-foreground/80">{stat.hint}</span>
            </div>))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cardClass}>
                <h3 className={`${titleClass} mb-4`}>By gender</h3>
                <BarList items={genderItems} total={total} isDark={isDark} />
            </div>
            <div className={cardClass}>
                <h3 className={`${titleClass} mb-4`}>By age group</h3>
                <BarList items={ageRows} total={total} isDark={isDark} />
            </div>
        </div>

        <div className={cardClass}>
            <h3 className={titleClass}>Age group by gender</h3>
            <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                    <thead>
                        <tr className={isDark ? "text-white/40" : "text-gray-500"}>
                            <th className="py-2 pr-3 text-left font-medium">Age group</th>
                            {GENDER_BUCKETS.map((bucket) => (<th key={bucket.key} className="py-2 px-2 text-right font-medium">{bucket.label}</th>))}
                            <th className="py-2 px-2 text-right font-semibold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ageRows.map((row) => (<tr key={row.key} className={rowBorder}>
                            <td className={`py-2 pr-3 ${isDark ? "text-white/70" : "text-gray-700"}`}>{row.label}</td>
                            {GENDER_BUCKETS.map((bucket) => (<td key={bucket.key} className={cellClass}>{row.cells?.[bucket.key] ?? 0}</td>))}
                            <td className={`${cellClass} font-semibold`}>{row.count}</td>
                        </tr>))}
                    </tbody>
                    <tfoot>
                        <tr className={rowBorder}>
                            <td className={`py-2 pr-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Total</td>
                            {GENDER_BUCKETS.map((bucket) => (<td key={bucket.key} className={`${cellClass} font-semibold`}>{population.gender[bucket.key] ?? 0}</td>))}
                            <td className={`${cellClass} font-semibold`}>{total}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cardClass}>
                <h3 className={`${titleClass} mb-4`}>How concerns were received</h3>
                <BarList items={sourceItems} total={total} isDark={isDark} />
            </div>
            <div className={cardClass}>
                <h3 className={titleClass}>Area (encoded concerns)</h3>
                <p className={`${mutedClass} mt-1 mb-4`}>From the area staff record when encoding a concern.</p>
                {areaTotal > 0
                    ? <BarList items={areaItems} total={areaTotal} isDark={isDark} />
                    : <p className={mutedClass}>No areas recorded yet.</p>}
            </div>
        </div>
    </section>);
}
