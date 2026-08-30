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
type AuthMethod = "password" | "sms_otp" | "email_otp";
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
    const [maskedResetPhone, setMaskedResetPhone] = useState<string | null>(null);
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
    // Resend timers (in seconds; 0 = ready to resend)
    const [otpResendTimer, setOtpResendTimer] = useState(0);
    const [forgotResendTimer, setForgotResendTimer] = useState(0);

    const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
    const isValidPhoneInput = (value: string) => {
        const digits = value.replace(/\D/g, "");
        return digits.length === 10 || (digits.length === 11 && digits.startsWith("0")) || (digits.length === 12 && digits.startsWith("63"));
    };
    const isValidEmailOrPhone = (value: string) => {
        const trimmed = value.trim();
        if (mode === "register") return isValidEmail(trimmed);
        return isValidEmail(trimmed) || isValidPhoneInput(trimmed);
    };
    // Tailwind classes for invalid input fields (red border + soft ring).
    const errorRing = "border-red-500 ring-1 ring-red-500/30 focus-visible:ring-red-500/40";
    const inputClass = (hasError: boolean) => {
        const base = `h-11 rounded-lg pl-11 pr-4 ${isDark ? "bg-white/[0.04] border-white/[0.1]" : "bg-white border-[#c8d6e8]"}`;
        return hasError ? `${base} ${errorRing}` : base;
    };
    const inputClassPwd = (hasError: boolean) => {
        const base = `h-11 rounded-lg pl-11 pr-12 ${isDark ? "bg-white/[0.04] border-white/[0.1]" : "bg-white border-[#c8d6e8]"}`;
        return hasError ? `${base} ${errorRing}` : base;
    };
    // Live re-validation: as the user types, clear the corresponding error flag so the red highlight goes away.
    useEffect(() => {
        if (!submitAttempted) return;
        const normPhone = registerPhone.replace(/\D/g, "").slice(-10);
        const normOtpPhone = emailOtpPhone.replace(/\D/g, "").slice(-10);
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (next.email && isValidEmailOrPhone(email.trim())) delete next.email;
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

    useEffect(() => {
        if (mode === "register" || showForgotPassword) {
            const pwd = showForgotPassword ? newPassword : password;
            setPasswordValidation(validatePassword(pwd));
        } else {
            setPasswordValidation(null);
        }
    }, [password, newPassword, mode, showForgotPassword]);

    // Countdown timer for OTP resend
    useEffect(() => {
        if (otpResendTimer <= 0) return;
        const id = window.setInterval(() => setOtpResendTimer((t) => Math.max(0, t - 1)), 1000);
        return () => window.clearInterval(id);
    }, [otpResendTimer]);

    // Countdown timer for Forgot Password resend
    useEffect(() => {
        if (forgotResendTimer <= 0) return;
        const id = window.setInterval(() => setForgotResendTimer((t) => Math.max(0, t - 1)), 1000);
        return () => window.clearInterval(id);
    }, [forgotResendTimer]);
    const normalizedRegisterPhone = registerPhone.replace(/\D/g, "").slice(-10);
    const normalizedEmailOtpPhone = emailOtpPhone.replace(/\D/g, "").slice(-10);

    const sendSmsOtp = async () => {
        setError(null);
        const phone = normalizedEmailOtpPhone;
        if (phone.length !== 10) {
            setError("Enter a valid 10-digit PH mobile number (e.g., 09171234567).");
            return;
        }
        try {
            setSendingOtp(true);
            const res = await fetch("/api/auth/sms-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to send SMS OTP.");
            }
            setOtpSent(true);
            setOtpResendTimer(60);
            if (data.hint || data.mock_code) {
                setForgotHint(data.hint || `Dev mode: Mock OTP code is [ ${data.mock_code} ]`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to send SMS OTP.");
        } finally {
            setSendingOtp(false);
        }
    };

    const submitSmsOtpLogin = async () => {
        setError(null);
        const phone = normalizedEmailOtpPhone;
        if (phone.length !== 10) {
            setError("Enter a valid 10-digit PH mobile number (e.g., 09171234567).");
            return;
        }
        const token = otp.trim().replace(/\s/g, "");
        if (!/^\d{6}$/.test(token)) {
            setError("Enter the 6-digit code sent to your mobile number.");
            return;
        }
        try {
            setVerifyingOtp(true);
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method: "sms",
                    action: mode,
                    phone,
                    otp: token,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Invalid OTP code.");
            }
            const next = new URLSearchParams(window.location.search).get("next");
            router.push(next || data.redirect_to || "/dashboard");
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to verify code.");
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleForgotPasswordRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setError(null);

        try {
            const trimmed = forgotEmail.trim();
            if (!isValidEmail(trimmed) && !isValidPhoneInput(trimmed)) {
                throw new Error("Please enter a valid email address or 10-digit PH mobile number.");
            }

            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: trimmed }),
            });

            const data = await res.json();
            if (!res.ok && data.error) {
                throw new Error(data.error);
            }

            setForgotSuccess(data.message || "Reset code sent to your registered mobile number.");
            if (data.maskedPhone) {
                setMaskedResetPhone(data.maskedPhone);
            }
            if (data?.delivery?.mock) {
                setForgotHint(data.delivery.hint || `Dev mode: Mock OTP code is [ ${data.delivery?.mock_code} ]`);
            } else {
                setForgotHint(null);
            }
            setForgotStep("verify");
            setForgotResendTimer(60); // 60-second cooldown
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

        setForgotLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "verify",
                    identifier: forgotEmail.trim(),
                    token: resetToken,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Invalid reset code.");
            }

            setForgotStep("reset");
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid reset code.");
        } finally {
            setForgotLoading(false);
        }
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
                    identifier: forgotEmail.trim(),
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
        setMaskedResetPhone(null);
        if (forgotStep === "success" && forgotEmail) {
            setEmail(forgotEmail);
            setMethod("password");
        }
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
        if (method === "sms_otp" || method === "email_otp") {
            if (!otpSent) {
                await sendSmsOtp();
            } else {
                await submitSmsOtpLogin();
            }
            return;
        }
        setLoading(true);
        setError(null);

        // Collect every invalid field first so the form can highlight all of them at once.
        const nextErrors: typeof fieldErrors = {};
        if (!isValidEmailOrPhone(email.trim())) nextErrors.email = true;
        if (password.trim().length < 6) nextErrors.password = true;
        if (mode === "register") {
            const validation = validatePassword(password);
            if (!validation.isValid) nextErrors.password = true;
            if (!confirmPassword || password !== confirmPassword) nextErrors.confirmPassword = true;
            if (normalizedRegisterPhone.length !== 10) nextErrors.phone = true;
        }
        setFieldErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            setLoading(false);
            return;
        }

        try {
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
        <div className={`flex flex-col items-center justify-start min-h-full w-full px-3 py-4 sm:px-5 sm:py-6 lg:py-8 ${isDark ? "bg-[#04271e]" : "bg-[#f0fdf4]"}`}>
            <div className="w-full max-w-5xl space-y-4">
                <div className="flex justify-end">
                    <ThemeToggle className={isDark ? "bg-white/[0.04] hover:bg-white/10" : "bg-black/[0.04] hover:bg-black/10"} />
                </div>
                <Card className={`overflow-hidden rounded-xl shadow-lg sm:rounded-2xl ${isDark ? "bg-[#06382b] border-emerald-500/30" : "bg-white border-emerald-300"}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.35fr] lg:items-stretch">
                        <div className={`order-1 w-full max-w-xl mx-auto lg:max-w-none lg:mx-0 p-5 sm:p-7 lg:p-8 ${isDark ? "bg-[#04271e]" : "bg-white"}`}>
                            <CardHeader className="px-0 pt-0 pb-5 sm:pb-6">
                                <div className="flex items-center justify-center mb-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/payatas-logo.png" alt="Barangay Payatas Logo" className="w-16 h-16 object-contain drop-shadow-md" />
                                </div>
                                <div className="text-center">
                                    <CardTitle className={`text-2xl sm:text-3xl leading-tight font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                                        {mode === "register" ? "Create an account" : "Welcome back"}
                                    </CardTitle>
                                </div>
                                <CardDescription className={`text-center text-xs sm:text-sm mt-1 px-1 ${isDark ? "text-white/55" : "text-[#4a6080]"}`}>
                                    {method === "sms_otp"
                                        ? (mode === "register" ? "Register with mobile SMS code" : "Sign in with mobile SMS code")
                                        : (mode === "register" ? "Sign up with email and password" : "Sign in with your email and password")}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="px-0 pb-0">

                                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                                    {/* Login Method Switcher Tabs */}
                                    {mode === "login" && (
                                        <div className={`flex rounded-xl p-1 border mb-3 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-gray-100 border-gray-200"}`}>
                                            <button
                                                type="button"
                                                onClick={() => { setMethod("password"); setError(null); }}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${method === "password" ? (isDark ? "bg-emerald-600 text-white shadow" : "bg-white text-emerald-900 shadow") : (isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-800")}`}
                                            >
                                                Password Login
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setMethod("sms_otp"); setError(null); }}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${method === "sms_otp" ? (isDark ? "bg-emerald-600 text-white shadow" : "bg-white text-emerald-900 shadow") : (isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-800")}`}
                                            >
                                                Mobile OTP Login
                                            </button>
                                        </div>
                                    )}

                                    {method === "password" && (
                                        <>
                                            {/* Email or Mobile Number Field for Login / Email for Register */}
                                            <div className="space-y-1.5">
                                                <label className={`text-xs font-semibold ${fieldErrors.email ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>
                                                    Email address or mobile number
                                                </label>
                                                <div className="relative">
                                                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.email ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                    <Input
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        placeholder="you@example.com or 09171234567"
                                                        autoComplete="username"
                                                        aria-invalid={fieldErrors.email ? true : undefined}
                                                        className={inputClass(Boolean(fieldErrors.email))}
                                                        type="text"
                                                    />
                                                </div>
                                                {fieldErrors.email && (
                                                    <p className="text-[11px] text-red-500">
                                                        Enter a valid email address or 10-digit PH mobile number.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Registration Mobile Number Field */}
                                            {mode === "register" && (
                                                <div className="space-y-1.5">
                                                    <label className={`text-xs font-semibold ${fieldErrors.phone ? "text-red-500" : isDark ? "text-white/70" : "text-[#6b6558]"}`}>Mobile number (PH)</label>
                                                    <div className="relative">
                                                        <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${fieldErrors.phone ? "text-red-500" : isDark ? "text-white/35" : "text-[#8e8778]"}`} />
                                                        <Input
                                                            value={registerPhone}
                                                            onChange={(e) => setRegisterPhone(e.target.value)}
                                                            placeholder="09171234567"
                                                            autoComplete="tel"
                                                            aria-invalid={fieldErrors.phone ? true : undefined}
                                                            className={inputClass(Boolean(fieldErrors.phone))}
                                                        />
                                                    </div>
                                                    {fieldErrors.phone ? (
                                                        <p className="text-[11px] text-red-500">Enter a valid 10-digit PH mobile number (e.g., 09171234567).</p>
                                                    ) : (
                                                        <p className={`text-[11px] ${isDark ? "text-white/40" : "text-[#8a8377]"}`}>Saved to your profile for SMS and contact. Must be unique.</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Password Field */}
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

                                            {/* Confirm Password Field (Register mode only) */}
                                            {mode === "register" && (
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
                                            )}
                                        </>
                                    )}

                                    {method === "sms_otp" && (
                                        <>
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

                                            {otpSent && (
                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <label className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#6b6558]"}`}>Enter 6-digit SMS code</label>
                                                        <Input
                                                            value={otp}
                                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                            placeholder="000000"
                                                            inputMode="numeric"
                                                            autoComplete="one-time-code"
                                                            className={`h-12 rounded-lg px-4 font-mono tracking-[0.3em] text-center ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-[#e2dbc8]"}`}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                            {otpResendTimer > 0 ? `Resend in ${otpResendTimer}s` : "Didn't receive SMS?"}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            suppressHydrationWarning
                                                            onClick={sendSmsOtp}
                                                            disabled={otpResendTimer > 0 || sendingOtp}
                                                            className={`text-xs font-semibold underline underline-offset-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                                        >
                                                            {sendingOtp ? "Sending…" : "Resend SMS code"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {mode === "register" && method === "password" && passwordValidation && (
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
                                                        className={`h-1 flex-1 rounded-full ${i <= passwordValidation.score
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
                                                        className={`text-[11px] flex items-center gap-1.5 transition-colors ${rule.met
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
                                                className={`mt-0.5 ${isDark ? "border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" : ""}`}
                                            />
                                            <label htmlFor="agree-terms" className={`text-xs leading-relaxed cursor-pointer ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                                I agree to the{" "}
                                                <button
                                                    type="button"
                                                    suppressHydrationWarning
                                                    onClick={() => setShowTerms(true)}
                                                    className={`underline underline-offset-2 font-medium ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
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
                                                    className={isDark ? "border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" : ""}
                                                />
                                                <label htmlFor="remember" className={`text-xs cursor-pointer ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                                    Remember me
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                suppressHydrationWarning
                                                onClick={() => setShowForgotPassword(true)}
                                                className={`text-xs underline underline-offset-2 transition-colors ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
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
                                        className="w-full h-11 rounded-lg font-semibold text-sm tracking-wide"
                                        disabled={
                                            method === "password"
                                                ? (loading || !email.trim() || !password.trim() || (mode === "register" && (!confirmPassword.trim() || normalizedRegisterPhone.length !== 10 || !agreedToTerms)))
                                                : (!otpSent
                                                    ? (sendingOtp || normalizedEmailOtpPhone.length !== 10 || (mode === "register" && !agreedToTerms))
                                                    : (verifyingOtp || normalizedEmailOtpPhone.length !== 10 || otp.trim().length !== 6 || (mode === "register" && !agreedToTerms)))
                                        }
                                    >
                                        {method === "password"
                                            ? (loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "register" ? "Create Account" : "Sign In")
                                            : (!otpSent
                                                ? (sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Verification Code")
                                                : (verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "register" ? "Verify code & Register" : "Verify code & Sign In"))}
                                    </Button>

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[11px] pt-1 text-center sm:text-left">
                                        <p className={isDark ? "text-white/40" : "text-[#7b7468]"}>
                                            {mode === "register" ? "Have an account?" : "No account yet?"}{" "}
                                            <button type="button" suppressHydrationWarning onClick={() => {
                                                const nextMode = mode === "register" ? "login" : "register";
                                                setMode(nextMode);
                                                setError(null);
                                                if (nextMode === "register") {
                                                    setMethod("password");
                                                }
                                                if (method === "sms_otp" || method === "email_otp") {
                                                    setOtp("");
                                                    setOtpSent(false);
                                                    setEmailOtpPhone("");
                                                    setOtpEmail("");
                                                }
                                            }} className={`underline underline-offset-2 ${isDark ? "text-white/70" : "text-[#4e4a42]"}`}>
                                                {mode === "register" ? "Sign in" : "Register"}
                                            </button>
                                        </p>
                                        <button type="button" suppressHydrationWarning onClick={() => setShowTerms(true)} className={`sm:shrink-0 underline underline-offset-2 transition-colors ${isDark ? "text-white/35 hover:text-white/55" : "text-[#8a8377] hover:text-[#5e5649]"}`}>Terms & Conditions</button>
                                    </div>
                                </form>
                            </CardContent>
                        </div>
                        <div
                            className="order-2 relative min-h-[200px] sm:min-h-[240px] md:min-h-[280px] lg:min-h-[min(520px,70vh)] xl:min-h-[620px]"
                            style={{
                                backgroundImage: 'linear-gradient(rgba(13, 27, 46, 0.4), rgba(13, 27, 46, 0.8)), url("https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/860Roads_Payatas_Bagong_Silangan_Quezon_City_Landmarks_45.jpg/1280px-860Roads_Payatas_Bagong_Silangan_Quezon_City_Landmarks_45.jpg")',
                                backgroundSize: "cover",
                                backgroundPosition: "center"
                            }}
                        >
                            <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply" />
                            <div className="absolute top-3 left-3 sm:top-5 sm:left-5 lg:top-6 lg:left-6 max-w-[min(100%-1.5rem,20rem)]">
                                <span className="inline-flex items-center rounded-lg bg-blue-600/90 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 text-[0.6875rem] sm:text-xs font-bold text-white shadow leading-snug">
                                    Barangay Payatas-A
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all animate-in fade-in duration-200">
                    <Card className={`w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}>
                        {forgotStep !== "success" && (
                            <CardHeader className="pb-3 pt-6 px-6">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <button
                                        type="button"
                                        onClick={resetForgotPassword}
                                        className={`p-1.5 -ml-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/70 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
                                        title="Back to Sign In"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </button>
                                    <CardTitle className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                        {forgotStep === "request" && "Reset Your Password"}
                                        {forgotStep === "verify" && "Verify SMS Code"}
                                        {forgotStep === "reset" && "Create New Password"}
                                    </CardTitle>
                                </div>
                                <CardDescription className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-gray-500"}`}>
                                    {forgotStep === "request" && "Enter your registered email address or mobile number to receive a 6-digit verification code."}
                                    {forgotStep === "verify" && (maskedResetPhone ? `Enter the 6-digit code sent to ${maskedResetPhone}.` : "Enter the 6-digit code sent to your registered mobile number.")}
                                    {forgotStep === "reset" && "Please enter a strong new password that meets the security requirements below."}
                                </CardDescription>
                            </CardHeader>
                        )}

                        <CardContent className={forgotStep === "success" ? "p-8" : "px-6 pb-6 pt-2"}>
                            {forgotStep === "request" && (
                                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>
                                            Email address or Mobile number (PH)
                                        </label>
                                        <div className="relative">
                                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="you@example.com or 09171234567"
                                                type="text"
                                                autoFocus
                                                className={`h-12 rounded-xl pl-11 pr-4 ${isDark ? "bg-white/[0.04] border-white/10 focus-visible:border-emerald-500/50" : "bg-gray-50/50 border-gray-200 focus-visible:border-emerald-600"}`}
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-start gap-2 ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={forgotLoading || !forgotEmail.trim()}
                                        className="w-full h-11 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                                    >
                                        {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Code"}
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "verify" && (
                                <form onSubmit={handleVerifyResetToken} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>
                                            6-Digit Verification Code
                                        </label>
                                        <div className="relative">
                                            <KeyRound className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={resetToken}
                                                onChange={(e) => setResetToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                placeholder="000000"
                                                inputMode="numeric"
                                                maxLength={6}
                                                autoFocus
                                                className={`h-12 rounded-xl pl-11 pr-4 text-center font-mono text-base tracking-[0.35em] ${isDark ? "bg-white/[0.04] border-white/10 focus-visible:border-emerald-500/50" : "bg-gray-50/50 border-gray-200 focus-visible:border-emerald-600"}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Resend option with timer */}
                                    <div className="flex items-center justify-between pt-1">
                                        <span className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                            {forgotResendTimer > 0 ? `Resend available in ${forgotResendTimer}s` : "Didn't receive the SMS?"}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={forgotResendTimer > 0 || forgotLoading}
                                            onClick={handleForgotPasswordRequest}
                                            className={`text-xs font-semibold underline underline-offset-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                        >
                                            {forgotLoading ? "Sending…" : "Resend code"}
                                        </button>
                                    </div>

                                    {forgotSuccess && (
                                        <div className={`text-xs px-3.5 py-2.5 rounded-xl border ${isDark ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}>
                                            {forgotSuccess}
                                        </div>
                                    )}

                                    {forgotHint && (
                                        <div className={`text-[11px] px-3.5 py-2.5 rounded-xl border ${isDark ? "text-amber-300 border-amber-500/30 bg-amber-500/10" : "text-amber-800 border-amber-200 bg-amber-50"}`}>
                                            <span className="font-semibold">Dev note:</span> {forgotHint}
                                        </div>
                                    )}

                                    {error && (
                                        <div className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-start gap-2 ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={resetToken.length !== 6 || forgotLoading}
                                        className="w-full h-11 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                                    >
                                        {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Code"}
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "reset" && (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>New Password</label>
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                type={showNewPassword ? "text" : "password"}
                                                placeholder="Enter new strong password"
                                                autoFocus
                                                className={`h-11 rounded-xl pl-11 pr-12 ${isDark ? "bg-white/[0.04] border-white/10 focus-visible:border-emerald-500/50" : "bg-gray-50/50 border-gray-200 focus-visible:border-emerald-600"}`}
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
                                        <div className={`space-y-2.5 p-3.5 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/10" : "bg-gray-50 border-gray-200"}`}>
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
                                                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= passwordValidation.score
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
                                                        className={`text-[11px] flex items-center gap-1.5 ${rule.met
                                                            ? "text-emerald-500 font-medium"
                                                            : isDark ? "text-white/45" : "text-gray-500"
                                                            }`}
                                                    >
                                                        {rule.met ? (
                                                            <Check className="h-3.5 w-3.5 shrink-0" />
                                                        ) : (
                                                            <XIcon className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                                                        )}
                                                        <span>{rule.label}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>Confirm New Password</label>
                                        <div className="relative">
                                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                            <Input
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                type={showConfirmNewPassword ? "text" : "password"}
                                                placeholder="Re-type new password"
                                                className={`h-11 rounded-xl pl-11 pr-12 ${isDark ? "bg-white/[0.04] border-white/10 focus-visible:border-emerald-500/50" : "bg-gray-50/50 border-gray-200 focus-visible:border-emerald-600"}`}
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
                                        <div className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-start gap-2 ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={forgotLoading || !passwordValidation?.isValid || newPassword !== confirmNewPassword}
                                        className="w-full h-11 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                                    >
                                        {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                                    </Button>
                                </form>
                            )}

                            {forgotStep === "success" && (
                                <div className="py-3 text-center space-y-5 animate-in zoom-in-95 duration-200">
                                    <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-25" />
                                        <div className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-100 text-emerald-600 border border-emerald-200"}`}>
                                            <CheckCircle className="h-9 w-9" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                            Password Reset Complete
                                        </h3>
                                        <p className={`text-xs leading-relaxed max-w-xs mx-auto ${isDark ? "text-white/65" : "text-gray-600"}`}>
                                            Your password has been updated successfully. You can now sign in to your account with your new password.
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={resetForgotPassword}
                                        className="w-full h-11 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                                    >
                                        Sign In Now
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
