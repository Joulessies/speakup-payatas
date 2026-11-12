"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
    ArrowRight,
    CheckCircle2,
    ClipboardPen,
    Copy,
    Forward,
    ListChecks,
    Loader2,
    LockKeyhole,
    MapPin,
    MessageCircle,
    MessageSquareText,
    PersonStanding,
    Phone,
    RotateCcw,
    Send,
    Smartphone,
    Sparkles,
    Upload,
    X,
    type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CategoryIcon } from "@/components/category-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGoogleMapsApiKey } from "@/lib/payatas-google-maps";
import { PAYATAS_AREAS } from "@/lib/payatas-boundary";
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

const ReportLocationPicker = dynamic(() => import("@/components/report-location-picker"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted/30" />,
});

const NOT_SPECIFIED = "__not_specified";
const DRAFT_KEY = "speakup_intake_draft";
const CLOCK_SKEW_MS = 5 * 60 * 1000;

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
    photo_url: string;
}

function padTime(value: number) {
    return String(value).padStart(2, "0");
}

function toDatetimeLocal(date: Date) {
    return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}T${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
}

function parseDatetimeLocal(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match) return new Date(NaN);
    const [, year, month, day, hour, minute] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
}

function createEmptyForm(): IntakeFormState {
    return {
        source: "",
        eocStaff: "",
        receivedAt: typeof window !== "undefined" ? toDatetimeLocal(new Date()) : "",
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
        photo_url: "",
    };
}

function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 1280;
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(reader.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.75));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

type FieldErrors = Partial<Record<keyof IntakeFormState, string>>;

const VALIDATED_FIELD_IDS: [keyof IntakeFormState, string][] = [
    ["source", "intake-source"],
    ["receivedAt", "intake-received"],
    ["nature", "intake-nature"],
    ["reporterAge", "intake-age"],
    ["category", "intake-category"],
    ["description", "intake-description"],
];

function replyMessage(receiptId: string): string {
    return `Natanggap na po ng Barangay Payatas ang inyong concern. Reference no.: ${receiptId}. Pakibanggit lang po ito kapag kayo ay mag-follow up sa speakupayatas.com/track.`;
}

export default function IntakeReportForm({ queueHref }: { queueHref: string }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [form, setForm] = useState<IntakeFormState>(createEmptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [aiClassifying, setAiClassifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [saved, setSaved] = useState<{ id: string; receiptId: string; contact?: string } | null>(null);
    const [sendingSms, setSendingSms] = useState(false);
    const [smsSent, setSmsSent] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    const topRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasMapPicker = Boolean(getGoogleMapsApiKey());

    // Check for saved local draft on mount
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.description || parsed.reporterName || parsed.source)) {
                    setHasDraft(true);
                }
            }
        } catch {}
    }, []);

    // Debounced draft auto-save
    useEffect(() => {
        if (typeof window === "undefined" || saved) return;
        if (!form.source && !form.description && !form.reporterName && !form.reporterContact) return;
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
            } catch {}
        }, 600);
        return () => clearTimeout(timer);
    }, [form, saved]);

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

    const restoreDraft = () => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                setForm((prev) => ({
                    ...prev,
                    ...parsed,
                    receivedAt: parsed.receivedAt || toDatetimeLocal(new Date()),
                }));
                setHasDraft(false);
                toast.success("Draft restored from previous session");
            }
        } catch {
            toast.error("Could not load draft.");
        }
    };

    const discardDraft = () => {
        try {
            localStorage.removeItem(DRAFT_KEY);
            setHasDraft(false);
            toast.info("Draft discarded");
        } catch {}
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImage(file);
            update("photo_url", compressed);
            toast.success("Photo attached and compressed");
        } catch {
            toast.error("Failed to process image. Try a smaller file.");
        }
    };

    const handleAutoClassify = async () => {
        if (!form.description.trim()) {
            toast.error("Please enter a concern description first.");
            return;
        }
        setAiClassifying(true);
        try {
            const res = await fetch("/api/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: form.description, area: form.area }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.category) {
                    update("category", data.category);
                    if (data.department) {
                        update("department", data.department);
                    }
                    if (data.urgency) {
                        const urgencyMap: Record<string, number> = { LOW: 1, MEDIUM: 3, HIGH: 5 };
                        update("severity", urgencyMap[data.urgency] || 3);
                    }
                    toast.success(`AI Suggested: ${CATEGORY_LABELS[data.category as ReportCategory] || data.category}`, {
                        description: `${data.department ? `Department: ${data.department} • ` : ""}${Math.round(
                            (data.confidence || 0.9) * 100
                        )}% match confidence`,
                    });
                }
            } else {
                toast.error("AI couldn't classify this automatically. Please select manually.");
            }
        } catch {
            toast.error("Classification service unavailable.");
        } finally {
            setAiClassifying(false);
        }
    };

    const selectLandmark = (item: (typeof PAYATAS_AREAS)[number]) => {
        update("latitude", item.lat);
        update("longitude", item.lng);
        let areaKey: BarangayArea = "others";
        if (item.name.includes("Payatas A")) areaKey = "area_a";
        else if (item.name.includes("Payatas B")) areaKey = "area_b";
        else if (item.name.includes("Lupang Pangako")) areaKey = "lupang_pangako";
        else if (item.name.includes("Group")) areaKey = "group_13";
        update("area", areaKey);
        toast.success(`Pinned at ${item.name}`, { description: `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` });
    };

    const handleSendSms = async () => {
        if (!saved?.receiptId || !saved.contact) return;
        setSendingSms(true);
        try {
            const res = await fetch("/api/reports/intake/sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contact: saved.contact, receipt_id: saved.receiptId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSmsSent(true);
                toast.success("SMS confirmation sent!", { description: `Dispatched to ${saved.contact}` });
            } else {
                toast.error(data.error || "Failed to send SMS confirmation.");
            }
        } catch {
            toast.error("Network error sending SMS.");
        } finally {
            setSendingSms(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const receivedAt = form.receivedAt ? parseDatetimeLocal(form.receivedAt) : new Date();
        const errors: FieldErrors = {};
        if (!form.source) errors.source = "Choose where the concern was received.";
        if (Number.isNaN(receivedAt.getTime())) errors.receivedAt = "Enter a valid date and time received.";
        else if (receivedAt.getTime() > Date.now() + CLOCK_SKEW_MS) errors.receivedAt = "Date received can't be in the future.";
        if (!form.nature) errors.nature = "Choose the nature of the concern.";
        if (form.reporterAge && parseReporterAge(form.reporterAge) === null)
            errors.reporterAge = `Age must be a whole number from ${REPORTER_AGE_MIN} to ${REPORTER_AGE_MAX}.`;
        if (!form.category) errors.category = "Choose the type of concern.";
        if (!form.description.trim()) errors.description = "Describe the concern.";

        setFieldErrors(errors);
        const firstInvalid = VALIDATED_FIELD_IDS.find(([key]) => errors[key]);
        if (firstInvalid) {
            const [, elementId] = firstInvalid;
            requestAnimationFrame(() => document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
            return;
        }

        setSaved(null);
        setSubmitting(true);
        setSmsSent(false);

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
                    photo_url: form.photo_url || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(typeof data.error === "string" ? data.error : "Failed to save the report.");
                return;
            }
            const receiptId = typeof data.report?.receipt_id === "string" ? data.report.receipt_id : "";
            const contact = form.reporterContact.trim();
            setSaved({ id: typeof data.report?.id === "string" ? data.report.id : "", receiptId, contact });

            try {
                localStorage.removeItem(DRAFT_KEY);
            } catch {}

            setForm(createEmptyForm());
            toast.success("Report encoded", receiptId ? { description: `Reference no. ${receiptId}` } : undefined);
        } catch {
            setError("Network error. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const copyReply = async () => {
        if (!saved?.receiptId) return;
        try {
            await navigator.clipboard.writeText(replyMessage(saved.receiptId));
            toast.success("Reply copied to clipboard");
        } catch {
            toast.error("Couldn't copy. Select the text and copy it manually.");
        }
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
        `min-h-10 px-3 py-2 rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
            selected
                ? isDark
                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50"
                    : "bg-emerald-50 text-[#064e3b] ring-1 ring-emerald-400"
                : isDark
                    ? "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
        }`;
    const invalidGroupClass = (key: keyof IntakeFormState) =>
        fieldErrors[key] ? "rounded-xl outline-2 outline-offset-4 outline-red-500/60" : "";
    const fieldError = (key: keyof IntakeFormState) =>
        fieldErrors[key] ? (
            <p role="alert" className={`text-xs font-medium ${isDark ? "text-red-300" : "text-red-600"}`}>
                {fieldErrors[key]}
            </p>
        ) : null;

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div ref={topRef} className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 space-y-6 scroll-mt-4">
                {/* Header */}
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
                                Log concerns received by Messenger, text, phone call, walk-in, or referral with AI triage.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={queueHref}
                        className={`flex shrink-0 items-center gap-2 whitespace-nowrap self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                            isDark
                                ? "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/10"
                                : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 shadow-sm"
                        }`}
                    >
                        <ListChecks className="h-4 w-4 text-emerald-500" />
                        View reports
                    </Link>
                </div>

                {/* Unsaved draft recovery banner */}
                {hasDraft && !saved && (
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <RotateCcw className="h-4 w-4 shrink-0 text-amber-500" />
                            <span className="truncate">Unsaved intake report draft found from previous session.</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={restoreDraft}
                                className="h-7 text-xs font-semibold px-2.5 bg-white/10"
                            >
                                Restore
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={discardDraft}
                                className="h-7 text-xs px-2 opacity-70 hover:opacity-100"
                            >
                                Discard
                            </Button>
                        </div>
                    </div>
                )}

                {/* Save Confirmation with SMS Dispatch */}
                {saved && (
                    <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"}`}>
                        <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-500" />
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold ${isDark ? "text-emerald-200" : "text-[#064e3b]"}`}>
                                    Report saved{saved.receiptId ? <> · Reference no. <span className="font-mono">{saved.receiptId}</span></> : null}
                                </p>
                                <p className={hintClass}>
                                    Saved and verified. Reply to the complainant with the reference number so they can track its status:
                                </p>
                            </div>
                            {saved.id && (
                                <Link
                                    href={`${queueHref}?id=${encodeURIComponent(saved.id)}`}
                                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                        isDark
                                            ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                                            : "bg-white text-[#047857] border border-emerald-200 hover:bg-emerald-100"
                                    }`}
                                >
                                    Open report
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            )}
                        </div>

                        {/* Complainant Reply Box */}
                        {saved.receiptId && (
                            <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <p className={`flex-1 rounded-xl px-3 py-2 text-xs leading-relaxed select-all ${isDark ? "bg-black/20 text-white/80" : "bg-white text-gray-700 border border-emerald-100"}`}>
                                        {replyMessage(saved.receiptId)}
                                    </p>
                                    <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyReply}>
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy reply
                                    </Button>
                                </div>

                                {/* Instant SMS Dispatch Option */}
                                {saved.contact && saved.contact.replace(/\D/g, "").slice(-10).length === 10 && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={sendingSms || smsSent}
                                            onClick={handleSendSms}
                                            className={`gap-1.5 text-xs font-semibold ${
                                                smsSent
                                                    ? "bg-emerald-700 text-white"
                                                    : "bg-[#059669] hover:bg-[#047857] text-white shadow-sm"
                                            }`}
                                        >
                                            {sendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                                            {smsSent ? "SMS Confirmation Sent ✓" : `Send SMS Confirmation to ${saved.contact}`}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="rounded-xl">
                        <AlertDescription className="text-sm">{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Concern Received */}
                    <section className={cardClass}>
                        <h2 className={sectionTitleClass}>Concern received</h2>
                        <div className="@container space-y-1.5">
                            <span className={`block ${labelClass}`}>Source of concern *</span>
                            <div
                                id="intake-source"
                                role="radiogroup"
                                aria-label="Source of concern"
                                aria-invalid={Boolean(fieldErrors.source)}
                                className={`grid grid-cols-2 @md:grid-cols-3 gap-2 ${invalidGroupClass("source")}`}
                            >
                                {STAFF_INTAKE_SOURCES.map((source) => {
                                    const Icon = SOURCE_ICONS[source];
                                    return (
                                        <button
                                            key={source}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.source === source}
                                            onClick={() => update("source", source)}
                                            className={`${chipClass(form.source === source)} flex items-center justify-center gap-2 text-center leading-tight`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            {INTAKE_SOURCE_LABELS[source]}
                                        </button>
                                    );
                                })}
                            </div>
                            {fieldError("source")}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-received" className={labelClass}>Date and time received</Label>
                                <Input
                                    id="intake-received"
                                    type="datetime-local"
                                    max={toDatetimeLocal(new Date())}
                                    aria-invalid={Boolean(fieldErrors.receivedAt)}
                                    value={form.receivedAt}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const parsed = value ? parseDatetimeLocal(value) : null;
                                        update("receivedAt", parsed && parsed.getTime() > Date.now() + CLOCK_SKEW_MS ? toDatetimeLocal(new Date()) : value);
                                    }}
                                    className={`${fieldClass} ${isDark ? "[color-scheme:dark]" : ""}`}
                                />
                                {fieldError("receivedAt") ?? <p className={hintClass}>Current timestamp default. Adjust if received earlier.</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-eoc-staff" className={labelClass}>EOC staff / Encoder</Label>
                                <Input
                                    id="intake-eoc-staff"
                                    autoComplete="name"
                                    maxLength={120}
                                    placeholder="Encoder name or badge no."
                                    value={form.eocStaff}
                                    onChange={(e) => update("eocStaff", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <span className={`block ${labelClass}`}>Nature of concern *</span>
                                <div
                                    id="intake-nature"
                                    role="radiogroup"
                                    aria-label="Nature of concern"
                                    aria-invalid={Boolean(fieldErrors.nature)}
                                    className={`grid grid-cols-3 gap-2 ${invalidGroupClass("nature")}`}
                                >
                                    {NATURE_OF_CONCERN_OPTIONS.map((nature) => (
                                        <button
                                            key={nature}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.nature === nature}
                                            onClick={() => update("nature", nature)}
                                            className={`${chipClass(form.nature === nature)} text-center`}
                                        >
                                            {NATURE_OF_CONCERN_LABELS[nature]}
                                        </button>
                                    ))}
                                </div>
                                {fieldError("nature")}
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Complainant Details */}
                    <section className={cardClass}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className={sectionTitleClass}>Complainant</h2>
                            <span className={`inline-flex items-center gap-1 ${hintClass}`}>
                                <LockKeyhole className="h-3 w-3" />
                                Private: Only staff and admins can see these details
                            </span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-name" className={labelClass}>Name</Label>
                                <Input
                                    id="intake-name"
                                    autoComplete="off"
                                    maxLength={200}
                                    placeholder="Complainant name"
                                    value={form.reporterName}
                                    onChange={(e) => update("reporterName", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-contact" className={labelClass}>Contact number (Mobile)</Label>
                                <Input
                                    id="intake-contact"
                                    autoComplete="off"
                                    maxLength={100}
                                    placeholder="e.g. 09171234567"
                                    value={form.reporterContact}
                                    onChange={(e) => update("reporterContact", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-[6rem_1fr] gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="intake-age" className={labelClass}>Age</Label>
                                        <Input
                                            id="intake-age"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            maxLength={3}
                                            placeholder="Age"
                                            aria-invalid={Boolean(fieldErrors.reporterAge)}
                                            value={form.reporterAge}
                                            onChange={(e) => update("reporterAge", e.target.value.replace(/\D/g, ""))}
                                            className={fieldClass}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="intake-gender" className={labelClass}>Sex</Label>
                                        <Select
                                            value={form.reporterGender}
                                            onValueChange={(v) => update("reporterGender", v === NOT_SPECIFIED ? "" : (v as Gender))}
                                        >
                                            <SelectTrigger id="intake-gender" className={triggerClass}>
                                                <SelectValue placeholder="Not specified" />
                                            </SelectTrigger>
                                            <SelectContent className={contentClass}>
                                                <SelectItem value={NOT_SPECIFIED} className={itemClass}>Not specified</SelectItem>
                                                {GENDER_OPTIONS.map((gender) => (
                                                    <SelectItem key={gender} value={gender} className={itemClass}>
                                                        {GENDER_LABELS[gender]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {fieldError("reporterAge")}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-area" className={labelClass}>Area</Label>
                                <Select
                                    value={form.area}
                                    onValueChange={(v) => update("area", v === NOT_SPECIFIED ? "" : (v as BarangayArea))}
                                >
                                    <SelectTrigger id="intake-area" className={triggerClass}>
                                        <SelectValue placeholder="Not specified" />
                                    </SelectTrigger>
                                    <SelectContent className={contentClass}>
                                        <SelectItem value={NOT_SPECIFIED} className={itemClass}>Not specified</SelectItem>
                                        {BARANGAY_AREAS.map((area) => (
                                            <SelectItem key={area} value={area} className={itemClass}>
                                                {BARANGAY_AREA_LABELS[area]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="intake-address" className={labelClass}>Street Address</Label>
                                <Input
                                    id="intake-address"
                                    autoComplete="off"
                                    maxLength={300}
                                    placeholder="House/Lot, Street, Sitio, Payatas"
                                    value={form.reporterAddress}
                                    onChange={(e) => update("reporterAddress", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Concern Details & AI Triage */}
                    <section className={cardClass}>
                        <div className="flex items-center justify-between">
                            <h2 className={sectionTitleClass}>Concern details</h2>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={aiClassifying || !form.description.trim()}
                                onClick={handleAutoClassify}
                                className={`h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl transition-all ${
                                    isDark
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                        : "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                                }`}
                            >
                                {aiClassifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                                {aiClassifying ? "AI Detecting…" : "Auto-Suggest with AI"}
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="intake-description" className={labelClass}>Concern description *</Label>
                            <Textarea
                                id="intake-description"
                                rows={4}
                                maxLength={5000}
                                placeholder="Type the concern in complainant's words, then click 'Auto-Suggest with AI' to automatically triage"
                                aria-invalid={Boolean(fieldErrors.description)}
                                value={form.description}
                                onChange={(e) => update("description", e.target.value)}
                                className={`resize-y text-sm ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-white"}`}
                            />
                            {fieldError("description")}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-category" className={labelClass}>Type of concern *</Label>
                                <Select value={form.category} onValueChange={(v) => update("category", v as ReportCategory)}>
                                    <SelectTrigger id="intake-category" aria-invalid={Boolean(fieldErrors.category)} className={triggerClass}>
                                        <SelectValue placeholder="Choose a type or use AI auto-suggest" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className={`max-h-80 ${contentClass}`}>
                                        {INTAKE_CONCERN_TYPES.map((key) => (
                                            <SelectItem key={key} value={key} className={itemClass}>
                                                <CategoryIcon category={key} className="h-4 w-4" />
                                                {CATEGORY_LABELS[key]}
                                            </SelectItem>
                                        ))}
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
                                        {CONCERN_DEPARTMENTS.map((department) => (
                                            <SelectItem key={department} value={department} className={itemClass}>
                                                {department}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <span className={`block ${labelClass}`}>Urgency</span>
                            <div role="radiogroup" aria-label="Urgency" className="grid grid-cols-3 gap-2">
                                {EOC_URGENCY_LEVELS.map((level) => {
                                    const selected = form.severity === level.value;
                                    return (
                                        <button
                                            key={level.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => update("severity", level.value)}
                                            className={`${chipClass(selected)} flex items-center justify-center gap-1.5`}
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full ${URGENCY_COLORS[level.value]} ${selected ? "opacity-100" : "opacity-40"}`} />
                                            {level.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Photo / Screenshot Evidence Upload */}
                        <div className="space-y-2 pt-2 border-t border-emerald-500/10">
                            <div className="flex items-center justify-between">
                                <Label className={labelClass}>Evidence Photo / Screenshot (optional)</Label>
                                {form.photo_url && (
                                    <button
                                        type="button"
                                        onClick={() => update("photo_url", "")}
                                        className={`text-[11px] font-medium underline-offset-2 hover:underline ${isDark ? "text-red-300" : "text-red-600"}`}
                                    >
                                        Remove photo
                                    </button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoChange}
                            />
                            {form.photo_url ? (
                                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-emerald-500/30 bg-black/20 flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={form.photo_url} alt="Attached incident evidence" className="w-full h-full object-contain" />
                                    <button
                                        type="button"
                                        onClick={() => update("photo_url", "")}
                                        aria-label="Remove photo"
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full min-h-11 gap-2 rounded-xl text-xs font-medium ${
                                        isDark ? "border-white/10 hover:bg-white/[0.06] text-white/80" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                                    }`}
                                >
                                    <Upload className="h-4 w-4 text-emerald-500" />
                                    Upload Photo / Messenger Screenshot
                                </Button>
                            )}
                            <p className={hintClass}>Attach photos sent via Viber, Messenger, or text. Automatically compressed for fast storage.</p>
                        </div>

                        {/* Location & Payatas Landmark Quick Selector */}
                        <div className="space-y-3 pt-2 border-t border-emerald-500/10">
                            <div className="flex items-center justify-between gap-2">
                                <span className={labelClass}>Location & Landmarks (optional)</span>
                                {form.latitude !== null && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, latitude: null, longitude: null }))}
                                        className={`text-[11px] font-medium underline-offset-2 hover:underline ${isDark ? "text-emerald-300" : "text-[#059669]"}`}
                                    >
                                        Remove pin
                                    </button>
                                )}
                            </div>

                            {/* Landmark Quick Buttons */}
                            <div className="space-y-1.5">
                                <span className={`block text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                    Payatas Sub-Areas / Landmark Quick-Pins
                                </span>
                                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 max-h-28 overflow-y-auto">
                                    {PAYATAS_AREAS.map((landmark) => {
                                        const isSelected = form.latitude === landmark.lat && form.longitude === landmark.lng;
                                        return (
                                            <button
                                                key={landmark.name}
                                                type="button"
                                                onClick={() => selectLandmark(landmark)}
                                                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                                    isSelected
                                                        ? "bg-emerald-500 text-white font-semibold border-emerald-600 shadow-sm"
                                                        : isDark
                                                            ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                                                            : "bg-white border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
                                                }`}
                                            >
                                                <MapPin className="h-3 w-3 inline mr-1 opacity-70" />
                                                {landmark.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {hasMapPicker && (
                                <ReportLocationPicker
                                    latitude={form.latitude}
                                    longitude={form.longitude}
                                    isDark={isDark}
                                    outsideBoundaryWarning="This pin is outside Barangay Payatas."
                                    onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
                                />
                            )}
                            <p className={hintClass}>
                                {form.latitude !== null && form.longitude !== null
                                    ? `Pinned at ${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}.`
                                    : hasMapPicker
                                        ? "Pick a landmark above or tap the map to pin. Unpinned reports sit on placeholder coordinates to keep them off heatmaps."
                                        : "The map is currently unavailable; reports will be saved with placeholder coordinates."}
                            </p>
                        </div>
                    </section>

                    {/* Section 4: Operational Status */}
                    <section className={cardClass}>
                        <h2 className={sectionTitleClass}>Operational Status</h2>
                        <div role="radiogroup" aria-label="Status" className="grid gap-2 sm:grid-cols-2">
                            {EOC_STATUSES.map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.status === status}
                                    onClick={() => update("status", status)}
                                    className={`${chipClass(form.status === status)} text-left`}
                                >
                                    <span className="block font-semibold">{EOC_STATUS_LABELS[status]}</span>
                                </button>
                            ))}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-responders" className={labelClass}>Assigned Responders</Label>
                                <Input
                                    id="intake-responders"
                                    autoComplete="off"
                                    maxLength={300}
                                    placeholder="e.g. Clean & Green Team 2, BPSO Unit 4"
                                    value={form.responders}
                                    onChange={(e) => update("responders", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="intake-remarks" className={labelClass}>Internal Remarks</Label>
                                <Input
                                    id="intake-remarks"
                                    autoComplete="off"
                                    maxLength={2000}
                                    placeholder="Internal notes for barangay ops"
                                    value={form.remarks}
                                    onChange={(e) => update("remarks", e.target.value)}
                                    className={fieldClass}
                                />
                            </div>
                        </div>
                        <p className={hintClass}>Responders and remarks stay internal to staff. Residents only see the public status.</p>
                    </section>

                    <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full min-h-12 gap-2 rounded-xl text-sm font-semibold bg-[#059669] hover:bg-[#047857] text-white shadow-sm transition-all"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {submitting ? "Encoding & Saving Report…" : "Encode Report"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
