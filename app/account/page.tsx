"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    UserRound,
    Mail,
    Smartphone,
    Lock,
    Eye,
    EyeOff,
    AlertTriangle,
    Trash2,
    PowerOff,
    Save,
    Check,
    X as XIcon,
    ShieldAlert,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { validatePassword } from "@/lib/password-validation";

interface AccountData {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    has_password: boolean;
    created_at: string;
    updated_at: string;
}

type DangerMode = "delete" | "deactivate";

export default function AccountSettingsPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [account, setAccount] = useState<AccountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [showDangerConfirm, setShowDangerConfirm] = useState<DangerMode | null>(null);
    const [dangerPassword, setDangerPassword] = useState("");
    const [dangerSubmitting, setDangerSubmitting] = useState(false);

    const passwordValidation = useMemo(
        () => (newPassword ? validatePassword(newPassword) : null),
        [newPassword],
    );

    const isEmailUser = useMemo(() => Boolean(account?.email), [account]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/auth/account", { cache: "no-store" });
                if (res.status === 401) {
                    router.push("/login?next=/account");
                    return;
                }
                const data = await res.json();
                if (!res.ok) {
                    if (!cancelled) setLoadError(data?.error || "Unable to load account.");
                    return;
                }
                if (!cancelled) {
                    setAccount(data.user);
                    setEmail(data.user?.email ?? "");
                    const rawPhone = data.user?.phone ?? "";
                    setPhone(rawPhone ? rawPhone.replace(/^\+63/, "0") : "");
                }
            } catch (e) {
                if (!cancelled) setLoadError(e instanceof Error ? e.message : "Network error.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [router]);

    const normalizedPhoneLast10 = phone.replace(/\D/g, "").slice(-10);
    const emailChanged = account?.email !== null && email.trim().toLowerCase() !== (account?.email ?? "");
    const phoneChanged = (() => {
        const accountPhone10 = (account?.phone ?? "").replace(/^\+63/, "").replace(/\D/g, "").slice(-10);
        return normalizedPhoneLast10 !== accountPhone10;
    })();
    const wantsPasswordChange = newPassword.length > 0;
    const passwordsMatch = newPassword === confirmPassword;
    const passwordValid = passwordValidation?.isValid ?? false;
    const needsCurrentPassword = isEmailUser && (emailChanged || wantsPasswordChange) && account?.has_password;
    const hasAnyChanges = emailChanged || phoneChanged || wantsPasswordChange;

    const submitDisabled =
        saving
        || !hasAnyChanges
        || (wantsPasswordChange && (!passwordValid || !passwordsMatch))
        || (Boolean(needsCurrentPassword) && currentPassword.length === 0);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!hasAnyChanges) return;
        if (wantsPasswordChange && !passwordValid) {
            setFormError("New password doesn't meet the requirements.");
            return;
        }
        if (wantsPasswordChange && !passwordsMatch) {
            setFormError("New passwords do not match.");
            return;
        }
        setSaving(true);
        try {
            const payload: Record<string, string> = {};
            if (emailChanged) payload.email = email.trim();
            if (phoneChanged) payload.phone = normalizedPhoneLast10;
            if (wantsPasswordChange) payload.newPassword = newPassword;
            if (needsCurrentPassword) payload.currentPassword = currentPassword;

            const res = await fetch("/api/auth/account", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update account.");
            }
            setAccount(data.user);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Account updated.");
            // Refresh server components (notably the nav) so the new email/phone is visible.
            router.refresh();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            setFormError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDanger = async () => {
        if (!showDangerConfirm) return;
        setDangerSubmitting(true);
        try {
            const res = await fetch("/api/auth/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: showDangerConfirm,
                    currentPassword: dangerPassword,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Unable to complete request.");
            }
            toast.success(showDangerConfirm === "delete" ? "Account deleted." : "Account deactivated.");
            window.location.href = "/login";
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong.";
            toast.error(msg);
        } finally {
            setDangerSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-full ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (loadError || !account) {
        return (
            <div className={`flex flex-col items-center justify-center h-full px-4 gap-3 ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
                <ShieldAlert className={`h-8 w-8 ${isDark ? "text-red-400" : "text-red-500"}`} />
                <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>
                    {loadError || "Unable to load your account."}
                </p>
                <Button variant="outline" onClick={() => router.refresh()}>Try again</Button>
            </div>
        );
    }

    return (
        <div className={`h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-10 space-y-6 pb-24">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                        <UserRound className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Account Settings
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Manage your profile, password, and account preferences.
                        </p>
                    </div>
                </div>

                <Card className={isDark ? "bg-white/[0.03] border-white/[0.08]" : ""}>
                    <CardHeader>
                        <CardTitle className="text-base">Profile</CardTitle>
                        <CardDescription>
                            Update your contact information. Email is used to sign in; mobile receives security codes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Email</label>
                                    <div className="relative">
                                        <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                        <Input
                                            type="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            disabled={!isEmailUser}
                                            className="pl-10"
                                        />
                                    </div>
                                    {!isEmailUser && (
                                        <p className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                            Your account uses a mobile number. Email can't be set here.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Mobile (PH)</label>
                                    <div className="relative">
                                        <Smartphone className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                        <Input
                                            type="tel"
                                            autoComplete="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="09171234567"
                                            className="pl-10"
                                        />
                                    </div>
                                    {phone && normalizedPhoneLast10.length !== 10 && (
                                        <p className="text-[11px] text-red-500">Enter a valid 10-digit PH mobile number.</p>
                                    )}
                                </div>
                            </div>

                            <div className={`pt-2 border-t border-dashed ${isDark ? "border-white/[0.08]" : "border-gray-200"}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lock className={`h-4 w-4 ${isDark ? "text-white/55" : "text-gray-500"}`} />
                                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Change password</h3>
                                    <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>(optional)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>New password</label>
                                        <div className="relative">
                                            <Input
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="At least 8 characters"
                                                autoComplete="new-password"
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword((v) => !v)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${isDark ? "text-white/50 hover:bg-white/10" : "text-gray-400 hover:bg-gray-100"}`}
                                                aria-label={showNewPassword ? "Hide password" : "Show password"}
                                            >
                                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Confirm new password</label>
                                        <Input
                                            type={showNewPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat the new password"
                                            autoComplete="new-password"
                                            aria-invalid={wantsPasswordChange && !passwordsMatch ? true : undefined}
                                            className={wantsPasswordChange && !passwordsMatch ? "border-red-500 ring-1 ring-red-500/30" : ""}
                                        />
                                        {wantsPasswordChange && !passwordsMatch && confirmPassword.length > 0 && (
                                            <p className="text-[11px] text-red-500">Passwords do not match.</p>
                                        )}
                                    </div>
                                </div>
                                {passwordValidation && (
                                    <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                                        {passwordValidation.rules.map((rule) => (
                                            <li
                                                key={rule.id}
                                                className={`text-[11px] flex items-center gap-1.5 ${rule.met
                                                    ? "text-emerald-500"
                                                    : isDark ? "text-white/45" : "text-gray-500"}`}
                                            >
                                                {rule.met ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                                                <span>{rule.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {needsCurrentPassword && (
                                <div className={`p-3 rounded-xl border ${isDark ? "bg-amber-500/[0.08] border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                                    <label className={`text-xs font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}>
                                        Confirm with your current password
                                    </label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            type={showCurrent ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Current password"
                                            autoComplete="current-password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrent((v) => !v)}
                                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${isDark ? "text-white/50 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
                                            aria-label={showCurrent ? "Hide password" : "Show password"}
                                        >
                                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {formError && (
                                <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                    {formError}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <Button type="submit" disabled={submitDisabled} className="gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save changes
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className={isDark ? "bg-white/[0.03] border-red-500/20" : "border-red-200"}>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <CardTitle className="text-base text-red-500">Danger zone</CardTitle>
                        </div>
                        <CardDescription>
                            Deactivate to temporarily disable sign-in, or permanently delete your account. Both actions sign you out.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border ${isDark ? "bg-amber-500/[0.05] border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
                            <div>
                                <p className={`text-sm font-semibold ${isDark ? "text-amber-200" : "text-amber-800"}`}>Deactivate account</p>
                                <p className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-700/80"}`}>
                                    You won&apos;t be able to sign in until an admin re-enables your account.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setDangerPassword(""); setShowDangerConfirm("deactivate"); }}
                                className="gap-2 border-amber-500/40 text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/10"
                            >
                                <PowerOff className="h-4 w-4" />
                                Deactivate
                            </Button>
                        </div>
                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border ${isDark ? "bg-red-500/[0.05] border-red-500/20" : "bg-red-50 border-red-200"}`}>
                            <div>
                                <p className={`text-sm font-semibold ${isDark ? "text-red-200" : "text-red-800"}`}>Delete account</p>
                                <p className={`text-xs ${isDark ? "text-red-300/80" : "text-red-700/80"}`}>
                                    Permanently removes your login. Existing reports remain anonymous in the public record.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => { setDangerPassword(""); setShowDangerConfirm("delete"); }}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>

                        <div className={`text-[11px] flex items-center gap-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                            <Badge variant="outline" className={isDark ? "border-white/10 text-white/60" : ""}>
                                Role: {account.role}
                            </Badge>
                            <span>Member since {new Date(account.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {showDangerConfirm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}>
                        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.08]" : "border-gray-100"} flex items-center gap-2`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${showDangerConfirm === "delete"
                                ? isDark ? "bg-red-500/15" : "bg-red-50"
                                : isDark ? "bg-amber-500/15" : "bg-amber-50"}`}>
                                {showDangerConfirm === "delete"
                                    ? <Trash2 className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-600"}`} />
                                    : <PowerOff className={`h-4 w-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />}
                            </div>
                            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                {showDangerConfirm === "delete" ? "Delete account" : "Deactivate account"}
                            </h2>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                Are you sure? {showDangerConfirm === "delete" ? "This cannot be undone." : "You can ask an admin to restore your account later."}
                            </p>
                            {account.has_password && (
                                <div>
                                    <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                        Confirm with your password
                                    </label>
                                    <Input
                                        type="password"
                                        autoComplete="current-password"
                                        value={dangerPassword}
                                        onChange={(e) => setDangerPassword(e.target.value)}
                                        placeholder="Current password"
                                        className="mt-1.5"
                                    />
                                </div>
                            )}
                        </div>
                        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-gray-50"}`}>
                            <Button type="button" variant="outline" onClick={() => setShowDangerConfirm(null)} disabled={dangerSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant={showDangerConfirm === "delete" ? "destructive" : "outline"}
                                onClick={handleDanger}
                                disabled={dangerSubmitting || (account.has_password && dangerPassword.length === 0)}
                                className="gap-2"
                            >
                                {dangerSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : showDangerConfirm === "delete" ? <Trash2 className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                {showDangerConfirm === "delete" ? "Yes, delete" : "Yes, deactivate"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
