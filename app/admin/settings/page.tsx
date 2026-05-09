"use client";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { User, Lock, Palette, Globe, Save, Eye, EyeOff, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function AccountSettingsPage() {
    const { theme, toggleTheme } = useTheme();
    const { locale, setLocale, t } = useLanguage();
    const isDark = theme === "dark";
    
    const [loading, setLoading] = useState(false);
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
        // Load user profile data
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            // This would typically come from an API
            // For now, using mock data
            setProfile({
                username: "admin",
                email: "admin@speakup-payatas.com",
                role: "admin"
            });
        } catch (error) {
            toast.error("Failed to load profile");
        }
    };

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            // API call to update profile
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            toast.success("Profile updated successfully");
        } catch (error) {
            toast.error("Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }
        
        if (passwordForm.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            // API call to change password
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            toast.success("Password changed successfully");
            setPasswordForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
        } catch (error) {
            toast.error("Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            toast.success("Logged out successfully");
            window.location.href = "/login";
        } catch (error) {
            toast.error("Failed to logout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
                {/* Header */}
                <div>
                    <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                        Account Settings
                    </h1>
                    <p className={`text-sm mt-2 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        Manage your account settings and preferences.
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Username
                            </label>
                            <input
                                type="text"
                                value={profile.username}
                                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                    ? "bg-white/5 border-white/10 text-white" 
                                    : "bg-gray-50 border-gray-200 text-gray-900"}`}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
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
                                className={`w-full px-4 py-2 rounded-lg border outline-none opacity-60 cursor-not-allowed ${isDark 
                                    ? "bg-white/5 border-white/10 text-white" 
                                    : "bg-gray-50 border-gray-200 text-gray-900"}`}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleProfileUpdate}
                            disabled={loading}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </div>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Password Change */}
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
                            Change Password
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                        ? "bg-white/5 border-white/10 text-white" 
                                        : "bg-gray-50 border-gray-200 text-gray-900"}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/40" : "text-gray-400"}`}
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                        ? "bg-white/5 border-white/10 text-white" 
                                        : "bg-gray-50 border-gray-200 text-gray-900"}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/40" : "text-gray-400"}`}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isDark 
                                        ? "bg-white/5 border-white/10 text-white" 
                                        : "bg-gray-50 border-gray-200 text-gray-900"}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-white/40" : "text-gray-400"}`}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={handlePasswordChange}
                            disabled={loading}
                            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Updating...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Change Password
                                </div>
                            )}
                        </Button>
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
