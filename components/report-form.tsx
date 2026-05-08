"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Wifi, WifiOff, Loader2, ShieldCheck, Send, CheckCircle2, Droplets, Flame, ShieldAlert, Wrench, HeartPulse, Leaf, CircleHelp, LocateFixed, Camera, X, } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { generateReporterHash, getDeviceId } from "@/lib/crypto";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import EmergencyReminder from "@/components/emergency-reminder";
import { type ReportCategory, type OfflineReport, CATEGORY_LABELS } from "@/types";
import { classifyReport } from "@/lib/classification";
import { getGoogleMapsApiKey } from "@/lib/payatas-google-maps";
import { isWithinPayatas } from "@/lib/payatas-boundary";

const ReportLocationPicker = dynamic(() => import("@/components/report-location-picker"), {
    ssr: false,
    loading: () => <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted/30"/>,
});

export default function ReportForm() {
    const DRAFT_KEY = "speakup.report.draft.v1";
    const DRAFT_TOAST_KEY = "speakup.report.draft.toast-shown.v1";
    const DUPLICATE_WINDOW_MINUTES = 10;
    const DUPLICATE_DISTANCE_METERS = 150;
    const POOR_ACCURACY_THRESHOLD_METERS = 80;
    const { theme } = useTheme();
    const { t } = useLanguage();
    const isDark = theme === "dark";
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [online, setOnline] = useState(true);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [category, setCategory] = useState<ReportCategory | "">("");
    const [autoCategory, setAutoCategory] = useState(true);
    const [description, setDescription] = useState("");
    const [severity, setSeverity] = useState(3);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [hashPreview, setHashPreview] = useState("");
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [receiptId, setReceiptId] = useState<string | null>(null);
    const [draftHydrated, setDraftHydrated] = useState(false);
    const playSubmitSound = useCallback(() => {
        if (typeof window === "undefined")
            return;
        const AudioCtx = window.AudioContext || (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
        if (!AudioCtx)
            return;
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.22);
        oscillator.onended = () => {
            void ctx.close();
        };
    }, []);
    const generateReceiptId = useCallback(() => {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `SPK-${ts.slice(-4)}${rand}`;
    }, []);
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const distanceInMeters = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
        const earthRadius = 6371000;
        const deltaLat = toRadians(lat2 - lat1);
        const deltaLon = toRadians(lon2 - lon1);
        const a = Math.sin(deltaLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }, []);
    const checkForDuplicateNearby = useCallback(async () => {
        if (!category || latitude === null || longitude === null) {
            return false;
        }
        const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
        const sameCategory = await db.reports
            .where("category")
            .equals(category)
            .filter((item) => !!item.created_at && item.created_at >= cutoff)
            .toArray();
        return sameCategory.some((item) => {
            if (typeof item.latitude !== "number" || typeof item.longitude !== "number") {
                return false;
            }
            return distanceInMeters(latitude, longitude, item.latitude, item.longitude) <= DUPLICATE_DISTANCE_METERS;
        });
    }, [category, distanceInMeters, latitude, longitude]);
    const compressImage = useCallback((file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const image = new Image();
            image.onload = () => {
                const maxDimension = 1280;
                const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
                const targetWidth = Math.max(1, Math.round(image.width * ratio));
                const targetHeight = Math.max(1, Math.round(image.height * ratio));
                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to create canvas context"));
                    return;
                }
                ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            image.onerror = () => reject(new Error("Failed to decode image"));
            image.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
    }), []);
    const CATEGORIES: {
        key: ReportCategory;
        label: string;
        icon: React.ReactNode;
        color: string;
    }[] = [
        { key: "drainage_flooding", label: CATEGORY_LABELS["drainage_flooding"], icon: <Droplets className="h-5 w-5"/>, color: "text-blue-400" },
        { key: "fire_hazard", label: CATEGORY_LABELS["fire_hazard"], icon: <Flame className="h-5 w-5"/>, color: "text-orange-400" },
        { key: "safety_concern", label: CATEGORY_LABELS["safety_concern"], icon: <ShieldAlert className="h-5 w-5"/>, color: "text-red-400" },
        { key: "infrastructure", label: CATEGORY_LABELS["infrastructure"], icon: <Wrench className="h-5 w-5"/>, color: "text-amber-400" },
        { key: "sanitation_health", label: CATEGORY_LABELS["sanitation_health"], icon: <HeartPulse className="h-5 w-5"/>, color: "text-pink-400" },
        { key: "environmental", label: CATEGORY_LABELS["environmental"], icon: <Leaf className="h-5 w-5"/>, color: "text-emerald-400" },
        { key: "noise_nuisance", label: CATEGORY_LABELS["noise_nuisance"], icon: <CircleHelp className="h-5 w-5"/>, color: "text-indigo-400" },
        { key: "other", label: CATEGORY_LABELS["other"], icon: <CircleHelp className="h-5 w-5"/>, color: "text-gray-400" },
    ];
    const SEVERITY_CONFIG = [
        { value: 1, label: t.sevLow, color: "bg-emerald-500" },
        { value: 2, label: t.sevMinor, color: "bg-lime-500" },
        { value: 3, label: t.sevModerate, color: "bg-amber-500" },
        { value: 4, label: t.sevHigh, color: "bg-orange-500" },
        { value: 5, label: t.sevCritical, color: "bg-red-500" },
    ];

    useEffect(() => {
        if (autoCategory && description.length > 5) {
            const suggested = classifyReport(description);
            if (suggested !== "other") {
                setCategory(suggested);
            }
        }
    }, [description, autoCategory]);

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        setOnline(navigator.onLine);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);
    useEffect(() => {
        (async () => {
            const hash = await generateReporterHash(getDeviceId());
            setHashPreview(hash.slice(0, 12));
        })();
    }, []);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw)
                return;
            const draft = JSON.parse(raw) as {
                category?: ReportCategory;
                description?: string;
                severity?: number;
                latitude?: number | null;
                longitude?: number | null;
                locationAccuracy?: number | null;
                photoPreview?: string | null;
            };
            let restoredSomething = false;
            if (draft.category) {
                setCategory(draft.category);
                restoredSomething = true;
            }
            if (typeof draft.description === "string" && draft.description.length > 0) {
                setDescription(draft.description);
                restoredSomething = true;
            }
            if (typeof draft.severity === "number") {
                setSeverity(draft.severity);
                restoredSomething = true;
            }
            if (typeof draft.latitude === "number") {
                setLatitude(draft.latitude);
                restoredSomething = true;
            }
            if (typeof draft.longitude === "number") {
                setLongitude(draft.longitude);
                restoredSomething = true;
            }
            if (typeof draft.locationAccuracy === "number") {
                setLocationAccuracy(draft.locationAccuracy);
                restoredSomething = true;
            }
            if (typeof draft.photoPreview === "string" && draft.photoPreview.length > 0) {
                setPhotoPreview(draft.photoPreview);
                restoredSomething = true;
            }
            if (restoredSomething && sessionStorage.getItem(DRAFT_TOAST_KEY) !== "1") {
                sessionStorage.setItem(DRAFT_TOAST_KEY, "1");
                toast.info(t.reportDraftRestored);
            }
        }
        catch {
        }
        finally {
            setDraftHydrated(true);
        }
    }, [t.reportDraftRestored]);
    useEffect(() => {
        if (!draftHydrated)
            return;
        try {
            const payload = {
                category: category || undefined,
                description,
                severity,
                latitude,
                longitude,
                locationAccuracy,
                photoPreview,
            };
            const hasDraftContent = Boolean(payload.category) ||
                Boolean(payload.description?.trim()) ||
                latitude !== null ||
                longitude !== null ||
                Boolean(payload.photoPreview);
            if (!hasDraftContent) {
                localStorage.removeItem(DRAFT_KEY);
                return;
            }
            localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        }
        catch {
        }
    }, [category, description, severity, latitude, longitude, locationAccuracy, photoPreview, draftHydrated]);
    useEffect(() => {
        db.reports.where("is_synced").equals(0).count().then(setPendingCount).catch(() => { });
    }, [submitted]);
    useEffect(() => {
        if (!online)
            return;
        (async () => {
            const pending = await db.reports.where("is_synced").equals(0).toArray();
            let synced = 0;
            for (const report of pending) {
                try {
                    const res = await fetch("/api/reports", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(report),
                    });
                    if (res.ok) {
                        await db.reports.update(report.offline_id!, {
                            is_synced: 1,
                            synced_at: new Date().toISOString(),
                        });
                        synced++;
                    }
                }
                catch {
                    break;
                }
            }
            if (synced > 0) {
                toast.success(t.toastSyncComplete(synced));
            }
            const remaining = await db.reports.where("is_synced").equals(0).count();
            setPendingCount(remaining);
        })();
    }, [online, t]);
    const detectGPS = useCallback(() => {
        if (!navigator.geolocation) {
            setError(t.reportGPSNotSupported);
            return;
        }
        setGpsLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition((pos) => {
            setLatitude(pos.coords.latitude);
            setLongitude(pos.coords.longitude);
            setLocationAccuracy(pos.coords.accuracy ?? null);
            setGpsLoading(false);
        }, (err) => {
            setError(`GPS error: ${err.message}`);
            setGpsLoading(false);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    }, [t]);
    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            const compressed = await compressImage(file);
            setPhotoPreview(compressed);
        }
        catch {
            const reader = new FileReader();
            reader.onload = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!category) {
            setError(t.reportSelectCategory);
            return;
        }
        if (latitude === null || longitude === null) {
            setError(getGoogleMapsApiKey() ? t.reportLocationRequired : t.reportDetectGPS);
            return;
        }
        if (!isWithinPayatas(latitude, longitude)) {
            setError(t.reportOutsideBoundary);
            return;
        }
        const duplicateNearby = await checkForDuplicateNearby();
        if (duplicateNearby && !window.confirm(t.reportDuplicateConfirm)) {
            return;
        }
        setSubmitting(true);
        const reporterHash = await generateReporterHash(getDeviceId());
        const nextReceiptId = generateReceiptId();
        const report: OfflineReport = {
            receipt_id: nextReceiptId,
            reporter_hash: reporterHash,
            category,
            description,
            latitude,
            longitude,
            severity,
            photo_url: photoPreview || undefined,
            is_synced: 0,
            created_at: new Date().toISOString(),
        };
        if (!online) {
            await db.reports.add(report);
            toast.info(t.toastSavedOffline);
            playSubmitSound();
            setReceiptId(nextReceiptId);
            setSubmitting(false);
            setSubmitted(true);
            resetForm();
            setTimeout(() => setSubmitted(false), 4000);
            return;
        }
        try {
            const res = await fetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(report),
            });
            if (res.ok) {
                report.is_synced = 1;
                report.synced_at = new Date().toISOString();
                await db.reports.add(report);
                toast.success(t.toastReportSubmitted);
                playSubmitSound();
                setReceiptId(nextReceiptId);
                setSubmitted(true);
                resetForm();
                setTimeout(() => setSubmitted(false), 4000);
            }
            else {
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                }
                else {
                    await db.reports.add(report);
                    toast.info(t.toastSavedOffline);
                    playSubmitSound();
                    setReceiptId(nextReceiptId);
                    setSubmitted(true);
                    resetForm();
                    setTimeout(() => setSubmitted(false), 4000);
                }
            }
        }
        catch {
            await db.reports.add(report);
            toast.info(t.toastSavedOffline);
            playSubmitSound();
            setReceiptId(nextReceiptId);
            setSubmitted(true);
            resetForm();
            setTimeout(() => setSubmitted(false), 4000);
        }
        setSubmitting(false);
    };
    const resetForm = () => {
        setCategory("");
        setAutoCategory(true);
        setDescription("");
        setSeverity(3);
        setLatitude(null);
        setLongitude(null);
        setLocationAccuracy(null);
        setPhotoPreview(null);
        try {
            localStorage.removeItem(DRAFT_KEY);
        }
        catch {
        }
    };
    return (<Card className={`w-full flex flex-col overflow-hidden backdrop-blur-xl shadow-2xl rounded-2xl max-h-[calc(100dvh-6.5rem)] sm:max-h-[calc(100dvh-7rem)] ${isDark
            ? "border-white/[0.08] bg-black/50 text-white"
            : "border-black/[0.06] bg-white/70 text-gray-900"}`}>
      <CardHeader className="px-4 pt-4 pb-2 md:px-5 md:pt-5 md:pb-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base md:text-lg font-semibold tracking-tight min-w-0">
            {t.reportTitle}
          </CardTitle>
          <Badge variant={online ? "default" : "destructive"} className="gap-1 text-[11px] px-2.5 py-0.5 shrink-0">
            {online ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}
            {online ? t.reportOnline : t.reportOffline}
          </Badge>
        </div>
        <CardDescription className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
          {t.reportAnonymousId}:{" "}
          <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDark ? "bg-white/[0.06] text-white/50" : "bg-black/[0.04] text-gray-500"}`}>
            {hashPreview}…
          </code>
        </CardDescription>
        {pendingCount > 0 && (<div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
            <WifiOff className="h-3 w-3 shrink-0"/>
            {t.reportPendingQueue(pendingCount)}
          </div>)}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 md:px-5 md:pb-5">
        {submitted ? (<div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-500"/>
            </div>
            <p className="text-lg font-semibold">{t.reportSubmitted}</p>
            <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {online ? t.reportSentSecurely : t.reportSavedOffline}
            </p>
            {receiptId && (<div className={`w-full max-w-xs rounded-lg px-3 py-2 text-left ${isDark ? "bg-white/[0.06]" : "bg-black/[0.03]"}`}>
                <p className={`text-[11px] uppercase tracking-wide ${isDark ? "text-white/50" : "text-gray-500"}`}>{t.reportReceiptLabel}</p>
                <p className="font-mono text-sm">{receiptId}</p>
                <p className={`text-[11px] ${isDark ? "text-white/45" : "text-gray-500"}`}>{t.reportReceiptHint}</p>
              </div>)}
          </div>) : (<form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 pb-1">
            
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportWhatHappened}
              </Label>
              <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 md:gap-2">
                {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                return (<button key={cat.key} type="button" aria-label={`Category ${cat.label}`} onClick={() => { setCategory(cat.key); setAutoCategory(false); }} className={`flex min-h-11 flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-center transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${isSelected
                        ? isDark ? "bg-white/[0.12] ring-1 ring-white/20" : "bg-indigo-50 ring-1 ring-indigo-200"
                        : isDark ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-black/[0.02] hover:bg-black/[0.05]"}`}>
                      <span className={isSelected ? cat.color : isDark ? "text-white/40" : "text-gray-400"}>
                        {cat.icon}
                      </span>
                      <span className={`w-full truncate px-0.5 text-[10px] font-medium leading-none ${isSelected
                        ? isDark ? "text-white" : "text-gray-900"
                        : isDark ? "text-white/40" : "text-gray-400"}`}>
                        {cat.label}
                      </span>
                    </button>);
            })}
              </div>
            </div>

            
            <div className="space-y-2">
              <Label htmlFor="description" className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportDescription}
              </Label>
              <Textarea id="description" placeholder={t.reportDescriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none text-sm min-h-12"/>
            </div>

            
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportPhoto}
              </Label>
              <p className={`text-[10px] leading-relaxed ${isDark ? "text-white/40" : "text-gray-500"}`}>
                Accepted formats: JPG, PNG, GIF • Max file size: 5MB • Images are automatically compressed for faster upload
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto}/>
              {photoPreview ? (<div className="relative w-full h-32 rounded-xl overflow-hidden">
                  <img src={photoPreview} alt="Evidence" className="w-full h-full object-cover"/>
                  <button type="button" aria-label="Remove selected photo" onClick={() => setPhotoPreview(null)} className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                    <X className="h-4 w-4"/>
                  </button>
                  <button type="button" aria-label="Change selected photo" onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                    {t.reportChangePhoto}
                  </button>
                </div>) : (<Button type="button" variant="outline" className={`w-full min-h-11 gap-2 rounded-xl text-sm ${isDark ? "border-white/10 text-white/70 hover:bg-white/[0.06]" : "border-black/10 text-gray-600 hover:bg-black/[0.03]"}`} onClick={() => fileInputRef.current?.click()}>
                  <Camera className="h-4 w-4"/>
                  {t.reportAddPhoto}
                </Button>)}
            </div>

            
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportSeverity}
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {SEVERITY_CONFIG.map((s) => {
                const isSelected = severity === s.value;
                return (<button key={s.value} type="button" aria-label={`Severity ${s.label}`} onClick={() => setSeverity(s.value)} className={`flex min-h-11 flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${isSelected
                        ? isDark ? "bg-white/[0.12] ring-1 ring-white/20" : "bg-gray-100 ring-1 ring-gray-200"
                        : isDark ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-black/[0.02] hover:bg-black/[0.05]"}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${s.color} ${isSelected ? "opacity-100 scale-110" : "opacity-40"} transition-all`}/>
                      <span className={`text-[10px] font-medium ${isSelected ? isDark ? "text-white" : "text-gray-900" : isDark ? "text-white/30" : "text-gray-400"}`}>
                        {s.label}
                      </span>
                    </button>);
            })}
              </div>
            </div>

            
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportLocation}
              </Label>
              {latitude !== null && longitude !== null ? (<button type="button" onClick={detectGPS} className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                  <LocateFixed className="h-4 w-4 shrink-0"/>
                  <span className="min-w-0 truncate text-xs sm:text-sm font-mono">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                  <span className="ml-auto text-[10px] opacity-50">{t.reportTapRefresh}</span>
                </button>) : (<Button type="button" variant="outline" className={`w-full min-h-11 gap-2 rounded-xl text-sm ${isDark ? "border-white/10 text-white/70 hover:bg-white/[0.06]" : "border-black/10 text-gray-600 hover:bg-black/[0.03]"}`} onClick={detectGPS} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <MapPin className="h-4 w-4"/>}
                  {gpsLoading ? t.reportDetecting : t.reportDetectLocation}
                </Button>)}
              {locationAccuracy !== null && (<p className={`text-xs ${locationAccuracy > POOR_ACCURACY_THRESHOLD_METERS
                    ? isDark ? "text-amber-300" : "text-amber-700"
                    : isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                  {t.reportAccuracyLabel(Math.round(locationAccuracy))} · {locationAccuracy > POOR_ACCURACY_THRESHOLD_METERS ? t.reportAccuracyPoor : t.reportAccuracyGood}
                  {locationAccuracy > POOR_ACCURACY_THRESHOLD_METERS ? ` — ${t.reportRetryForBetterAccuracy}` : ""}
                </p>)}
              {getGoogleMapsApiKey() && (<>
                  <ReportLocationPicker latitude={latitude} longitude={longitude} isDark={isDark} outsideBoundaryWarning={t.reportOutsideBoundary} onLocationChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                }} onAdjustPin={() => setLocationAccuracy(null)}/>
                  <p className={`text-[10px] leading-snug ${isDark ? "text-white/35" : "text-gray-500"}`}>
                    {t.reportMapPickerHint}
                  </p>
                </>)}
            </div>

            
            {error && (<Alert variant="destructive" className="py-2 rounded-xl">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>)}

            <div className={`text-[10px] text-center px-2 py-1.5 rounded-lg border ${isDark ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700"}`}>
                ⚠️ False reporting or repeated spam may result in your account being blocked.
            </div>

            <Button type="submit" className="w-full min-h-11 gap-2 rounded-xl text-sm font-semibold" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin"/> : online ? <Send className="h-4 w-4"/> : <ShieldCheck className="h-4 w-4"/>}
              {submitting ? t.reportSubmitting : online ? t.reportSubmit : t.reportSaveOffline}
            </Button>
          </form>)}
      </CardContent>
    </Card>);
}
