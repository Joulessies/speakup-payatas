"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Mail, Lock, Eye, EyeOff, Smartphone, KeyRound, ArrowLeft, CheckCircle, AlertCircle, Check, X as XIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import EmergencyReminder from "@/components/emergency-reminder";
import ThemeToggle from "@/components/theme-toggle";
import TermsAndConditions from "@/components/terms-and-conditions";
import { getSupabaseBrowser } from "@/lib/supabase";
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthBg, type PasswordValidationResult } from "@/lib/password-validation";

type AuthMode = "login" | "register";
type AuthMethod = "password" | "email_otp";
type ForgotPasswordStep = "request" | "verify" | "reset" | "success";

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
    const [rememberMe, setRememberMe] = useState(false);
    
    // Forgot password state
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>("request");
    const [forgotEmail, setForgotEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
    const [forgotHint, setForgotHint] = useState<string | null>(null);
    const [passwordValidation, setPasswordValidation] = useState<PasswordValidationResult | null>(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    // Field-level error flags so the user can see exactly which input is invalid.
    const [fieldErrors, setFieldErrors] = useState<{
        email?: boolean;
        password?: boolean;
        confirmPassword?: boolean;
        phone?: boolean;
        emailOtpPhone?: boolean;
        otp?: boolean;
    }>({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

    const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
    // Tailwind classes for invalid input fields (red border + soft ring).
    const errorRing = "border-red-500 ring-1 ring-red-500/30 focus-visible:ring-red-500/40";
    const inputClass = (hasError: boolean) => {
        const base = `h-12 rounded-full pl-11 pr-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`;
        return hasError ? `${base} ${errorRing}` : base;
    };
    const inputClassPwd = (hasError: boolean) => {
        const base = `h-12 rounded-full pl-11 pr-12 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`;
        return hasError ? `${base} ${errorRing}` : base;
    };
    // Live re-validation: as the user types, clear the corresponding error flag so the red highlight goes away.
    useEffect(() => {
        if (!submitAttempted) return;
        const normPhone = registerPhone.replace(/\D/g, "").slice(-10);
        const normOtpPhone = emailOtpPhone.replace(/\D/g, "").slice(-10);
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (next.email && isValidEmail(email.trim())) delete next.email;
            if (next.password) {
                const ok = mode === "register" ? validatePassword(password).isValid : password.trim().length >= 6;
                if (ok) delete next.password;
            }
            if (next.confirmPassword && confirmPassword && password === confirmPassword) delete next.confirmPassword;
            if (next.phone && normPhone.length === 10) delete next.phone;
            if (next.emailOtpPhone && normOtpPhone.length === 10) delete next.emailOtpPhone;
            if (next.otp && /^\d{6,8}$/.test(otp.trim().replace(/\s/g, ""))) delete next.otp;
            return next;
        });
    }, [email, password, confirmPassword, registerPhone, emailOtpPhone, otp, mode, submitAttempted]);
    
    // Validate password in real-time during registration and password reset.
    // We always run it (even on empty strings) so the requirement checklist is visible up-front.
    useEffect(() => {
        if (mode === "register" || showForgotPassword) {
            const pwd = showForgotPassword ? newPassword : password;
            setPasswordValidation(validatePassword(pwd));
        } else {
            setPasswordValidation(null);
        }
    }, [password, newPassword, mode, showForgotPassword]);
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

    const handleForgotPasswordRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setError(null);
        
        try {
            if (!isValidEmail(forgotEmail)) {
                throw new Error("Please enter a valid email address.");
            }
            
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: forgotEmail }),
            });
            
            const data = await res.json();
            if (!res.ok && data.error) {
                throw new Error(data.error);
            }
            
            setForgotSuccess(data.message || "Reset code sent to your registered mobile number.");
            if (data?.delivery?.mock) {
                setForgotHint(data.delivery.hint || "SMS provider isn't configured — the code was only logged to the server console.");
            } else {
                setForgotHint(null);
            }
            setForgotStep("verify");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send reset code.");
        } finally {
            setForgotLoading(false);
        }
    };
    
    const handleVerifyResetToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(resetToken)) {
            setError("Please enter the 6-digit code from your SMS.");
            return;
        }
        setForgotStep("reset");
        setError(null);
    };
    
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setError(null);
        
        try {
            if (newPassword !== confirmNewPassword) {
                throw new Error("Passwords do not match.");
            }
            
            const validation = validatePassword(newPassword);
            if (!validation.isValid) {
                throw new Error(validation.errors[0] || "Password does not meet requirements.");
            }
            
            const res = await fetch("/api/auth/forgot-password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: forgotEmail,
                    token: resetToken,
                    newPassword,
                }),
            });
            
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to reset password.");
            }
            
            setForgotStep("success");
            setForgotSuccess(data.message);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to reset password.");
        } finally {
            setForgotLoading(false);
        }
    };
    
    const resetForgotPassword = () => {
        setShowForgotPassword(false);
        setForgotStep("request");
        setForgotEmail("");
        setResetToken("");
        setNewPassword("");
        setConfirmNewPassword("");
        setForgotSuccess(null);
        setForgotHint(null);
        setError(null);
        setPasswordValidation(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitAttempted(true);
        if (method === "email_otp") {
            await submitEmailOtpLogin();
            return;
        }
        setLoading(true);
        setError(null);

        // Collect every invalid field first so the form can highlight all of them at once.
        const nextErrors: typeof fieldErrors = {};
        if (!isValidEmail(email.trim())) nextErrors.email = true;
        if (password.trim().length < 6) nextErrors.password = true;
        if (mode === "register") {
            const validation = validatePassword(password);
            if (!validation.isValid) nextErrors.password = true;
            if (!confirmPassword || password !== confirmPassword) nextErrors.confirmPassword = true;
            if (normalizedRegisterPhone.length !== 10) nextErrors.phone = true;
        }
        setFieldErrors(nextErrors);

        try {
            if (nextErrors.email) {
                throw new Error("Enter a valid email address.");
            }
            if (nextErrors.password) {
                if (mode === "register") {
                    const validation = validatePassword(password);
                    throw new Error(validation.errors[0] || "Password does not meet requirements.");
                }
                throw new Error("Password must be at least 6 characters.");
            }
            if (mode === "register" && nextErrors.confirmPassword) {
                throw new Error("Passwords do not match.");
            }
            if (mode === "register" && nextErrors.phone) {
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
                body: JSON.stringify({
                    ...loginBody,
                    remember_me: rememberMe,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                // On invalid credentials, flag both email and password so the user knows where to fix.
                if (res.status === 401 || /invalid|incorrect|wrong|credential|password|email/i.test(String(data?.error ?? ""))) {
                    setFieldErrors({ email: true, password: true });
                }
                throw new Error(data?.error || (mode === "register" ? "Registration failed" : "Login failed"));
            }
            
            // Handle remember me - extend session if checked
            if (rememberMe && data.token) {
                localStorage.setItem("speakup_remember_me", "true");
            } else {
                localStorage.removeItem("speakup_remember_me");
            }
            
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next || data.redirect_to || "/dashboard");
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
                <div className="flex justify-end">
                    <ThemeToggle className={isDark ? "bg-white/[0.04] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/10"} />
                </div>
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
                                            <label className={`text-xs font-semibold ${fieldErrors.email ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Email</label>
                                            <div className="relative">
                                                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.email ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-invalid={fieldErrors.email ? true : undefined} className={inputClass(Boolean(fieldErrors.email))} type="email" />
                                            </div>
                                            {fieldErrors.email && (
                                                <p className="text-[11px] text-red-500">Enter a valid email address.</p>
                                            )}
                                        </div>
                                    )}
                                    {method === "email_otp" && (
                                        <div className="space-y-1.5">
                                            <label className={`text-xs font-semibold ${fieldErrors.emailOtpPhone ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Mobile number (PH)</label>
                                            <div className="relative">
                                                <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.emailOtpPhone ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                <Input value={emailOtpPhone} onChange={(e) => setEmailOtpPhone(e.target.value)} placeholder="09171234567" autoComplete="tel" aria-invalid={fieldErrors.emailOtpPhone ? true : undefined} className={inputClass(Boolean(fieldErrors.emailOtpPhone))} />
                                            </div>
                                            {fieldErrors.emailOtpPhone && (
                                                <p className="text-[11px] text-red-500">Enter a valid 10-digit PH mobile number.</p>
                                            )}
                                        </div>
                                    )}
                                    {method === "password" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className={`text-xs font-semibold ${fieldErrors.password ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Password</label>
                                                <div className="relative">
                                                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.password ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                    <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Enter password" autoComplete={mode === "register" ? "new-password" : "current-password"} aria-invalid={fieldErrors.password ? true : undefined} className={inputClassPwd(Boolean(fieldErrors.password))} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-[#7a756a] hover:text-[#4d4941] hover:bg-[#f3efdf]"}`}>
                                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                                {fieldErrors.password && (
                                                    <p className="text-[11px] text-red-500">
                                                        {mode === "register" ? "Password doesn't meet requirements." : "Password must be at least 6 characters."}
                                                    </p>
                                                )}
                                            </div>
                                            {mode === "register" && (
                                                <>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-xs font-semibold ${fieldErrors.confirmPassword ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Confirm Password</label>
                                                        <div className="relative">
                                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.confirmPassword ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" autoComplete="new-password" aria-invalid={fieldErrors.confirmPassword ? true : undefined} className={inputClassPwd(Boolean(fieldErrors.confirmPassword))} />
                                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-[#7a756a] hover:text-[#4d4941] hover:bg-[#f3efdf]"}`}>
                                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                            </button>
                                                        </div>
                                                        {fieldErrors.confirmPassword && (
                                                            <p className="text-[11px] text-red-500">Passwords do not match.</p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className={`text-xs font-semibold ${fieldErrors.phone ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Mobile number (PH)</label>
                                                        <div className="relative">
                                                            <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.phone ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                            <Input value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} placeholder="09171234567" autoComplete="tel" aria-invalid={fieldErrors.phone ? true : undefined} className={inputClass(Boolean(fieldErrors.phone))} />
                                                        </div>
                                                        {fieldErrors.phone ? (
                                                            <p className="text-[11px] text-red-500">Enter a valid 10-digit PH mobile number (e.g., 09171234567).</p>
                                                        ) : (
                                                            <p className={`text-[11px] ${isDark ? "text-white/40" : "text-[#8a8377]"}`}>Saved to your profile for SMS and contact. Must be unique.</p>
                                                        )}
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

                                    {mode === "register" && passwordValidation && (
                                        <div className={`space-y-2.5 p-3 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>Password requirements</span>
                                                <span className={`text-xs font-semibold capitalize ${getPasswordStrengthColor(passwordValidation.strength, isDark)}`}>
                                                    {passwordValidation.strength}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full ${
                                                            i <= passwordValidation.score
                                                                ? getPasswordStrengthBg(passwordValidation.strength)
                                                                : isDark ? "bg-white/10" : "bg-gray-200"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                                                {passwordValidation.rules.map((rule) => (
                                                    <li
                                                        key={rule.id}
                                                        className={`text-[11px] flex items-center gap-1.5 transition-colors ${
                                                            rule.met
                                                                ? "text-emerald-500"
                                                                : isDark ? "text-white/45" : "text-gray-500"
                                                        }`}
                                                    >
                                                        {rule.met ? (
                                                            <Check className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <XIcon className={`h-3.5 w-3.5 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                                                        )}
                                                        <span>{rule.label}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {passwordValidation.errors.some((e) => /common|weak|sequential|repeating/i.test(e)) && (
                                                <p className={`text-[11px] flex items-center gap-1.5 mt-1 ${isDark ? "text-amber-300" : "text-amber-600"}`}>
                                                    <AlertCircle className="h-3 w-3" />
                                                    {passwordValidation.errors.find((e) => /common|weak|sequential|repeating/i.test(e))}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {mode === "register" && (
                                        <div className="flex items-start gap-2">
                                            <Checkbox
                                                id="agree-terms"
                                                checked={agreedToTerms}
                                                onCheckedChange={(checked: boolean | "indeterminate") => setAgreedToTerms(checked === true)}
                                                className={`mt-0.5 ${isDark ? "border-white/30 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500" : ""}`}
                                            />
                                            <label htmlFor="agree-terms" className={`text-xs leading-relaxed cursor-pointer ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                                I agree to the{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTerms(true)}
                                                    className={`underline underline-offset-2 font-medium ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
                                                >
                                                    Terms & Conditions
                                                </button>
                                            </label>
                                        </div>
                                    )}

                                    {mode === "login" && method === "password" && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="remember"
                                                    checked={rememberMe}
                                                    onCheckedChange={(checked: boolean | "indeterminate") => setRememberMe(checked === true)}
                                                    className={isDark ? "border-white/30 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500" : ""}
                                                />
                                                <label htmlFor="remember" className={`text-xs cursor-pointer ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                                    Remember me
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowForgotPassword(true)}
                                                className={`text-xs underline underline-offset-2 transition-colors ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
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
                                                ? (loading || !email.trim() || !password.trim() || (mode === "register" && (!confirmPassword.trim() || normalizedRegisterPhone.length !== 10 || !agreedToTerms)))
                                                : (verifyingOtp || !otpSent || normalizedEmailOtpPhone.length !== 10 || !/^\d{6,8}$/.test(otp.trim().replace(/\s/g, "")) || (mode === "register" && !agreedToTerms))
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
                                        <button type="button" onClick={() => setShowTerms(true)} className={`sm:shrink-0 underline underline-offset-2 transition-colors ${isDark ? "text-white/35 hover:text-white/55" : "text-[#8a8377] hover:text-[#5e5649]"}`}>Terms & Conditions</button>
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

            <TermsAndConditions open={showTerms} onClose={() => setShowTerms(false)} />

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <Card className={`w-full max-w-md overflow-hidden ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    type="button"
                                    onClick={resetForgotPassword}
                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                                >
                                    <ArrowLeft className={`h-4 w-4 ${isDark ? "text-white/60" : "text-gray-600"}`} />
                                </button>
                                <CardTitle className={`text-lg ${isDark ? "text-white" : "text-gray-900"}`}>
                                    {forgotStep === "success" ? "Password Reset Complete" : "Reset Password"}
                                </CardTitle>
                            </div>
                            <CardDescription className={isDark ? "text-white/60" : "text-gray-500"}>
                                {forgotStep === "request" && "Enter your email to receive a reset code on your registered mobile number."}
                                {forgotStep === "verify" && "Enter the 6-digit code sent to your mobile number."}
                                {forgotStep === "reset" && "Create a new strong password for your account."}
                                {forgotStep === "success" && forgotSuccess}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {forgotStep === "request" && (
                                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Email address</label>
                                        <div className="relative">
                                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="you@example.com"
                                                type="email"
                                                className={`h-12 rounded-full pl-11 pr-4 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}
                                            />
                                        </div>
                                    </div>
                                    {error && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            {error}
                                        </div>
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={forgotLoading || !forgotEmail.trim()}
                                        className={`w-full h-12 rounded-full font-semibold ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                    >
                                        {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Code"}
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "verify" && (
                                <form onSubmit={handleVerifyResetToken} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Reset Code (6 digits)</label>
                                        <div className="relative">
                                            <KeyRound className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={resetToken}
                                                onChange={(e) => setResetToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                placeholder="000000"
                                                inputMode="numeric"
                                                className={`h-12 rounded-full pl-11 pr-4 text-center font-mono tracking-[0.3em] ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}
                                            />
                                        </div>
                                    </div>
                                    {forgotSuccess && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}>
                                            {forgotSuccess}
                                        </div>
                                    )}
                                    {forgotHint && (
                                        <div className={`text-[11px] px-3 py-2 rounded-xl border ${isDark ? "text-amber-300 border-amber-500/30 bg-amber-500/10" : "text-amber-800 border-amber-200 bg-amber-50"}`}>
                                            <span className="font-semibold">Dev note:</span> {forgotHint}
                                        </div>
                                    )}
                                    {error && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            {error}
                                        </div>
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={resetToken.length !== 6}
                                        className={`w-full h-12 rounded-full font-semibold ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                    >
                                        Verify Code
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "reset" && (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>New Password</label>
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                type={showNewPassword ? "text" : "password"}
                                                placeholder="Enter new password"
                                                className={`h-12 rounded-full pl-11 pr-12 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                            >
                                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {passwordValidation && (
                                        <div className={`space-y-2.5 p-3 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/10" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>Password requirements</span>
                                                <span className={`text-xs font-semibold capitalize ${getPasswordStrengthColor(passwordValidation.strength, isDark)}`}>
                                                    {passwordValidation.strength}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full ${
                                                            i <= passwordValidation.score
                                                                ? getPasswordStrengthBg(passwordValidation.strength)
                                                                : isDark ? "bg-white/10" : "bg-gray-200"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                                                {passwordValidation.rules.map((rule) => (
                                                    <li
                                                        key={rule.id}
                                                        className={`text-[11px] flex items-center gap-1.5 ${
                                                            rule.met
                                                                ? "text-emerald-500"
                                                                : isDark ? "text-white/45" : "text-gray-500"
                                                        }`}
                                                    >
                                                        {rule.met ? (
                                                            <Check className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <XIcon className={`h-3.5 w-3.5 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                                                        )}
                                                        <span>{rule.label}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>Confirm New Password</label>
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                type={showConfirmNewPassword ? "text" : "password"}
                                                placeholder="Confirm new password"
                                                className={`h-12 rounded-full pl-11 pr-12 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                            >
                                                {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            Passwords do not match
                                        </div>
                                    )}

                                    {error && (
                                        <div className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={forgotLoading || !passwordValidation?.isValid || newPassword !== confirmNewPassword}
                                        className={`w-full h-12 rounded-full font-semibold ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                    >
                                        {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "success" && (
                                <div className="space-y-4 text-center">
                                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                                        <CheckCircle className={`h-8 w-8 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                                    </div>
                                    <p className={`text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                        Your password has been reset successfully. You can now sign in with your new password.
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={resetForgotPassword}
                                        className={`w-full h-12 rounded-full font-semibold ${isDark ? "" : "bg-[#f5d75a] text-[#2b2b2b] hover:bg-[#f1ce43]"}`}
                                    >
                                        Back to Sign In
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
