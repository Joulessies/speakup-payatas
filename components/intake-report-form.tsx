"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ClipboardPen, Copy, Forward, ListChecks, Loader2, LockKeyhole, MessageCircle, MessageSquareText, PersonStanding, Phone, Send, type LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CategoryIcon } from "@/components/category-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGoogleMapsApiKey } from "@/lib/payatas-google-maps";
import {
    BARANGAY_AREAS,
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    CONCERN_DEPARTMENTS,
    EOC_STATUS_LABELS,
    EOC_STATUSES,
    EOC_URGENCY_LEVELS,
    GENDER_LABELS,
    GENDER_OPTIONS,
    INTAKE_CONCERN_TYPES,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    NATURE_OF_CONCERN_OPTIONS,
    REPORTER_AGE_MAX,
    REPORTER_AGE_MIN,
    STAFF_INTAKE_SOURCES,
    parseReporterAge,
    type BarangayArea,
    type EocStatus,
    type Gender,
    type IntakeSource,
    type NatureOfConcern,
    type ReportCategory,
} from "@/types";
import posthog from "posthog-js";

const ReportLocationPicker = dynamic(() => import("@/components/report-location-picker"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted/30" />,
});

// Radix Select items can't have an empty value, so "not specified" needs its own key.
const NOT_SPECIFIED = "__not_specified";

type StaffSource = (typeof STAFF_INTAKE_SOURCES)[number];

const SOURCE_ICONS: Record<StaffSource, LucideIcon> = {
    facebook_page: MessageCircle,
    text_messages: MessageSquareText,
    phone_call: Phone,
    walk_ins: PersonStanding,
    referral: Forward,
};

const URGENCY_COLORS: Record<(typeof EOC_URGENCY_LEVELS)[number]["value"], string> = {
    1: "bg-emerald-500",
    3: "bg-amber-500",
    5: "bg-red-500",
};

interface IntakeFormState {
    source: IntakeSource | "";
    eocStaff: string;
    receivedAt: string;
    nature: NatureOfConcern | "";
    reporterName: string;
    reporterContact: string;
    reporterAddress: string;
    reporterAge: string;
    reporterGender: Gender | "";
    area: BarangayArea | "";
    category: ReportCategory | "";
    description: string;
    severity: number;
    department: string;
    latitude: number | null;
    longitude: number | null;
    status: EocStatus;
    responders: string;
    remarks: string;
}

// Matches the server's allowance for clock differences between devices.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function padTime(value: number) {
    return String(value).padStart(2, "0");
}

/** Value for <input type="datetime-local">, in the computer's local time. */
function toDatetimeLocal(date: Date) {
    return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}T${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

/** datetime-local has no timezone. Read its parts as local time instead of letting Date parse them as UTC. */
function parseDatetimeLocal(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match)
        return new Date(NaN);
    const [, year, month, day, hour, minute] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
}

function createEmptyForm(): IntakeFormState {
    return {
        source: "",
        eocStaff: "",
        // Blank means "just now". A clock-based default would differ between the server render and the browser.
        receivedAt: "",
        nature: "",
        reporterName: "",
        reporterContact: "",
        reporterAddress: "",
        reporterAge: "",
        reporterGender: "",
        area: "",
        category: "",
        description: "",
        severity: 3,
        department: "",
        latitude: null,
        longitude: null,
        status: "pending",
        responders: "",
        remarks: "",
    };
}

type FieldErrors = Partial<Record<keyof IntakeFormState, string>>;

// In form order, so a failed save scrolls to the topmost problem.
const VALIDATED_FIELD_IDS: [keyof IntakeFormState, string][] = [
    ["source", "intake-source"],
    ["receivedAt", "intake-received"],
    ["nature", "intake-nature"],
    ["reporterAge", "intake-age"],
    ["category", "intake-category"],
    ["description", "intake-description"],
];

function replyMessage(receiptId: string): string {
    return `Natanggap na po ng Barangay Payatas ang inyong concern. Reference no.: ${receiptId}. Pakibanggit lang po ito kapag kayo ay mag-follow up.`;
}

export default function IntakeReportForm({ queueHref }: { queueHref: string }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [form, setForm] = useState<IntakeFormState>(createEmptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [saved, setSaved] = useState<{ id: string; receiptId: string } | null>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const hasMapPicker = Boolean(getGoogleMapsApiKey());

    useEffect(() => {
        if (saved || error) {
            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [saved, error]);

    useEffect(() => {
        setForm((prev) => (prev.receivedAt ? prev : { ...prev, receivedAt: toDatetimeLocal(new Date()) }));
    }, []);

    const update = <K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

    const cardClass = `p-4 md:p-6 rounded-2xl border shadow-sm space-y-4 ${isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-white border-emerald-200"}`;
    const sectionTitleClass = `text-sm font-semibold uppercase tracking-wider ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`;
    const labelClass = `text-xs font-medium ${isDark ? "text-white/70" : "text-gray-700"}`;
    const hintClass = `text-[11px] leading-snug ${isDark ? "text-white/45" : "text-gray-500"}`;
    const fieldClass = `h-10 ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-white"}`;
    const triggerClass = `w-full data-[size=default]:h-10 ${isDark ? "bg-white/5 border-white/10 text-white [&_svg]:text-white/50" : "bg-white"}`;
    const contentClass = isDark ? "border-white/10 bg-zinc-950 text-white" : "";
    const itemClass = isDark ? "focus:bg-white/10 focus:text-white data-highlighted:bg-white/10 data-highlighted:text-white" : "";
    const chipClass = (selected: boolean) =>
        `min-h-10 px-3 py-2 rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${selected
            ? isDark ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50" : "bg-emerald-50 text-[#064e3b] ring-1 ring-emerald-400"
            : isDark ? "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`;
    const invalidGroupClass = (key: keyof IntakeFormState) =>
        fieldErrors[key] ? "rounded-xl outline-2 outline-offset-4 outline-red-500/60" : "";
    const fieldError = (key: keyof IntakeFormState) => fieldErrors[key]
        ? <p role="alert" className={`text-xs font-medium ${isDark ? "text-red-300" : "text-red-600"}`}>{fieldErrors[key]}</p>
        : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const receivedAt = form.receivedAt ? parseDatetimeLocal(form.receivedAt) : new Date();
        const errors: FieldErrors = {};
        if (!form.source)
            errors.source = "Choose where the concern was received.";
        if (Number.isNaN(receivedAt.getTime()))
            errors.receivedAt = "Enter a valid date and time received.";
        else if (receivedAt.getTime() > Date.now() + CLOCK_SKEW_MS)
            errors.receivedAt = "Date received can't be in the future.";
        if (!form.nature)
            errors.nature = "Choose the nature of the concern.";
        if (form.reporterAge && parseReporterAge(form.reporterAge) === null)
            errors.reporterAge = `Age must be a whole number from ${REPORTER_AGE_MIN} to ${REPORTER_AGE_MAX}.`;
        if (!form.category)
            errors.category = "Choose the type of concern.";
        if (!form.description.trim())
            errors.description = "Describe the concern.";
        setFieldErrors(errors);
        const firstInvalid = VALIDATED_FIELD_IDS.find(([key]) => errors[key]);
        if (firstInvalid) {
            const [, elementId] = firstInvalid;
            // Waits for the re-render, so a dismissed error banner can't shift the field after scrolling.
            requestAnimationFrame(() => document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
            return;
        }

        setSaved(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/reports/intake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source: form.source,
                    eoc_staff: form.eocStaff,
                    eoc_status: form.status,
                    received_at: receivedAt.toISOString(),
                    nature_of_concern: form.nature,
                    reporter_name: form.reporterName,
                    reporter_contact: form.reporterContact,
                    reporter_address: form.reporterAddress,
                    reporter_age: form.reporterAge || null,
                    reporter_gender: form.reporterGender || null,
                    area: form.area || null,
                    category: form.category,
                    description: form.description,
                    severity: form.severity,
                    concern_department: form.department || null,
                    latitude: form.latitude,
                    longitude: form.longitude,
                    status: form.status,
                    responders: form.responders,
                    remarks: form.remarks,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(typeof data.error === "string" ? data.error : "Failed to save the report.");
                return;
            }
            const receiptId = typeof data.report?.receipt_id === "string" ? data.report.receipt_id : "";
            if (posthog.__loaded) {
                posthog.capture("intake_report_created", {
                    source: form.source,
                    category: form.category,
                    severity: form.severity,
                    status: form.status,
                    has_location: form.latitude !== null && form.longitude !== null,
                });
            }
            setSaved({ id: typeof data.report?.id === "string" ? data.report.id : "", receiptId });
            setForm(createEmptyForm());
            toast.success("Report encoded", receiptId ? { description: `Reference no. ${receiptId}` } : undefined);
        }
        catch {
            setError("Network error. Check your connection and try again.");
        }
        finally {
            setSubmitting(false);
        }
    };

    const copyReply = async () => {
        if (!saved?.receiptId)
            return;
        try {
            await navigator.clipboard.writeText(replyMessage(saved.receiptId));
            toast.success("Reply copied");
        }
        catch {
            toast.error("Couldn't copy. Select the text and copy it manually.");
        }
    };

    return (<div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
        <div ref={topRef} className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 space-y-6 scroll-mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? "bg-emerald-500/15" : "bg-[#e6f4ea]"}`}>
                        <ClipboardPen className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                            Encode Report
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-[#047857]"}`}>
                            Log concerns received by Messenger, text, phone call, walk-in, or referral from residents who can&apos;t use SpeakUp.
                        </p>
                    </div>
                </div>
                <Link href={queueHref} className={`flex shrink-0 items-center gap-2 whitespace-nowrap self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${isDark
                    ? "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/10"
                    : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 shadow-sm"}`}>
                    <ListChecks className="h-4 w-4 text-emerald-500" />
                    View reports
                </Link>
            </div>

            {saved && (<div className={`rounded-2xl border p-4 space-y-3 ${isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"}`}>
                <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${isDark ? "text-emerald-200" : "text-[#064e3b]"}`}>
                            Report saved{saved.receiptId ? <> · Reference no. <span className="font-mono">{saved.receiptId}</span></> : null}
                        </p>
                        <p className={hintClass}>
                            It&apos;s saved as verified, so it won&apos;t appear under Unreviewed. Reply to the complainant with the reference number so they can follow up:
                        </p>
                    </div>
                    {saved.id && (<Link href={`${queueHref}?id=${encodeURIComponent(saved.id)}`} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isDark
                        ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                        : "bg-white text-[#047857] border border-emerald-200 hover:bg-emerald-100"}`}>
                        Open report
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>)}
                </div>
                {saved.receiptId && (<div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className={`flex-1 rounded-xl px-3 py-2 text-xs leading-relaxed ${isDark ? "bg-black/20 text-white/80" : "bg-white text-gray-700 border border-emerald-100"}`}>
                        {replyMessage(saved.receiptId)}
                    </p>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyReply}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy reply
                    </Button>
                </div>)}
            </div>)}

            {error && (<Alert variant="destructive" className="rounded-xl">
                <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>)}

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className={cardClass}>
                    <h2 className={sectionTitleClass}>Concern received</h2>
                    <div className="@container space-y-1.5">
                        <span className={`block ${labelClass}`}>Source of concern *</span>
                        {/* Five options only fill a two- or three-column grid when the first one spans two columns. */}
                        <div id="intake-source" role="radiogroup" aria-label="Source of concern" aria-invalid={Boolean(fieldErrors.source)} className={`grid grid-cols-2 @md:grid-cols-3 gap-2 ${invalidGroupClass("source")}`}>
                            {STAFF_INTAKE_SOURCES.map((source) => {
                                const Icon = SOURCE_ICONS[source];
                                return (<button key={source} type="button" role="radio" aria-checked={form.source === source} onClick={() => update("source", source)} className={`${chipClass(form.source === source)} flex items-center justify-center gap-2 text-center leading-tight`}>
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {INTAKE_SOURCE_LABELS[source]}
                                </button>);
                            })}
                        </div>
                        {fieldError("source")}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-received" className={labelClass}>Date and time</Label>
                            <Input id="intake-received" type="datetime-local" max={toDatetimeLocal(new Date())} aria-invalid={Boolean(fieldErrors.receivedAt)} value={form.receivedAt} onChange={(e) => {
                                const value = e.target.value;
                                const parsed = value ? parseDatetimeLocal(value) : null;
                                update("receivedAt", parsed && parsed.getTime() > Date.now() + CLOCK_SKEW_MS ? toDatetimeLocal(new Date()) : value);
                            }} className={`${fieldClass} ${isDark ? "[color-scheme:dark]" : ""}`} />
                            {fieldError("receivedAt") ?? <p className={hintClass}>Starts at the current time. Set it earlier if the concern came in before now.</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-eoc-staff" className={labelClass}>EOC staff</Label>
                            <Input id="intake-eoc-staff" autoComplete="name" maxLength={120} value={form.eocStaff} onChange={(e) => update("eocStaff", e.target.value)} className={fieldClass} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <span className={`block ${labelClass}`}>Nature of concern *</span>
                            <div id="intake-nature" role="radiogroup" aria-label="Nature of concern" aria-invalid={Boolean(fieldErrors.nature)} className={`grid grid-cols-3 gap-2 ${invalidGroupClass("nature")}`}>
                                {NATURE_OF_CONCERN_OPTIONS.map((nature) => (<button key={nature} type="button" role="radio" aria-checked={form.nature === nature} onClick={() => update("nature", nature)} className={`${chipClass(form.nature === nature)} text-center`}>
                                    {NATURE_OF_CONCERN_LABELS[nature]}
                                </button>))}
                            </div>
                            {fieldError("nature")}
                        </div>
                    </div>
                </section>

                <section className={cardClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className={sectionTitleClass}>Complainant</h2>
                        <span className={`inline-flex items-center gap-1 ${hintClass}`}>
                            <LockKeyhole className="h-3 w-3" />
                            Only staff and admins can see these details
                        </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-name" className={labelClass}>Name</Label>
                            <Input id="intake-name" autoComplete="off" maxLength={200} value={form.reporterName} onChange={(e) => update("reporterName", e.target.value)} className={fieldClass} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-contact" className={labelClass}>Contact number</Label>
                            <Input id="intake-contact" autoComplete="off" maxLength={100} value={form.reporterContact} onChange={(e) => update("reporterContact", e.target.value)} className={fieldClass} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-[6rem_1fr] gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="intake-age" className={labelClass}>Age</Label>
                                    <Input id="intake-age" inputMode="numeric" autoComplete="off" maxLength={3} aria-invalid={Boolean(fieldErrors.reporterAge)} value={form.reporterAge} onChange={(e) => update("reporterAge", e.target.value.replace(/\D/g, ""))} className={fieldClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="intake-gender" className={labelClass}>Sex</Label>
                                    <Select value={form.reporterGender} onValueChange={(v) => update("reporterGender", v === NOT_SPECIFIED ? "" : (v as Gender))}>
                                        <SelectTrigger id="intake-gender" className={triggerClass}>
                                            <SelectValue placeholder="Not specified" />
                                        </SelectTrigger>
                                        <SelectContent className={contentClass}>
                                            <SelectItem value={NOT_SPECIFIED} className={itemClass}>Not specified</SelectItem>
                                            {GENDER_OPTIONS.map((gender) => (<SelectItem key={gender} value={gender} className={itemClass}>
                                                {GENDER_LABELS[gender]}
                                            </SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {fieldError("reporterAge")}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-area" className={labelClass}>Area</Label>
                            <Select value={form.area} onValueChange={(v) => update("area", v === NOT_SPECIFIED ? "" : (v as BarangayArea))}>
                                <SelectTrigger id="intake-area" className={triggerClass}>
                                    <SelectValue placeholder="Not specified" />
                                </SelectTrigger>
                                <SelectContent className={contentClass}>
                                    <SelectItem value={NOT_SPECIFIED} className={itemClass}>Not specified</SelectItem>
                                    {BARANGAY_AREAS.map((area) => (<SelectItem key={area} value={area} className={itemClass}>
                                        {BARANGAY_AREA_LABELS[area]}
                                    </SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="intake-address" className={labelClass}>Address</Label>
                            <Input id="intake-address" autoComplete="off" maxLength={300} value={form.reporterAddress} onChange={(e) => update("reporterAddress", e.target.value)} className={fieldClass} />
                        </div>
                    </div>
                    <p className={hintClass}>Age and sex feed the population report on the Analytics page. Leave them blank if the complainant didn&apos;t say.</p>
                </section>

                <section className={cardClass}>
                    <h2 className={sectionTitleClass}>Concern details</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-category" className={labelClass}>Type of concern *</Label>
                            <Select value={form.category} onValueChange={(v) => update("category", v as ReportCategory)}>
                                <SelectTrigger id="intake-category" aria-invalid={Boolean(fieldErrors.category)} className={triggerClass}>
                                    <SelectValue placeholder="Choose a type" />
                                </SelectTrigger>
                                <SelectContent position="popper" className={`max-h-80 ${contentClass}`}>
                                    {INTAKE_CONCERN_TYPES.map((key) => (<SelectItem key={key} value={key} className={itemClass}>
                                        <CategoryIcon category={key} className="h-4 w-4" />
                                        {CATEGORY_LABELS[key]}
                                    </SelectItem>))}
                                </SelectContent>
                            </Select>
                            {fieldError("category")}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-department" className={labelClass}>Concern department</Label>
                            <Select value={form.department} onValueChange={(v) => update("department", v === NOT_SPECIFIED ? "" : v)}>
                                <SelectTrigger id="intake-department" className={triggerClass}>
                                    <SelectValue placeholder="Not assigned" />
                                </SelectTrigger>
                                <SelectContent position="popper" className={`max-h-80 ${contentClass}`}>
                                    <SelectItem value={NOT_SPECIFIED} className={itemClass}>Not assigned</SelectItem>
                                    {CONCERN_DEPARTMENTS.map((department) => (<SelectItem key={department} value={department} className={itemClass}>
                                        {department}
                                    </SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="intake-description" className={labelClass}>Concern *</Label>
                        <Textarea id="intake-description" rows={4} maxLength={5000} placeholder="What the complainant reported, in their words where possible" aria-invalid={Boolean(fieldErrors.description)} value={form.description} onChange={(e) => update("description", e.target.value)} className={`resize-y text-sm ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-white"}`} />
                        {fieldError("description")}
                    </div>
                    <div className="space-y-1.5">
                        <span className={`block ${labelClass}`}>Urgency</span>
                        <div role="radiogroup" aria-label="Urgency" className="grid grid-cols-3 gap-2">
                            {EOC_URGENCY_LEVELS.map((level) => {
                                const selected = form.severity === level.value;
                                return (<button key={level.value} type="button" role="radio" aria-checked={selected} onClick={() => update("severity", level.value)} className={`${chipClass(selected)} flex items-center justify-center gap-1.5`}>
                                    <span className={`w-2.5 h-2.5 rounded-full ${URGENCY_COLORS[level.value]} ${selected ? "opacity-100" : "opacity-40"}`} />
                                    {level.label}
                                </button>);
                            })}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className={labelClass}>Location (optional)</span>
                            {form.latitude !== null && (<button type="button" onClick={() => setForm((prev) => ({ ...prev, latitude: null, longitude: null }))} className={`text-[11px] font-medium underline-offset-2 hover:underline ${isDark ? "text-emerald-300" : "text-[#059669]"}`}>
                                Remove pin
                            </button>)}
                        </div>
                        {hasMapPicker && (<ReportLocationPicker latitude={form.latitude} longitude={form.longitude} isDark={isDark} outsideBoundaryWarning="This pin is outside Barangay Payatas." onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))} />)}
                        <p className={hintClass}>
                            {form.latitude !== null && form.longitude !== null
                                ? `Pinned at ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}.`
                                : hasMapPicker
                                    ? "Tap the map if the complainant gave an exact spot. Without a pin, the report is saved without a location and left off the hotspot map."
                                    : "The map isn't available, so this report will be saved without a location and left off the hotspot map."}
                        </p>
                    </div>
                </section>

                <section className={cardClass}>
                    <h2 className={sectionTitleClass}>Status</h2>
                    <div role="radiogroup" aria-label="Status" className="grid gap-2 sm:grid-cols-2">
                        {EOC_STATUSES.map((status) => (<button key={status} type="button" role="radio" aria-checked={form.status === status} onClick={() => update("status", status)} className={`${chipClass(form.status === status)} text-left`}>
                            <span className="block font-semibold">{EOC_STATUS_LABELS[status]}</span>
                        </button>))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-responders" className={labelClass}>Responders</Label>
                            <Input id="intake-responders" autoComplete="off" maxLength={300} value={form.responders} onChange={(e) => update("responders", e.target.value)} className={fieldClass} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="intake-remarks" className={labelClass}>Remarks</Label>
                            <Input id="intake-remarks" autoComplete="off" maxLength={2000} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} className={fieldClass} />
                        </div>
                    </div>
                    <p className={hintClass}>Responders and remarks stay internal. Residents tracking the report only see the status.</p>
                </section>

                <Button type="submit" disabled={submitting} className="w-full min-h-11 gap-2 rounded-xl text-sm font-semibold bg-[#059669] hover:bg-[#047857] text-white shadow-sm">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? "Saving…" : "Save report"}
                </Button>
            </form>
        </div>
    </div>);
}
