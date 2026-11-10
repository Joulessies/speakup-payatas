"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function TermsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const heading = `text-base font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`;
    const text = `text-sm leading-relaxed ${isDark ? "text-white/70" : "text-[#4a6080]"}`;

    return (
        <div className={`min-h-full ${isDark ? "bg-[#04271e] text-white" : "bg-[#f4fbf7] text-[#064e3b]"}`}>
            <div className="max-w-3xl mx-auto px-4 py-12 md:px-8 md:py-16 space-y-8">
                <div className="space-y-3">
                    <div className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-md border ${isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-[#059669] bg-[#e6f4ea] border-emerald-200"}`}>
                        <ScrollText className="h-3.5 w-3.5" />
                        Terms of Service
                    </div>
                    <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                        Terms of Service
                    </h1>
                    <p className={`text-sm ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                        SpeakUp Payatas · Last updated November 10, 2026
                    </p>
                </div>

                <section className="space-y-3">
                    <h2 className={heading}>1. Acceptance</h2>
                    <p className={text}>
                        By creating an account or using SpeakUp Payatas, you agree to these terms. If you do not agree, do not use the platform.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>2. Purpose</h2>
                    <p className={text}>
                        SpeakUp Payatas is a community reporting system for Barangay Payatas, Quezon City. Residents send concerns. Barangay staff review them. It is a way to reach the barangay. It does not replace emergency services. For an emergency, call the proper authorities.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>3. Accounts</h2>
                    <ul className={`list-disc pl-5 space-y-2 ${text}`}>
                        <li>You need a valid email address and a Philippine mobile number to register. Google sign-in still asks for a mobile number on a new account.</li>
                        <li>You are responsible for keeping your password private.</li>
                        <li>One mobile number belongs to one account.</li>
                        <li>You may delete your account from Account settings.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>4. Reports</h2>
                    <p className={text}>
                        A report filed by a resident does not show that resident’s name, email, or mobile number on the public page. Do not send false reports, harass anyone, or upload illegal or harmful photos. Staff may mark a report as spam, duplicate, or valid. The barangay does not promise that every report will be resolved.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>5. Privacy</h2>
                    <p className={text}>
                        How the system handles personal information is described in the privacy policy at https://speakupayatas.com/privacy.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>6. Contact</h2>
                    <p className={text}>
                        Questions about these terms can be sent through https://speakupayatas.com/feedback or to the Barangay Payatas office.
                    </p>
                </section>

                <div className={`pt-6 border-t ${isDark ? "border-white/[0.06]" : "border-[#c8d6e8]"}`}>
                    <Link href="/" className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 border rounded-lg ${isDark ? "border-white/[0.08] text-white/70 hover:bg-white/[0.06]" : "border-[#c8d6e8] bg-white text-[#1e3a6e]"}`}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}
