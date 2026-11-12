"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Bell,
    X,
    Check,
    AlertTriangle,
    ClipboardPen,
    FileWarning,
    RefreshCw,
    ExternalLink,
    GripHorizontal,
    Volume2,
    VolumeX,
    Trash2,
    Flame,
    ShieldAlert,
    Sparkles,
    RotateCcw,
    CheckCircle2,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useRouter } from "next/navigation";
import { generateReporterHash, getDeviceId } from "@/lib/crypto";

interface NotifItem {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    report_id?: string;
}

type FilterTab = "all" | "unread" | "urgent" | "reports";

interface CategoryMeta {
    label: string;
    badgeClass: string;
    icon: React.ReactNode;
    isUrgent: boolean;
}

/** Human-friendly relative time (e.g. "Just now", "5m ago", "2h ago") */
function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 45) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    } catch {
        return dateString;
    }
}

/** Detect notification category, styling, and icon */
function getNotificationCategory(item: NotifItem, isDark: boolean): CategoryMeta {
    const text = `${item.title} ${item.message}`.toLowerCase();

    if (
        item.type === "high_priority" ||
        text.includes("sunog") ||
        text.includes("fire") ||
        text.includes("disaster") ||
        text.includes("emergency") ||
        text.includes("wiring") ||
        text.includes("kuryente") ||
        text.includes("urgent")
    ) {
        return {
            label: "Emergency / Fire",
            badgeClass: isDark
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-rose-100 text-rose-700 border-rose-200",
            icon: <Flame className="h-3.5 w-3.5 text-rose-400 shrink-0" />,
            isUrgent: true,
        };
    }

    if (item.type === "auto_flagged" || text.includes("flagged") || text.includes("auto-flagged")) {
        return {
            label: "AI Flagged",
            badgeClass: isDark
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-purple-100 text-purple-700 border-purple-200",
            icon: <ShieldAlert className="h-3.5 w-3.5 text-purple-400 shrink-0" />,
            isUrgent: true,
        };
    }

    if (item.type === "encoded_report" || text.includes("encoded") || text.includes("walk-in")) {
        return {
            label: "Encoded Report",
            badgeClass: isDark
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "bg-blue-100 text-blue-700 border-blue-200",
            icon: <ClipboardPen className="h-3.5 w-3.5 text-blue-400 shrink-0" />,
            isUrgent: false,
        };
    }

    if (
        text.includes("sanitation") ||
        text.includes("baho") ||
        text.includes("basura") ||
        text.includes("kalat") ||
        text.includes("health")
    ) {
        return {
            label: "Sanitation & Health",
            badgeClass: isDark
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-amber-100 text-amber-700 border-amber-200",
            icon: <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
            isUrgent: false,
        };
    }

    if (item.type === "status_update" || text.includes("status") || text.includes("resolved")) {
        return {
            label: "Status Update",
            badgeClass: isDark
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
            isUrgent: false,
        };
    }

    return {
        label: "Resident Report",
        badgeClass: isDark
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            : "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: <FileWarning className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
        isUrgent: false,
    };
}

/** Native subtle chime using Web Audio API (zero external asset dependencies) */
function playNotificationChime() {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.33);
    } catch {
        // Ignored if user has not interacted or browser blocks audio
    }
}

export default function NotificationBell({ role, reporterHash }: { role?: string; reporterHash?: string }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotifItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeToast, setActiveToast] = useState<NotifItem | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
    const [soundEnabled, setSoundEnabled] = useState(true);

    const prevItemsRef = useRef<NotifItem[]>([]);
    const isFirstFetchRef = useRef(true);

    // Hardware-accelerated dragging state
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        isDragging: boolean;
        hasMoved: boolean;
        startX: number;
        startY: number;
        startPosX: number;
        startPosY: number;
        panelWidth: number;
        panelHeight: number;
        currentX: number;
        currentY: number;
    }>({
        isDragging: false,
        hasMoved: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
        panelWidth: 384,
        panelHeight: 500,
        currentX: 0,
        currentY: 0,
    });

    // Initialize position from localStorage or default centered layout
    useEffect(() => {
        if (!open || typeof window === "undefined") return;

        if (!position) {
            let loaded = false;
            try {
                const saved = localStorage.getItem("speakup_notif_pos");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
                        const modalWidth = Math.min(window.innerWidth * 0.95, 420);
                        const maxX = Math.max(12, window.innerWidth - modalWidth - 12);
                        const maxY = Math.max(12, window.innerHeight - 80);
                        const clampedX = Math.min(Math.max(12, parsed.x), maxX);
                        const clampedY = Math.min(Math.max(12, parsed.y), maxY);
                        setPosition({ x: clampedX, y: clampedY });
                        loaded = true;
                    }
                }
            } catch {
                // Ignore parsing errors
            }

            if (!loaded) {
                const modalWidth = Math.min(window.innerWidth * 0.95, 420);
                const initialX = Math.max(12, (window.innerWidth - modalWidth) / 2);
                const initialY = 56;
                setPosition({ x: initialX, y: initialY });
            }
        }

        const handleResize = () => {
            setPosition((prev) => {
                if (!prev) return null;
                const modalWidth = panelRef.current ? panelRef.current.offsetWidth : Math.min(window.innerWidth * 0.95, 420);
                const maxX = Math.max(12, window.innerWidth - modalWidth - 12);
                const maxY = Math.max(12, window.innerHeight - 80);
                return {
                    x: Math.min(Math.max(12, prev.x), maxX),
                    y: Math.min(Math.max(12, prev.y), maxY),
                };
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [open, position]);

    // Outside click detection to close panel
    useEffect(() => {
        if (!open) return;

        const handlePointerDownOutside = (e: PointerEvent) => {
            if (dragRef.current.isDragging || dragRef.current.hasMoved) return;
            const target = e.target as HTMLElement | null;
            if (panelRef.current && panelRef.current.contains(target)) return;
            if (target?.closest("[data-notif-bell-trigger]")) return;
            setOpen(false);
        };

        const timer = setTimeout(() => {
            document.addEventListener("pointerdown", handlePointerDownOutside);
        }, 50);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("pointerdown", handlePointerDownOutside);
        };
    }, [open]);

    // Rock-solid GPU Drag Start
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;

        const panel = panelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        dragRef.current = {
            isDragging: true,
            hasMoved: false,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: rect.left,
            startPosY: rect.top,
            panelWidth: rect.width,
            panelHeight: rect.height,
            currentX: rect.left,
            currentY: rect.top,
        };

        setIsDragging(true);
        document.body.style.userSelect = "none";

        const onMove = (moveEvt: PointerEvent) => {
            if (!dragRef.current.isDragging || !panelRef.current) return;
            const deltaX = moveEvt.clientX - dragRef.current.startX;
            const deltaY = moveEvt.clientY - dragRef.current.startY;

            if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                dragRef.current.hasMoved = true;
            }

            const maxX = Math.max(12, window.innerWidth - dragRef.current.panelWidth - 12);
            const maxY = Math.max(12, window.innerHeight - 80);
            const targetX = Math.min(Math.max(12, dragRef.current.startPosX + deltaX), maxX);
            const targetY = Math.min(Math.max(12, dragRef.current.startPosY + deltaY), maxY);

            dragRef.current.currentX = targetX;
            dragRef.current.currentY = targetY;

            // Direct hardware-accelerated transform: 0 React re-renders!
            panelRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        };

        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);

            document.body.style.userSelect = "";
            setIsDragging(false);
            dragRef.current.isDragging = false;

            if (dragRef.current.hasMoved) {
                const finalX = dragRef.current.currentX;
                const finalY = dragRef.current.currentY;
                setPosition({ x: finalX, y: finalY });
                try {
                    localStorage.setItem("speakup_notif_pos", JSON.stringify({ x: finalX, y: finalY }));
                } catch {
                    // Ignore storage quota
                }
            }

            setTimeout(() => {
                dragRef.current.hasMoved = false;
            }, 120);
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };

    const resetPosition = () => {
        if (typeof window === "undefined") return;
        const modalWidth = panelRef.current ? panelRef.current.offsetWidth : Math.min(window.innerWidth * 0.95, 420);
        const initialX = Math.max(12, (window.innerWidth - modalWidth) / 2);
        const initialY = 56;
        setPosition({ x: initialX, y: initialY });
        try {
            localStorage.removeItem("speakup_notif_pos");
        } catch {
            // Ignore
        }
        if (panelRef.current) {
            panelRef.current.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`;
        }
    };

    const fetchNotifications = useCallback(async () => {
        try {
            let activeHash = reporterHash;
            if (!activeHash && typeof window !== "undefined") {
                try {
                    activeHash = await generateReporterHash(getDeviceId());
                } catch {
                    // Fallback to role
                }
            }
            const params = new URLSearchParams();
            if (role) params.set("role", role);
            if (activeHash) params.set("reporter_hash", activeHash);
            const res = await fetch(`/api/notifications?${params.toString()}`);
            const data = await res.json();

            const newItems: NotifItem[] = data.notifications ?? [];
            const newUnreadCount = data.unread_count ?? 0;

            // Trigger alert toast & chime if a new unread arrives
            if (!isFirstFetchRef.current && newItems.length > 0) {
                const newlyArrived = newItems.filter(
                    (newItem) => !newItem.read && !prevItemsRef.current.some((oldItem) => oldItem.id === newItem.id)
                );
                if (newlyArrived.length > 0) {
                    setActiveToast(newlyArrived[0]);
                    if (soundEnabled) {
                        playNotificationChime();
                    }
                }
            }

            prevItemsRef.current = newItems;
            isFirstFetchRef.current = false;
            setItems(newItems);
            setUnreadCount(newUnreadCount);
        } catch {
            // Silently ignore network hiccup
        }
    }, [role, reporterHash, soundEnabled]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Toast auto-dismiss
    useEffect(() => {
        if (activeToast) {
            const timer = setTimeout(() => {
                setActiveToast(null);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [activeToast]);

    const markAllRead = async () => {
        try {
            let activeHash = reporterHash;
            if (!activeHash && typeof window !== "undefined") {
                try {
                    activeHash = await generateReporterHash(getDeviceId());
                } catch {
                    // Ignore
                }
            }
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mark_all_read: true, role, reporter_hash: activeHash }),
            });
            if (res.ok) {
                setUnreadCount(0);
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }
        } catch {
            // Ignore
        }
    };

    const markSingleRead = async (notifId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notification_ids: [notifId], role, reporter_hash: reporterHash }),
            });
            setItems((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // Ignore
        }
    };

    const deleteNotification = async (notifId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/notifications?id=${encodeURIComponent(notifId)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                const target = items.find((n) => n.id === notifId);
                setItems((prev) => prev.filter((n) => n.id !== notifId));
                if (target && !target.read) {
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                }
            }
        } catch {
            // Ignore
        }
    };

    const clearReadNotifications = async () => {
        try {
            const params = new URLSearchParams({ clear_read: "true" });
            if (role) params.set("role", role);
            if (reporterHash) params.set("reporter_hash", reporterHash);
            const res = await fetch(`/api/notifications?${params.toString()}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setItems((prev) => prev.filter((n) => !n.read));
            }
        } catch {
            // Ignore
        }
    };

    const handleNotifClick = async (notif: NotifItem) => {
        if (!notif.read) {
            markSingleRead(notif.id);
        }

        if (notif.report_id) {
            const destination =
                role === "admin"
                    ? `/admin/reports?id=${notif.report_id}`
                    : role === "staff"
                        ? `/staff?id=${notif.report_id}`
                        : `/track?id=${notif.report_id}`;
            setOpen(false);
            router.push(destination);
        } else {
            setOpen(false);
        }
    };

    // Filter computation
    const filteredItems = items.filter((item) => {
        if (activeFilter === "unread") return !item.read;
        const meta = getNotificationCategory(item, isDark);
        if (activeFilter === "urgent") return meta.isUrgent;
        if (activeFilter === "reports") return !meta.isUrgent && item.type !== "status_update";
        return true;
    });

    const urgentCount = items.filter((n) => getNotificationCategory(n, isDark).isUrgent).length;
    const reportCount = items.filter((n) => !getNotificationCategory(n, isDark).isUrgent && n.type !== "status_update").length;
    const readCount = items.filter((n) => n.read).length;

    return (
        <div className="relative">
            {/* Bell trigger button */}
            <button
                data-notif-bell-trigger="true"
                onClick={() => {
                    setOpen(!open);
                    if (!open) fetchNotifications();
                }}
                aria-label="Open notifications"
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                    isDark
                        ? "text-white/70 hover:bg-white/[0.08] hover:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                } ${open ? (isDark ? "bg-white/[0.12] text-white" : "bg-gray-100 text-gray-900") : ""}`}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[17px] h-4 px-1 text-[9px] font-extrabold text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-full shadow-sm animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Draggable Popover Panel */}
            {open && (
                <div
                    ref={panelRef}
                    style={{
                        transform: position
                            ? `translate3d(${position.x}px, ${position.y}px, 0)`
                            : "translate3d(calc(50vw - 50%), 56px, 0)",
                        willChange: isDragging ? "transform" : "auto",
                        transition: isDragging ? "none" : "box-shadow 0.2s, border-color 0.2s",
                    }}
                    className={`fixed top-0 left-0 z-[999] w-[95vw] max-w-sm sm:max-w-md max-h-[82vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                        isDragging
                            ? "ring-2 ring-emerald-500/50 shadow-emerald-500/20 shadow-2xl cursor-grabbing"
                            : ""
                    } ${
                        isDark
                            ? "bg-[#0d0d12]/98 border-white/10 shadow-black/90 text-white"
                            : "bg-white/98 border-gray-200 shadow-xl text-gray-900"
                    }`}
                >
                    {/* Visual Drag Handle Bar */}
                    <div
                        onPointerDown={handlePointerDown}
                        onDoubleClick={resetPosition}
                        title="Drag to move anywhere • Double-click to center"
                        className={`w-full py-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing border-b transition-colors select-none ${
                            isDark
                                ? "bg-white/[0.03] hover:bg-white/[0.06] border-white/5"
                                : "bg-gray-50/70 hover:bg-gray-100/70 border-gray-100"
                        }`}
                    >
                        <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                    </div>

                    {/* Draggable Header */}
                    <div
                        onPointerDown={handlePointerDown}
                        onDoubleClick={resetPosition}
                        title="Drag header to move • Double-click to center"
                        className={`flex items-center justify-between px-4 py-2.5 border-b select-none cursor-grab active:cursor-grabbing ${
                            isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-gray-50/50"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <GripHorizontal
                                className={`h-4 w-4 shrink-0 transition-colors ${
                                    isDragging ? "text-emerald-400" : isDark ? "text-white/30" : "text-gray-400"
                                }`}
                            />
                            <h3 className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                        isDark ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-rose-100 text-rose-700"
                                    }`}
                                >
                                    {unreadCount} new
                                </span>
                            )}
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-1">
                            {/* Chime Sound Toggle */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSoundEnabled(!soundEnabled);
                                    if (!soundEnabled) playNotificationChime();
                                }}
                                title={soundEnabled ? "Mute notification chime" : "Enable notification chime"}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    soundEnabled
                                        ? isDark
                                            ? "text-emerald-400 hover:bg-emerald-500/10"
                                            : "text-emerald-600 hover:bg-emerald-50"
                                        : isDark
                                            ? "text-white/30 hover:bg-white/[0.06]"
                                            : "text-gray-400 hover:bg-gray-100"
                                }`}
                            >
                                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                            </button>

                            {/* Re-center Position */}
                            <button
                                type="button"
                                onClick={resetPosition}
                                title="Center notification window"
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isDark ? "text-white/40 hover:bg-white/[0.06] hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                                }`}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                            </button>

                            {/* Mark All Read */}
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={markAllRead}
                                    title="Mark all notifications as read"
                                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                                        isDark
                                            ? "text-white/60 hover:text-white hover:bg-white/[0.08]"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                    }`}
                                >
                                    <Check className="h-3 w-3 text-emerald-400" />
                                    <span>Read all</span>
                                </button>
                            )}

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close notifications"
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isDark ? "text-white/40 hover:bg-white/[0.08] hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                                }`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Filter Tabs */}
                    <div
                        className={`flex items-center justify-between px-3 py-1.5 border-b overflow-x-auto text-[11px] font-medium gap-1 ${
                            isDark ? "border-white/[0.06] bg-black/25" : "border-gray-100 bg-gray-50/70"
                        }`}
                    >
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveFilter("all")}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeFilter === "all"
                                        ? "bg-emerald-500 text-white font-semibold shadow-sm"
                                        : isDark
                                            ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                                }`}
                            >
                                All ({items.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("unread")}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeFilter === "unread"
                                        ? "bg-emerald-500 text-white font-semibold shadow-sm"
                                        : isDark
                                            ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                                }`}
                            >
                                Unread ({unreadCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("urgent")}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeFilter === "urgent"
                                        ? "bg-rose-500 text-white font-semibold shadow-sm"
                                        : isDark
                                            ? "text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10"
                                            : "text-rose-600 hover:bg-rose-50"
                                }`}
                            >
                                Urgent ({urgentCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("reports")}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    activeFilter === "reports"
                                        ? "bg-blue-500 text-white font-semibold shadow-sm"
                                        : isDark
                                            ? "text-blue-400/80 hover:text-blue-300 hover:bg-blue-500/10"
                                            : "text-blue-600 hover:bg-blue-50"
                                }`}
                            >
                                Reports ({reportCount})
                            </button>
                        </div>

                        {/* Clear Read Button */}
                        {readCount > 0 && (
                            <button
                                type="button"
                                onClick={clearReadNotifications}
                                title="Clear all read notifications"
                                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors shrink-0 ${
                                    isDark
                                        ? "text-white/40 hover:text-rose-300 hover:bg-rose-500/10"
                                        : "text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                                }`}
                            >
                                <Trash2 className="h-3 w-3" />
                                <span>Clear read</span>
                            </button>
                        )}
                    </div>

                    {/* Scrollable Notification List */}
                    <div className="overflow-y-auto max-h-[62vh] divide-y divide-white/[0.04]">
                        {filteredItems.length === 0 ? (
                            <div className={`py-12 px-6 text-center text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="font-medium text-sm mb-1">No notifications</p>
                                <p className="text-[11px] opacity-75">
                                    {activeFilter === "unread"
                                        ? "You are all caught up!"
                                        : activeFilter === "urgent"
                                            ? "No urgent alerts or emergencies."
                                            : "No notifications match this filter."}
                                </p>
                            </div>
                        ) : (
                            filteredItems.map((n) => {
                                const cat = getNotificationCategory(n, isDark);
                                return (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotifClick(n)}
                                        className={`group relative w-full text-left flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${
                                            !n.read
                                                ? isDark
                                                    ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]"
                                                    : "bg-emerald-50/70 hover:bg-emerald-50"
                                                : isDark
                                                    ? "hover:bg-white/[0.03]"
                                                    : "hover:bg-gray-50"
                                        } ${cat.isUrgent && !n.read ? "border-l-4 border-rose-500" : !n.read ? "border-l-4 border-emerald-500" : "border-l-4 border-transparent"}`}
                                    >
                                        {/* Icon */}
                                        <div className="mt-0.5 shrink-0">{cat.icon}</div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pr-1">
                                            {/* Category Badge & Relative Time */}
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span
                                                    className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.badgeClass}`}
                                                >
                                                    {cat.label}
                                                </span>
                                                <span
                                                    title={new Date(n.created_at).toLocaleString("en-PH")}
                                                    className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}
                                                >
                                                    {formatRelativeTime(n.created_at)}
                                                </span>
                                                {!n.read && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                )}
                                            </div>

                                            {/* Title */}
                                            <p
                                                className={`text-xs font-semibold leading-snug line-clamp-1 ${
                                                    isDark ? "text-white/90" : "text-gray-800"
                                                }`}
                                            >
                                                {n.title}
                                            </p>

                                            {/* Message */}
                                            <p
                                                className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${
                                                    isDark ? "text-white/60" : "text-gray-600"
                                                }`}
                                            >
                                                {n.message}
                                            </p>
                                        </div>

                                        {/* Hover Actions */}
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!n.read && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => markSingleRead(n.id, e)}
                                                    title="Mark as read"
                                                    className={`p-1 rounded-lg transition-colors ${
                                                        isDark
                                                            ? "text-emerald-400 hover:bg-emerald-500/20"
                                                            : "text-emerald-600 hover:bg-emerald-100"
                                                    }`}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => deleteNotification(n.id, e)}
                                                title="Dismiss notification"
                                                className={`p-1 rounded-lg transition-colors ${
                                                    isDark
                                                        ? "text-white/40 hover:text-rose-400 hover:bg-rose-500/20"
                                                        : "text-gray-400 hover:text-rose-600 hover:bg-rose-100"
                                                }`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                            {n.report_id && (
                                                <ExternalLink
                                                    className={`h-3.5 w-3.5 ${
                                                        isDark ? "text-white/40" : "text-gray-400"
                                                    }`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Premium Toast Popup for incoming real-time notifications */}
            {activeToast && (
                <div
                    className={`fixed top-4 right-4 z-[9999] w-[92vw] max-w-sm p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 scale-100 animate-in slide-in-from-top-10 ${
                        isDark
                            ? "bg-[#0d0d12]/95 border-white/10 text-white shadow-black/50"
                            : "bg-white/95 border-gray-200 text-gray-900 shadow-gray-200/50"
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-xl bg-emerald-500/10 shrink-0 text-emerald-400">
                            {getNotificationCategory(activeToast, isDark).icon}
                        </div>
                        <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                                handleNotifClick(activeToast);
                                setActiveToast(null);
                            }}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-0.5">
                                Bagong Ulat / New Alert
                            </p>
                            <h4 className="text-xs font-bold truncate">{activeToast.title}</h4>
                            <p
                                className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${
                                    isDark ? "text-white/70" : "text-gray-600"
                                }`}
                            >
                                {activeToast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setActiveToast(null)}
                            className={`p-1 rounded-lg transition-colors ${
                                isDark
                                    ? "text-white/40 hover:bg-white/[0.06] hover:text-white"
                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                            }`}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}