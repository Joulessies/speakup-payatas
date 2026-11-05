"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const SIGNUP_URL = "/api/auth/google/signup";
const FAILED = "Couldn't create your account. Please try again.";

type GoogleSignupDialogProps = {
    isDark: boolean;
    onShowTerms: () => void;
    /** Must keep the same identity between renders, since loading the sign-up depends on it. */
    onClose: (message?: string) => void;
};

/** Shown after Google sign-in for an email with no account yet: collects the mobile number every sign-up requires. */
export default function GoogleSignupDialog({ isDark, onShowTerms, onClose }: GoogleSignupDialogProps) {
    const router = useRouter();
    const [email, setEmail] = useState<string | null>(null);
    const [phone, setPhone] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const phoneLast10 = phone.replace(/\D/g, "").slice(-10);

    useEffect(() => {
        let active = true;
        fetch(SIGNUP_URL)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!active) return;
                if (res.ok && typeof data.email === "string") setEmail(data.email);
                else onClose(data.error || "Your Google sign-up timed out. Continue with Google again.");
            })
            .catch(() => {
                if (active) onClose("Couldn't load your Google sign-up. Continue with Google again.");
            });
        return () => {
            active = false;
        };
    }, [onClose]);

    const cancel = () => {
        void fetch(SIGNUP_URL, { method: "DELETE" }).catch(() => undefined);
        onClose();
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(SIGNUP_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phoneLast10 }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.restart) {
                onClose(data.error);
                return;
            }
            if (!res.ok) throw new Error(data.error || FAILED);
            router.push(data.redirect_to || "/dashboard");
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : FAILED);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all animate-in fade-in duration-200">
            <Card role="dialog" aria-modal="true" aria-labelledby="google-signup-title" className={`w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border ${isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"}`}>
                <CardHeader className="pb-3 pt-6 px-6">
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <button
                            type="button"
                            suppressHydrationWarning
                            onClick={cancel}
                            className={`p-1.5 -ml-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/70 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
                            title="Back to Sign In"
                            aria-label="Back to Sign In"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <CardTitle id="google-signup-title" className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Finish creating your account
                        </CardTitle>
                    </div>
                    <CardDescription className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-gray-500"}`}>
                        {email ? (
                            <>
                                You&apos;re signing up with <span className={`font-semibold break-all ${isDark ? "text-white/85" : "text-gray-800"}`}>{email}</span>. Add your mobile number to finish.
                            </>
                        ) : (
                            "Loading your Google account…"
                        )}
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-6 pb-6 pt-2">
                    {email ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="google-signup-phone" className={`text-xs font-semibold ${isDark ? "text-white/75" : "text-gray-700"}`}>
                                    Mobile number (PH)
                                </label>
                                <div className="relative">
                                    <Smartphone className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/35" : "text-gray-400"}`} />
                                    <Input
                                        id="google-signup-phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="09171234567"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        autoFocus
                                        className={`h-12 rounded-xl pl-11 pr-4 ${isDark ? "bg-white/[0.04] border-white/10 focus-visible:border-emerald-500/50" : "bg-gray-50/50 border-gray-200 focus-visible:border-emerald-600"}`}
                                    />
                                </div>
                                <p className={`text-[11px] ${isDark ? "text-white/40" : "text-[#8a8377]"}`}>Saved to your profile for SMS and contact. Must be unique.</p>
                            </div>

                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="google-signup-terms"
                                    checked={agreedToTerms}
                                    onCheckedChange={(checked: boolean | "indeterminate") => setAgreedToTerms(checked === true)}
                                    className={`mt-0.5 ${isDark ? "border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" : ""}`}
                                />
                                <label htmlFor="google-signup-terms" className={`text-xs leading-relaxed cursor-pointer ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                    I agree to the{" "}
                                    <button
                                        type="button"
                                        onClick={onShowTerms}
                                        className={`underline underline-offset-2 font-medium ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-[#059669] hover:text-[#047857]"}`}
                                    >
                                        Terms & Conditions
                                    </button>
                                </label>
                            </div>

                            {error && (
                                <div role="alert" className={`text-xs px-3 py-2 rounded-xl border ${isDark ? "text-red-300 border-red-500/25 bg-red-500/10" : "text-red-700 border-red-200 bg-red-50"}`}>
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 rounded-lg font-semibold text-sm tracking-wide"
                                disabled={saving || phoneLast10.length !== 10 || !agreedToTerms}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                            </Button>
                        </form>
                    ) : (
                        <div className="flex justify-center py-6">
                            <Loader2 className={`h-5 w-5 animate-spin ${isDark ? "text-white/50" : "text-gray-400"}`} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
