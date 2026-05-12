"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, ImageIcon, Camera, Trash2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export type StaffStatus = "pending" | "verified" | "in_progress" | "resolved";

interface Props {
    open: boolean;
    reportId: string;
    targetStatus: StaffStatus | null;
    onCancel: () => void;
    onSubmit: (payload: { reportId: string; status: StaffStatus; note: string; photoDataUrl: string | null }) => Promise<void> | void;
}

const STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending",
    verified: "Verified",
    in_progress: "In Progress",
    resolved: "Resolved",
};

const MAX_PHOTO_BYTES = 1_500_000; // ~1.5 MB after base64 encoding caps payload growth.

/**
 * Modal that staff/admin use when changing a report's status. They can optionally attach a
 * photo (proof of work, after-photo, etc.) and a note. The photo is stored as a base64 data
 * URL inside the action_history entry on the report row.
 */
export default function StatusUpdateDialog({ open, reportId, targetStatus, onCancel, onSubmit }: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [note, setNote] = useState("");
    const [photo, setPhoto] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInput = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setNote("");
        setPhoto(null);
        setPhotoError(null);
        setSubmitting(false);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open || !targetStatus) return null;

    const handlePhoto = async (file: File | undefined | null) => {
        setPhotoError(null);
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setPhotoError("Please choose an image file.");
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            setPhotoError("Image is too large. Pick something under 1.5 MB.");
            return;
        }
        try {
            const reader = new FileReader();
            const dataUrl: string = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(String(reader.result ?? ""));
                reader.onerror = () => reject(new Error("Could not read file."));
                reader.readAsDataURL(file);
            });
            setPhoto(dataUrl);
        } catch (e) {
            setPhotoError(e instanceof Error ? e.message : "Could not read photo.");
        }
    };

    const handleSubmit = async () => {
        if (!targetStatus) return;
        setSubmitting(true);
        try {
            await onSubmit({
                reportId,
                status: targetStatus,
                note: note.trim(),
                photoDataUrl: photo,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}
            >
                <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/[0.08]" : "border-gray-100"}`}>
                    <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                        Update status to <span className="capitalize">{STATUS_LABEL[targetStatus]}</span>
                    </h2>
                    <button type="button" onClick={onCancel} className={`p-1.5 rounded-lg ${isDark ? "text-white/50 hover:bg-white/[0.06]" : "text-gray-400 hover:bg-gray-100"}`} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>
                            Update note <span className={`font-normal ${isDark ? "text-white/40" : "text-gray-400"}`}>(visible to the resident)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="What was done? e.g. 'Cleared blocked drainage at Lupang Pangako Phase 4.'"
                            className={`mt-1.5 w-full p-2 text-sm rounded-lg resize-none border ${
                                isDark
                                    ? "bg-black/30 border-white/10 text-white placeholder:text-white/30"
                                    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                            }`}
                        />
                    </div>

                    <div>
                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>
                            Attach photo <span className={`font-normal ${isDark ? "text-white/40" : "text-gray-400"}`}>(optional)</span>
                        </label>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhoto(e.target.files?.[0])}
                        />
                        {photo ? (
                            <div className={`mt-1.5 relative rounded-lg overflow-hidden border ${isDark ? "border-white/10" : "border-gray-200"}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo} alt="Status update attachment preview" className="w-full max-h-64 object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setPhoto(null)}
                                    className="absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-black/70 text-white hover:bg-black/85"
                                >
                                    <Trash2 className="h-3 w-3" /> Remove
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                className={`mt-1.5 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-dashed transition-colors ${
                                    isDark
                                        ? "border-white/15 text-white/65 hover:bg-white/[0.05]"
                                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                <Camera className="h-4 w-4" />
                                Take or pick a photo
                                <ImageIcon className="h-4 w-4 opacity-60" />
                            </button>
                        )}
                        {photoError && (
                            <p className="mt-1.5 text-[11px] text-red-500">{photoError}</p>
                        )}
                        <p className={`mt-1 text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                            Photos help residents and the transparency board confirm what was done. Max ~1.5 MB.
                        </p>
                    </div>
                </div>

                <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-gray-50"}`}>
                    <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Confirm update
                    </Button>
                </div>
            </div>
        </div>
    );
}
