"use client";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { User, Lock, Palette, Globe, Eye, EyeOff, LogOut, AlertTriangle, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function AccountSettingsPage() {
    const { theme, toggleTheme } = useTheme();
    const { locale, setLocale, t } = useLanguage();
    const isDark = theme === "dark";

    const [loading, setLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [profile, setProfile] = useState({
        username: "",
        email: "",
        role: ""
    });
    
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setProfileLoading(true);
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store" });
            if (!res.ok) {
                toast.error("Failed to load profile. Please re-login.");
                return;
            }
            const data = await res.json();
            if (data?.authenticated) {
                setProfile({
                    username: data.username ?? "",
                    email: data.username ?? "",
                    role: data.role ?? "",
                });
            } else {
                toast.error("Session expired. Please re-login.");
            }
        } catch {
            toast.error("Failed to load profile");
        } finally {
            setProfileLoading(false);
        }
    };

    const handleProfileUpdate = async () => {
        toast.info("Admin and staff profiles are managed via server environment variables. Contact the system administrator to make changes.");
    };

    const handlePasswordChange = async () => {
        toast.info("Admin and staff passwords are managed via server environment variables. Update the ADMIN_PASSWORD or STAFF_PASSWORD environment variable and restart the server.");
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            toast.success("Logged out successfully");
        } catch (error) {
            console.error("Logout error", error);
        } finally {
            setLoading(false);
            window.location.href = "/login";
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-8 pb-24">
                {/* Header */}
                <div>
                    <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                        Account Settings
                    </h1>
                    <p className={`text-sm mt-2 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        {profileLoading ? "Loading your profile…" : `Signed in as ${profile.role} · ${profile.username}`}
                    </p>
                </div>

                {/* Profile Information */}
                <div className={`rounded-2xl border p-6 space-y-6 ${isDark 
                    ? "bg-white/5 border-white/10" 
                    : "bg-white border-gray-200"}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark 
                            ? "bg-indigo-500/20 text-indigo-400" 
                            : "bg-indigo-100 text-indigo-600"}`}>
                            <User className="h-5 w-5" />
                        </div>
                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Profile Information
                        </h2>
                    </div>

                    {profileLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.username}
                                        disabled
                                        className={`w-full px-4 py-2 rounded-lg border outline-none opacity-60 cursor-not-allowed ${isDark
                                            ? "bg-white/5 border-white/10 text-white"
                                            : "bg-gray-50 border-gray-200 text-gray-900"}`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                        Role
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.role}
                                        disabled
                                        className={`w-full px-4 py-2 rounded-lg border outline-none opacity-60 cursor-not-allowed capitalize ${isDark
                                            ? "bg-white/5 border-white/10 text-white"
                                            : "bg-gray-50 border-gray-200 text-gray-900"}`}
                                    />
                                </div>
                            </div>

                            <div className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? "bg-indigo-500/[0.06] border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
                                <Info className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                                <p className={`text-xs leading-relaxed ${isDark ? "text-indigo-200/80" : "text-indigo-700"}`}>
                                    Admin and staff profiles are system accounts managed via server environment variables.
                                    To update credentials, modify the <code className="font-mono">ADMIN_EMAIL</code> / <code className="font-mono">STAFF_EMAIL</code> variables and restart the server.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Security */}
                <div className={`rounded-2xl border p-6 space-y-6 ${isDark
                    ? "bg-white/5 border-white/10"
                    : "bg-white border-gray-200"}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-amber-100 text-amber-600"}`}>
                            <Lock className="h-5 w-5" />
                        </div>
                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Security
                        </h2>
                    </div>

                    <div className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? "bg-amber-500/[0.06] border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                        <Info className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                        <div>
                            <p className={`text-xs leading-relaxed ${isDark ? "text-amber-200/80" : "text-amber-700"}`}>
                                Admin and staff passwords are managed through server environment variables for security.
                            </p>
                            <p className={`text-xs leading-relaxed mt-1.5 ${isDark ? "text-amber-200/60" : "text-amber-600"}`}>
                                To change your password, update the <code className="font-mono px-1 py-0.5 rounded bg-amber-500/10">ADMIN_PASSWORD</code> or <code className="font-mono px-1 py-0.5 rounded bg-amber-500/10">STAFF_PASSWORD</code> environment variable in your deployment configuration, then restart the server.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Preferences */}
                <div className={`rounded-2xl border p-6 space-y-6 ${isDark 
                    ? "bg-white/5 border-white/10" 
                    : "bg-white border-gray-200"}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark 
                            ? "bg-purple-500/20 text-purple-400" 
                            : "bg-purple-100 text-purple-600"}`}>
                            <Palette className="h-5 w-5" />
                        </div>
                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Preferences
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Theme
                            </label>
                            <select
                                value={theme}
                                onChange={() => toggleTheme()}
                                className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                    ? "bg-white/5 border-white/10 text-white" 
                                    : "bg-gray-50 border-gray-200 text-gray-900"}`}
                            >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Language
                            </label>
                            <select
                                value={locale}
                                onChange={(e) => setLocale(e.target.value as "en" | "fil")}
                                className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                    ? "bg-white/5 border-white/10 text-white" 
                                    : "bg-gray-50 border-gray-200 text-gray-900"}`}
                            >
                                <option value="en">English</option>
                                <option value="fil">Tagalog</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Logout Section */}
                <div className={`rounded-2xl border p-6 space-y-6 ${isDark 
                    ? "bg-red-500/5 border-red-500/20" 
                    : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark 
                            ? "bg-red-500/20 text-red-400" 
                            : "bg-red-100 text-red-600"}`}>
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Logout
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
                            Logging out will end your current session and you'll need to login again to access your account.
                        </p>
                        
                        <div className={`p-4 rounded-lg border ${isDark 
                            ? "bg-red-500/10 border-red-500/30" 
                            : "bg-red-100 border-red-300"}`}>
                            <div className="flex items-start gap-3">
                                <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isDark ? "text-red-400" : "text-red-600"}`} />
                                <div>
                                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                                        Are you sure you want to logout?
                                    </p>
                                    <p className={`text-xs mt-1 ${isDark ? "text-white/60" : "text-gray-500"}`}>
                                        Make sure you've saved any important work before logging out.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleLogout}
                                disabled={loading}
                                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Logging out...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <LogOut className="h-4 w-4" />
                                        Logout
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
