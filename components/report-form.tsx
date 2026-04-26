"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Wifi,
  WifiOff,
  Loader2,
  ShieldCheck,
  Send,
  CheckCircle2,
  Droplets,
  Flame,
  ShieldAlert,
  Wrench,
  HeartPulse,
  Leaf,
  CircleHelp,
  LocateFixed,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { generateReporterHash, getDeviceId } from "@/lib/crypto";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import type { ReportCategory, OfflineReport } from "@/types";

export default function ReportForm() {
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
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(3);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [hashPreview, setHashPreview] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const CATEGORIES: {
    key: ReportCategory;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    { key: "flooding", label: t.catFlooding, icon: <Droplets className="h-5 w-5" />, color: "text-blue-400" },
    { key: "fire", label: t.catFire, icon: <Flame className="h-5 w-5" />, color: "text-orange-400" },
    { key: "crime", label: t.catCrime, icon: <ShieldAlert className="h-5 w-5" />, color: "text-red-400" },
    { key: "infrastructure", label: t.catInfrastructure, icon: <Wrench className="h-5 w-5" />, color: "text-amber-400" },
    { key: "health", label: t.catHealth, icon: <HeartPulse className="h-5 w-5" />, color: "text-pink-400" },
    { key: "environmental", label: t.catEnvironmental, icon: <Leaf className="h-5 w-5" />, color: "text-emerald-400" },
    { key: "other", label: t.catOther, icon: <CircleHelp className="h-5 w-5" />, color: "text-gray-400" },
  ];

  const SEVERITY_CONFIG = [
    { value: 1, label: t.sevLow, color: "bg-emerald-500" },
    { value: 2, label: t.sevMinor, color: "bg-lime-500" },
    { value: 3, label: t.sevModerate, color: "bg-amber-500" },
    { value: 4, label: t.sevHigh, color: "bg-orange-500" },
    { value: 5, label: t.sevCritical, color: "bg-red-500" },
  ];

  // Track connectivity
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

  // Generate anonymous hash preview
  useEffect(() => {
    (async () => {
      const hash = await generateReporterHash(getDeviceId());
      setHashPreview(hash.slice(0, 12));
    })();
  }, []);

  // Count pending offline reports
  useEffect(() => {
    db.reports.where("is_synced").equals(0).count().then(setPendingCount).catch(() => { });
  }, [submitted]);

  // Sync offline reports when coming back online
  useEffect(() => {
    if (!online) return;
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
        } catch {
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsLoading(false);
      },
      (err) => {
        setError(`GPS error: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [t]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category) { setError(t.reportSelectCategory); return; }
    if (latitude === null || longitude === null) { setError(t.reportDetectGPS); return; }

    setSubmitting(true);
    const reporterHash = await generateReporterHash(getDeviceId());

    const report: OfflineReport = {
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
        setSubmitted(true);
        resetForm();
        setTimeout(() => setSubmitted(false), 4000);
      } else {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          await db.reports.add(report);
          toast.info(t.toastSavedOffline);
          setSubmitted(true);
          resetForm();
          setTimeout(() => setSubmitted(false), 4000);
        }
      }
    } catch {
      await db.reports.add(report);
      toast.info(t.toastSavedOffline);
      setSubmitted(true);
      resetForm();
      setTimeout(() => setSubmitted(false), 4000);
    }

    setSubmitting(false);
  };

  const resetForm = () => {
    setCategory("");
    setDescription("");
    setSeverity(3);
    setLatitude(null);
    setLongitude(null);
    setPhotoPreview(null);
  };

  return (
    <Card
      className={`w-full backdrop-blur-xl shadow-2xl rounded-2xl ${
        isDark
          ? "border-white/[0.08] bg-black/50 text-white"
          : "border-black/[0.06] bg-white/70 text-gray-900"
      }`}
    >
      <CardHeader className="px-5 pt-5 pb-3 md:px-6 md:pt-6 md:pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[17px] md:text-xl font-semibold tracking-tight">
            {t.reportTitle}
          </CardTitle>
          <Badge
            variant={online ? "default" : "destructive"}
            className="gap-1 text-[11px] px-2.5 py-0.5"
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? t.reportOnline : t.reportOffline}
          </Badge>
        </div>
        <CardDescription className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
          {t.reportAnonymousId}:{" "}
          <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            isDark ? "bg-white/[0.06] text-white/50" : "bg-black/[0.04] text-gray-500"
          }`}>
            {hashPreview}…
          </code>
        </CardDescription>
        {pendingCount > 0 && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            isDark ? "bg-amber-500/10 text-amber-300" : "bg-amber-50 text-amber-700"
          }`}>
            <WifiOff className="h-3 w-3 shrink-0" />
            {t.reportPendingQueue(pendingCount)}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-5 md:px-6 md:pb-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-lg font-semibold">{t.reportSubmitted}</p>
            <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {online ? t.reportSentSecurely : t.reportSavedOffline}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {/* Category grid */}
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportWhatHappened}
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 md:gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={`flex flex-col items-center gap-1.5 py-2.5 md:py-3 px-1 rounded-xl text-center transition-all active:scale-95 ${
                        isSelected
                          ? isDark ? "bg-white/[0.12] ring-1 ring-white/20" : "bg-indigo-50 ring-1 ring-indigo-200"
                          : isDark ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-black/[0.02] hover:bg-black/[0.05]"
                      }`}
                    >
                      <span className={isSelected ? cat.color : isDark ? "text-white/40" : "text-gray-400"}>
                        {cat.icon}
                      </span>
                      <span className={`text-[10px] font-medium leading-none ${
                        isSelected
                          ? isDark ? "text-white" : "text-gray-900"
                          : isDark ? "text-white/40" : "text-gray-400"
                      }`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportDescription}
              </Label>
              <Textarea
                id="description"
                placeholder={t.reportDescriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Photo */}
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportPhoto}
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
              {photoPreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden">
                  <img src={photoPreview} alt="Evidence" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80"
                  >
                    {t.reportChangePhoto}
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full h-12 gap-2 rounded-xl text-sm ${
                    isDark ? "border-white/10 text-white/70 hover:bg-white/[0.06]" : "border-black/10 text-gray-600 hover:bg-black/[0.03]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {t.reportAddPhoto}
                </Button>
              )}
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportSeverity}
              </Label>
              <div className="flex gap-1.5">
                {SEVERITY_CONFIG.map((s) => {
                  const isSelected = severity === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSeverity(s.value)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                        isSelected
                          ? isDark ? "bg-white/[0.12] ring-1 ring-white/20" : "bg-gray-100 ring-1 ring-gray-200"
                          : isDark ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-black/[0.02] hover:bg-black/[0.05]"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${s.color} ${isSelected ? "opacity-100 scale-110" : "opacity-40"} transition-all`} />
                      <span className={`text-[10px] font-medium ${
                        isSelected ? isDark ? "text-white" : "text-gray-900" : isDark ? "text-white/30" : "text-gray-400"
                      }`}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GPS */}
            <div className="space-y-2">
              <Label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {t.reportLocation}
              </Label>
              {latitude !== null && longitude !== null ? (
                <button
                  type="button"
                  onClick={detectGPS}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  <LocateFixed className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-mono">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                  <span className="ml-auto text-[10px] opacity-50">{t.reportTapRefresh}</span>
                </button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full h-12 gap-2 rounded-xl text-sm ${
                    isDark ? "border-white/10 text-white/70 hover:bg-white/[0.06]" : "border-black/10 text-gray-600 hover:bg-black/[0.03]"
                  }`}
                  onClick={detectGPS}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  {gpsLoading ? t.reportDetecting : t.reportDetectLocation}
                </Button>
              )}
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive" className="py-2 rounded-xl">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full h-12 gap-2 rounded-xl text-sm font-semibold" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : online ? <Send className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? t.reportSubmitting : online ? t.reportSubmit : t.reportSaveOffline}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
