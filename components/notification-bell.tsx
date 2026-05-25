"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, AlertTriangle, FileWarning, RefreshCw, ExternalLink } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useRouter } from "next/navigation";

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

    const fetchNotifications = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (role) params.set("role", role);
            if (reporterHash) params.set("reporter_hash", reporterHash);
            if (role === "user" && !reporterHash) return;
            const res = await fetch(`/api/notifications?${params.toString()}`);
            const data = await res.json();
            setItems(data.notifications ?? []);
            setUnreadCount(data.unread_count ?? 0);
        } catch { /* ignore */ }
    }, [role, reporterHash]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAllRead = async () => {
        try {
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mark_all_read: true, role, reporter_hash: reporterHash }),
            });
            if (res.ok) {
                setUnreadCount(0);
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }
        } catch { /* ignore */ }
    };

    const handleNotifClick = async (notif: NotifItem) => {
        // Mark this notification as read
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notification_ids: [notif.id] }),
            });
            setItems((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
            setUnreadCount((prev) => Math.max(0, prev - (notif.read ? 0 : 1)));
        } catch { /* ignore */ }

        // Navigate to relevant content
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
        if (type === "status_update") return <RefreshCw className="h-3.5 w-3.5 text-blue-400" />;
        return <FileWarning className="h-3.5 w-3.5 text-indigo-400" />;
    };

    return (
        <div className="relative">
            <button
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
                <>
                    <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
                    {/* Top slide-down panel */}
                    <div className={`fixed left-1/2 -translate-x-1/2 top-14 z-[999] w-[95vw] max-w-sm max-h-[75vh] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 ${isDark ? "bg-[#0d0d12]/98 border-white/10" : "bg-white border-gray-200"
                        }`}>
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "border-white/[0.08]" : "border-gray-100"}`}>
                            <div className="flex items-center gap-2">
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
                                    <button onClick={markAllRead} className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${isDark ? "text-white/50 hover:bg-white/[0.06]" : "text-gray-500 hover:bg-gray-100"
                                        }`}>
                                        <Check className="h-3 w-3 inline mr-1" />Mark all read
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} className={`p-1 rounded-lg ${isDark ? "text-white/40 hover:bg-white/[0.06]" : "text-gray-400 hover:bg-gray-100"}`}>
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
                                                ? isDark ? "bg-indigo-500/[0.08] border-white/[0.04] hover:bg-indigo-500/[0.12]" : "bg-indigo-50/60 border-gray-50 hover:bg-indigo-50"
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
                                            {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />}
                                            {n.report_id && <ExternalLink className={`h-3 w-3 ${isDark ? "text-white/20" : "text-gray-300"}`} />}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
