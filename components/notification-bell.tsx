"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, Check, AlertTriangle, ClipboardPen, FileWarning, RefreshCw, ExternalLink, GripHorizontal } from "lucide-react";
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

export default function NotificationBell({ role, reporterHash }: { role?: string; reporterHash?: string }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotifItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeToast, setActiveToast] = useState<NotifItem | null>(null);

    const prevItemsRef = useRef<NotifItem[]>([]);
    const isFirstFetchRef = useRef(true);

    // Draggable popover state (hardware-accelerated, zero re-renders during motion)
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        isDragging: boolean;
        startX: number;
        startY: number;
        initialPosX: number;
        initialPosY: number;
        panelWidth: number;
        panelHeight: number;
        hasMoved: boolean;
        rafId: number | null;
        currentX: number;
        currentY: number;
    }>({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialPosX: 0,
        initialPosY: 0,
        panelWidth: 384,
        panelHeight: 500,
        hasMoved: false,
        rafId: null,
        currentX: 0,
        currentY: 0,
    });

    // Initialize or clamp position when panel opens or window resizes
    useEffect(() => {
        if (!open || typeof window === "undefined") return;

        if (!position) {
            const modalWidth = Math.min(window.innerWidth * 0.95, 384);
            const initialX = Math.max(16, (window.innerWidth - modalWidth) / 2);
            const initialY = 56;
            setPosition({ x: initialX, y: initialY });
        }

        const handleResize = () => {
            setPosition((prev) => {
                if (!prev) return null;
                const modalWidth = panelRef.current ? panelRef.current.offsetWidth : Math.min(window.innerWidth * 0.95, 384);
                const modalHeight = panelRef.current ? panelRef.current.offsetHeight : 400;
                const maxX = Math.max(8, window.innerWidth - modalWidth - 8);
                const maxY = Math.max(8, window.innerHeight - modalHeight - 16);
                return {
                    x: Math.min(Math.max(8, prev.x), maxX),
                    y: Math.min(Math.max(8, prev.y), maxY),
                };
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [open, position]);

    // Handle outside clicks to close notifications without a blocking backdrop
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

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if ((e.target as HTMLElement).closest("button")) return;

        const panel = panelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        dragRef.current.isDragging = true;
        dragRef.current.hasMoved = false;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.initialPosX = rect.left;
        dragRef.current.initialPosY = rect.top;
        dragRef.current.panelWidth = rect.width;
        dragRef.current.panelHeight = rect.height;
        dragRef.current.currentX = rect.left;
        dragRef.current.currentY = rect.top;

        panel.style.userSelect = "none";

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch { /* ignore fallback */ }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.isDragging || !panelRef.current) return;

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;

        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            dragRef.current.hasMoved = true;
        }

        const maxX = Math.max(8, window.innerWidth - dragRef.current.panelWidth - 8);
        const maxY = Math.max(8, window.innerHeight - 80);

        const targetX = Math.min(Math.max(8, dragRef.current.initialPosX + deltaX), maxX);
        const targetY = Math.min(Math.max(8, dragRef.current.initialPosY + deltaY), maxY);

        dragRef.current.currentX = targetX;
        dragRef.current.currentY = targetY;

        if (dragRef.current.rafId) {
            cancelAnimationFrame(dragRef.current.rafId);
        }

        dragRef.current.rafId = requestAnimationFrame(() => {
            if (panelRef.current) {
                panelRef.current.style.left = `${targetX}px`;
                panelRef.current.style.top = `${targetY}px`;
                panelRef.current.style.transform = "none";
            }
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.isDragging) return;

        if (dragRef.current.rafId) {
            cancelAnimationFrame(dragRef.current.rafId);
            dragRef.current.rafId = null;
        }

        dragRef.current.isDragging = false;

        if (panelRef.current) {
            panelRef.current.style.userSelect = "";
        }

        try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch { /* ignore */ }

        // Sync final position to state once on release
        setPosition({
            x: dragRef.current.currentX,
            y: dragRef.current.currentY,
        });

        setTimeout(() => {
            dragRef.current.hasMoved = false;
        }, 100);
    };

    const resetPosition = () => {
        if (typeof window === "undefined") return;
        const modalWidth = Math.min(window.innerWidth * 0.95, 384);
        const initialX = Math.max(16, (window.innerWidth - modalWidth) / 2);
        const initialY = 56;
        setPosition({ x: initialX, y: initialY });
        dragRef.current.currentX = initialX;
        dragRef.current.currentY = initialY;
        if (panelRef.current) {
            panelRef.current.style.left = `${initialX}px`;
            panelRef.current.style.top = `${initialY}px`;
            panelRef.current.style.transform = "none";
        }
    };

    const fetchNotifications = useCallback(async () => {
        try {
            let activeHash = reporterHash;
            if (!activeHash && typeof window !== "undefined") {
                try {
                    activeHash = await generateReporterHash(getDeviceId());
                } catch {}
            }
            const params = new URLSearchParams();
            if (role) params.set("role", role);
            if (activeHash) params.set("reporter_hash", activeHash);
            const res = await fetch(`/api/notifications?${params.toString()}`);
            const data = await res.json();
            
            const newItems: NotifItem[] = data.notifications ?? [];
            const newUnreadCount = data.unread_count ?? 0;

            // Trigger premium toast popup if a new unread notification has arrived
            if (!isFirstFetchRef.current && newItems.length > 0) {
                const newlyArrived = newItems.filter(
                    (newItem) => !newItem.read && !prevItemsRef.current.some((oldItem) => oldItem.id === newItem.id)
                );
                if (newlyArrived.length > 0) {
                    setActiveToast(newlyArrived[0]);
                }
            }

            prevItemsRef.current = newItems;
            isFirstFetchRef.current = false;
            setItems(newItems);
            setUnreadCount(newUnreadCount);
        } catch { /* ignore */ }
    }, [role, reporterHash]);

    useEffect(() => {
        fetchNotifications();
        // Poll every 15 seconds for a responsive feel
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Auto-dismiss the notification toast after 6 seconds
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
                } catch { /* the server can still use the signed-in account */ }
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
        } catch { /* ignore */ }
    };

    const handleNotifClick = async (notif: NotifItem) => {
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notification_ids: [notif.id], role, reporter_hash: reporterHash }),
            });
            setItems((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
            setUnreadCount((prev) => Math.max(0, prev - (notif.read ? 0 : 1)));
        } catch { /* ignore */ }

        if (notif.report_id) {
            const destination = role === "admin"
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

    const getIcon = (type: string) => {
        if (type === "high_priority") return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
        if (type === "status_update") return <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />;
        if (type === "encoded_report") return <ClipboardPen className="h-3.5 w-3.5 text-emerald-400" />;
        return <FileWarning className="h-3.5 w-3.5 text-emerald-400" />;
    };

    return (
        <div className="relative">
            <button
                data-notif-bell-trigger="true"
                onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${isDark ? "text-white/60 hover:bg-white/[0.08] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    }`}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    ref={panelRef}
                    style={{
                        left: position ? `${position.x}px` : "50%",
                        top: position ? `${position.y}px` : "56px",
                        transform: position ? "none" : "translateX(-50%)",
                        willChange: "left, top",
                    }}
                    className={`fixed z-[999] w-[95vw] max-w-sm max-h-[75vh] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                        isDark ? "bg-[#0d0d12]/98 border-white/10 shadow-black/80" : "bg-white border-gray-200 shadow-xl"
                    }`}
                >
                    {/* Draggable Header */}
                    <div
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onDoubleClick={resetPosition}
                        title="Drag header to move • Double-click to center"
                        style={{ touchAction: "none" }}
                        className={`flex items-center justify-between px-4 py-3 border-b select-none cursor-grab active:cursor-grabbing transition-colors ${
                            isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-gray-50/50"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <GripHorizontal className={`h-4 w-4 shrink-0 transition-colors ${
                                isDark ? "text-white/30" : "text-gray-400"
                            }`} />
                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"}`}>
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={markAllRead}
                                    className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${isDark ? "text-white/50 hover:bg-white/[0.06]" : "text-gray-500 hover:bg-gray-100"}`}
                                >
                                    <Check className="h-3 w-3 inline mr-1" />Mark all read
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close notifications"
                                className={`p-1 rounded-lg transition-colors ${isDark ? "text-white/40 hover:bg-white/[0.06] hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                        <div className="overflow-y-auto max-h-[60vh]">
                            {items.length === 0 ? (
                                <div className={`py-10 text-center text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    No notifications yet
                                </div>
                            ) : (
                                items.map((n) => (
                                    <button
                                        key={n.id}
                                        onClick={() => handleNotifClick(n)}
                                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-opacity-80 ${!n.read
                                                ? isDark ? "bg-[#e6f4ea]0/[0.08] border-white/[0.04] hover:bg-[#e6f4ea]0/[0.12]" : "bg-[#e6f4ea]/60 border-gray-50 hover:bg-[#e6f4ea]"
                                                : isDark ? "border-white/[0.04] hover:bg-white/[0.03]" : "border-gray-50 hover:bg-gray-50"
                                            }`}
                                    >
                                        <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                {n.title}
                                            </p>
                                            <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? "text-white/50" : "text-gray-600"}`}>
                                                {n.message}
                                            </p>
                                            <p className={`text-[10px] mt-1.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                                {new Date(n.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            {!n.read && <span className="w-2 h-2 rounded-full bg-[#e6f4ea]0 mt-1" />}
                                            {n.report_id && <ExternalLink className={`h-3 w-3 ${isDark ? "text-white/20" : "text-gray-300"}`} />}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
            )}

            {/* Premium Toast Popup for incoming notifications */}
            {activeToast && (
                <div className={`fixed top-4 right-4 z-[9999] w-[92vw] max-w-sm p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 scale-100 animate-in slide-in-from-top-10 ${
                    isDark ? "bg-[#0d0d12]/95 border-white/10 text-white shadow-black/50" : "bg-white/95 border-gray-200 text-gray-900 shadow-gray-200/50"
                }`}>
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-xl bg-emerald-500/10 shrink-0 text-emerald-400">
                            {getIcon(activeToast.type)}
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                            handleNotifClick(activeToast);
                            setActiveToast(null);
                        }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-0.5">
                                Bagong Ulat / New Alert
                            </p>
                            <h4 className="text-xs font-bold truncate">
                                {activeToast.title}
                            </h4>
                            <p className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                {activeToast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setActiveToast(null)}
                            className={`p-1 rounded-lg transition-colors ${isDark ? "text-white/40 hover:bg-white/[0.06] hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"}`}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
