"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Mail, Lock, Eye, EyeOff, Smartphone } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EmergencyReminder from "@/components/emergency-reminder";
import { getSupabaseBrowser } from "@/lib/supabase";

type AuthMode = "login" | "register";
type AuthMethod = "password" | "email_otp";

export default function LoginPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [mode, setMode] = useState<AuthMode>("login");
    const [method, setMethod] = useState<AuthMethod>("password");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [registerPhone, setRegisterPhone] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [emailOtpPhone, setEmailOtpPhone] = useState("");
    const [otpEmail, setOtpEmail] = useState("");

    const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
    const normalizedRegisterPhone = registerPhone.replace(/\D/g, "").slice(-10);
    const normalizedEmailOtpPhone = emailOtpPhone.replace(/\D/g, "").slice(-10);
    const mapOtpSendError = (message: string) => {
        const m = message.toLowerCase();
        if (m.includes("signups not allowed for otp")) {
            return "Email OTP is blocked in Supabase. Enable Email signups in Supabase Auth settings (Authentication -> Providers -> Email).";
        }
        return message;
    };

    const resolveEmailForOtp = async (): Promise<string | null> => {
        try {
            const phone = normalizedEmailOtpPhone;
            if (phone.length !== 10) {
                setError("Enter a valid PH mobile number (e.g., 09171234567).");
                return null;
            }
            const res = await fetch("/api/auth/email-otp-target", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: mode, phone }),
            });
            const json = await res.json();
            if (!res.ok || typeof json?.email !== "string") {
                setError(typeof json?.error === "string" ? json.error : "Unable to find account email for this number.");
                return null;
            }
            setOtpEmail(json.email);
            return json.email;
        } catch {
            setError("Unable to find account email for this number.");
            return null;
        }
    };

    const sendEmailOtp = async () => {
        setError(null);
        const addr = await resolveEmailForOtp();
        if (!addr) {
            return;
        }
        try {
            setSendingOtp(true);
            const supabase = getSupabaseBrowser();
            const { error: otpErr } = await supabase.auth.signInWithOtp({
                email: addr,
                options: {
                    // For phone-linked existing app accounts, this avoids "signups not allowed for otp"
                    // when the email exists in app_users but not yet in Supabase auth.users.
                    shouldCreateUser: true,
                },
            });
            if (otpErr) {
                setError(mapOtpSendError(otpErr.message || "Unable to send email OTP."));
                return;
            }
            setOtpSent(true);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Unable to send email OTP.");
        }
        finally {
            setSendingOtp(false);
        }
    };

    const submitEmailOtpLogin = async () => {
        setError(null);
        const addr = otpEmail || await resolveEmailForOtp();
        if (!addr) {
            return;
        }
        if (!otpSent) {
            setError("Request a code first.");
            return;
        }
        if (normalizedEmailOtpPhone.length !== 10) {
            setError("Enter a valid PH mobile number (e.g., 09171234567).");
            return;
        }
        const token = otp.trim().replace(/\s/g, "");
        if (!/^\d{6,8}$/.test(token)) {
            setError("Enter the code from your email (6-8 digits).");
            return;
        }
        try {
            setVerifyingOtp(true);
            const supabase = getSupabaseBrowser();
            const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
                email: addr,
                token,
                type: "email",
            });
            if (verifyErr || !verifyData.session?.access_token) {
                setError(verifyErr?.message || "Invalid or expired code.");
                return;
            }
            const res = await fetch("/api/auth/supabase-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: mode,
                    accessToken: verifyData.session.access_token,
                    phoneLast10: normalizedEmailOtpPhone,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(typeof json?.error === "string" ? json.error : "Unable to complete sign-in.");
                return;
            }
            await supabase.auth.signOut().catch(() => { });
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next || json.redirect_to || "/");
            router.refresh();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Unable to verify code.");
        }
        finally {
            setVerifyingOtp(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (method === "email_otp") {
            await submitEmailOtpLogin();
            return;
        }
        setLoading(true);
        setError(null);

        try {
            if (!isValidEmail(email.trim())) {
                throw new Error("Enter a valid email address.");
            }
            if (password.trim().length < 6) {
                throw new Error("Password must be at least 6 characters.");
            }
            if (mode === "register" && password !== confirmPassword) {
                throw new Error("Passwords do not match.");
            }
            if (mode === "register" && normalizedRegisterPhone.length !== 10) {
                throw new Error("Enter a valid PH mobile number for your account (e.g., 09171234567).");
            }

            const loginBody: Record<string, string> = {
                action: mode,
                method: "email",
                email: email.trim().toLowerCase(),
                password: password.trim(),
                phone: "",
                otp: "",
            };
            if (mode === "register") {
                loginBody.registration_phone = normalizedRegisterPhone;
            }
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loginBody),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || (mode === "register" ? "Registration failed" : "Login failed"));
            }
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next || data.redirect_to || "/");
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : mode === "register" ? "Unable to register right now." : "Unable to login right now.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex min-h-0 flex-1 items-stretch justify-center overflow-y-auto px-3 py-4 sm:items-center sm:px-5 sm:py-6 lg:py-8 ${isDark ? "bg-[#0a0a0f]" : "bg-[#f5f1e4]"}`}>
            <div className="w-full max-w-5xl space-y-4">
                <Card className={`overflow-hidden rounded-[1.25rem] shadow-2xl sm:rounded-[1.75rem] lg:rounded-[2rem] ${isDark ? "bg-[#121318] border-white/10" : "bg-[#fffbea] border-[#e8e1cf]"}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.35fr] lg:items-stretch">
                        <div className={`order-1 w-full max-w-xl mx-auto lg:max-w-none lg:mx-0 p-5 sm:p-7 lg:p-8 ${isDark ? "bg-[#13141a]" : "bg-[#fffdf4]"}`}>
                            <CardHeader className="px-0 pt-0 pb-5 sm:pb-6">
                                <div className="flex items-center justify-center mb-3">
                                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-[#f0ebdc]"}`}>
                                        <ShieldCheck className={`h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5 ${isDark ? "text-indigo-400" : "text-[#504d44]"}`} />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <CardTitle className={`text-2xl sm:text-3xl leading-tight ${isDark ? "text-white" : "text-[#2e2b27]"}`}>
                                        {mode === "register" ? "Create an account" : "Welcome back"}
                                    </CardTitle>
                                </div>
                                <CardDescription className={`text-center text-xs sm:text-sm mt-1 px-1 ${isDark ? "text-white/60" : "text-[#70695c]"}`}>
                                    {method === "email_otp"
                                        ? (mode === "register" ? "Register with mobile + email code" : "Sign in with mobile + email code")
                                        : (mode === "register" ? "Sign up with email and password" : "Sign in with your email and password")}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="px-0 pb-0">
                                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl p-1 bg-black/5 dark:bg-white/5">
                                    <button
                                        type="button"
                                        className={`h-10 rounded-lg text-sm font-medium ${method === "password" ? "bg-white dark:bg-white/10 shadow" : "opacity-80"}`}
                                        onClick={() => {
                                            setMethod("password");
                                            setError(null);
                                            setOtp("");
                                            setOtpSent(false);
                                            setEmailOtpPhone("");
                                            setOtpEmail("");
                                        }}
                                    >
                                        Password
                                    </button>
                                    <button
                                        type="button"
                                        className={`h-10 rounded-lg text-sm font-medium ${method === "email_otp" ? "bg-white dark:bg-white/10 shadow" : "opacity-80"}`}
                                        onClick={() => {
                                            setMethod("email_otp");
                                            setError(null);
                                            setOtp("");
                                            setOtpSent(false);
                                            setOtpEmail("");
                                        }}
                                    >
                                        Email OTP
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                                    {method === "password" && (
                                        <div className="space-y-1.5">
                                            <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Email</label>
                                            <div className="relative">
                                                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={`h-12 rounded-full pl-11 pr-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} type="email" />
                                            </div>
                                        </div>
                                    )}
                                    {method === "email_otp" && (
                                        <div className="space-y-1.5">
                                            <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Mobile number (PH)</label>
                                            <div className="relative">
                                                <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                <Input value={emailOtpPhone} onChange={(e) => setEmailOtpPhone(e.target.value)} placeholder="09171234567" autoComplete="tel" className={`h-12 rounded-full pl-11 pr-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} />
                                            </div>
                                        </div>
                                    )}
                                    {method === "password" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Password</label>
                                                <div className="relative">
                                                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                    <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Enter password" autoComplete={mode === "register" ? "new-password" : "current-password"} className={`h-12 rounded-full pl-11 pr-12 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-[#7a756a] hover:text-[#4d4941] hover:bg-[#f3efdf]"}`}>
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            {mode === "register" && (
                                                <>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Confirm Password</label>
                                                        <div className="relative">
                                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" autoComplete="new-password" className={`h-12 rounded-full pl-11 pr-12 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} />
                                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-[#7a756a] hover:text-[#4d4941] hover:bg-[#f3efdf]"}`}>
                                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Mobile number (PH)</label>
                                                        <div className="relative">
                                                            <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                            <Input value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} placeholder="09171234567" autoComplete="tel" className={`h-12 rounded-full pl-11 pr-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} />
                                                        </div>
                                                        <p className={`text-[11px] ${isDark ? "text-white/40" : "text-[#8a8377]"}`}>Saved to your profile for SMS and contact. Must be unique.</p>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}

                                    {method === "email_otp" && (
                                        <>
                                            {!otpSent ? (
                                                <Button
                                                    type="button"
                                                    onClick={sendEmailOtp}
                                                    disabled={sendingOtp || normalizedEmailOtpPhone.length !== 10}
                                                    className={`w-full h-12 rounded-full font-semibold text-base ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                                >
                                                    {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
                                                </Button>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Enter code from email</label>
                                                    <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-8 digits" inputMode="numeric" autoComplete="one-time-code" className={`h-12 rounded-full px-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`} />
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {error && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className={`w-full h-12 rounded-full font-semibold text-base ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                        disabled={
                                            method === "password"
                                                ? (loading || !email.trim() || !password.trim() || (mode === "register" && (!confirmPassword.trim() || normalizedRegisterPhone.length !== 10)))
                                                : (verifyingOtp || !otpSent || normalizedEmailOtpPhone.length !== 10 || !/^\d{6,8}$/.test(otp.trim().replace(/\s/g, "")))
                                        }
                                    >
                                        {method === "password"
                                            ? (loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "register" ? "Create Account" : "Sign In")
                                            : (verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "register" ? "Verify code & Register" : "Verify code & Sign In")}
                                    </Button>

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[11px] pt-1 text-center sm:text-left">
                                        <p className={isDark ? "text-white/40" : "text-[#7b7468]"}>
                                            {mode === "register" ? "Have an account?" : "No account yet?"}{" "}
                                            <button type="button" onClick={() => {
                                                const nextMode = mode === "register" ? "login" : "register";
                                                setMode(nextMode);
                                                setError(null);
                                                if (method === "email_otp") {
                                                    setOtp("");
                                                    setOtpSent(false);
                                                    setEmailOtpPhone("");
                                                    setOtpEmail("");
                                                }
                                            }} className={`underline underline-offset-2 ${isDark ? "text-white/70" : "text-[#4e4a42]"}`}>
                                                {mode === "register" ? "Sign in" : "Register"}
                                            </button>
                                        </p>
                                        <span className={`sm:shrink-0 ${isDark ? "text-white/35" : "text-[#8a8377]"}`}>Terms & Conditions</span>
                                    </div>
                                </form>
                            </CardContent>
                        </div>
                        <div
                            className="order-2 relative min-h-[200px] sm:min-h-[240px] md:min-h-[280px] lg:min-h-[min(520px,70vh)] xl:min-h-[620px]"
                            style={{
                                backgroundImage:
                                    "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url('https://images.unsplash.com/photo-1768199455274-16a9e15946f5?q=80&w=1600&auto=format&fit=crop')",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" aria-hidden />
                            <div className="absolute top-3 left-3 sm:top-5 sm:left-5 lg:top-6 lg:left-6 max-w-[min(100%-1.5rem,20rem)]">
                                <span className="inline-flex items-center rounded-full bg-[#ffe16a] px-3 py-1.5 sm:px-4 sm:py-2 text-[0.6875rem] sm:text-xs font-semibold text-[#2f2a20] shadow leading-snug">
                                    Barangay & community life
                                </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 lg:bottom-6 lg:left-6 lg:right-6">
                                <div className="rounded-xl sm:rounded-2xl bg-white/90 backdrop-blur px-3 py-2.5 sm:px-4 sm:py-3 shadow-lg">
                                    <p className="text-[11px] sm:text-xs font-semibold text-[#2f2a20] leading-snug">Reports from the barangay reach staff faster when neighbors speak up.</p>
                                    <p className="text-[10px] sm:text-[11px] text-[#5e5649] mt-1">SpeakUp Payatas — barangay-first reporting</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
                <EmergencyReminder compact />
            </div>
        </div>
    );
}
