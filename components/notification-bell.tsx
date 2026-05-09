"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check, AlertTriangle, FileWarning, RefreshCw } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

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
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotifItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (role) params.set("role", role);
            if (reporterHash) params.set("reporter_hash", reporterHash);
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
            const requestBody = { mark_all_read: true, role, reporter_hash: reporterHash };
            console.log("Sending request:", requestBody);
            
            const res = await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            
            const responseText = await res.text();
            console.log("API response:", res.status, responseText);
            
            if (res.ok) {
                setUnreadCount(0);
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            } else {
                console.error("Failed to mark all as read:", responseText);
            }
        } catch (error) {
            console.error("Error marking all as read:", error);
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
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                    isDark ? "text-white/60 hover:bg-white/[0.08] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-[998] backdrop-blur-sm bg-black/20" onClick={() => setOpen(false)} />
                    <div className={`fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-[999] w-[90vw] max-w-md max-h-[70vh] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                        isDark ? "bg-black/95 border-white/10 backdrop-blur-xl" : "bg-white border-gray-200"
                    }`}>
                        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/[0.08]" : "border-gray-100"}`}>
                            <h3 className={`text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                Notifications
                            </h3>
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                                        isDark ? "text-white/50 hover:bg-white/[0.06]" : "text-gray-500 hover:bg-gray-100"
                                    }`}>
                                        <Check className="h-3 w-3 inline mr-1" />Mark all read
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} className={`p-1 rounded-lg ${isDark ? "text-white/40 hover:bg-white/[0.06]" : "text-gray-400 hover:bg-gray-100"}`}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-[55vh]">
                            {items.length === 0 ? (
                                <div className={`py-8 text-center text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                    No notifications yet
                                </div>
                            ) : (
                                items.map((n) => (
                                    <div key={n.id} className={`flex items-start gap-4 px-5 py-4 border-b transition-colors ${
                                        !n.read
                                            ? isDark ? "bg-indigo-500/[0.06] border-white/[0.04]" : "bg-indigo-50/50 border-gray-50"
                                            : isDark ? "border-white/[0.04]" : "border-gray-50"
                                    }`}>
                                        <div className="mt-0.5">{getIcon(n.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                {n.title}
                                            </p>
                                            <p className={`text-sm mt-1 line-clamp-2 ${isDark ? "text-white/50" : "text-gray-600"}`}>
                                                {n.message}
                                            </p>
                                            <p className={`text-xs mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                                {new Date(n.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
