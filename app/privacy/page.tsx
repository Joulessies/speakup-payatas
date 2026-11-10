"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function PrivacyPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const heading = `text-base font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`;
    const text = `text-sm leading-relaxed ${isDark ? "text-white/70" : "text-[#4a6080]"}`;

    return (
        <div className={`min-h-full ${isDark ? "bg-[#04271e] text-white" : "bg-[#f4fbf7] text-[#064e3b]"}`}>
            <div className="max-w-3xl mx-auto px-4 py-12 md:px-8 md:py-16 space-y-8">
                <div className="space-y-3">
                    <div className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-md border ${isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-[#059669] bg-[#e6f4ea] border-emerald-200"}`}>
                        <Shield className="h-3.5 w-3.5" />
                        Privacy Policy
                    </div>
                    <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                        Privacy Policy
                    </h1>
                    <p className={`text-sm ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                        SpeakUp Payatas · Last updated November 10, 2026
                    </p>
                </div>

                <section className="space-y-3">
                    <h2 className={heading}>Who we are</h2>
                    <p className={text}>
                        SpeakUp Payatas is a community reporting system for residents and staff of Barangay Payatas, Quezon City. This policy explains what information the system collects, why it is collected, and who can see it. The public site is https://speakupayatas.com.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>Information we collect</h2>
                    <ul className={`list-disc pl-5 space-y-2 ${text}`}>
                        <li>Account details you give us: email address, Philippine mobile number, and a password if you create one.</li>
                        <li>Google account data, if you choose Continue with Google: your Google email address, name, and profile picture. We ask Google only for openid, email, and profile. We never receive your Google password.</li>
                        <li>One-time codes sent by text or email so you can sign in or reset a password.</li>
                        <li>Reports you submit: category, description, severity, the place of the concern (latitude and longitude), the time it was sent, and a photo if you attach one.</li>
                        <li>A one-way hash that ties a signed-in resident’s reports to that account, so the resident can track their own reports. The public report does not show the resident’s name, email, or mobile number.</li>
                        <li>Details a barangay staff member types while encoding a walk-in, call, or message: the complainant’s name, contact number, address, age, and gender, when the person provides them. Those details are for the barangay record. They are not published on the public map.</li>
                        <li>A session cookie that keeps you signed in on this browser.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>How we use it</h2>
                    <ul className={`list-disc pl-5 space-y-2 ${text}`}>
                        <li>To create your account, sign you in, and send login or password codes.</li>
                        <li>To show barangay staff the reports that need review, and to place concerns on the Payatas map.</li>
                        <li>To let a resident see the status of reports filed from their own account.</li>
                        <li>To group nearby reports into hotspots and to produce summary counts for the barangay.</li>
                        <li>To classify a report’s category from its description, so staff can sort incoming concerns.</li>
                    </ul>
                    <p className={text}>
                        Google user data is used only to sign you in and to identify your SpeakUp account. We do not use Google user data for advertising, and we do not sell it. We do not transfer it except to the providers that host this system and deliver sign-in messages, and only so those features can work.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>Who can see it</h2>
                    <p className={text}>
                        Barangay staff and administrators can open reports so they can verify and act on them. The public transparency page shows resolved concerns without the reporter’s name, email, phone number, or exact private identity. Staff-entered complainant details stay in the barangay record.
                    </p>
                    <p className={text}>
                        The system is hosted with these providers, who process data only to run the service: Supabase stores the database, Vercel hosts the website, Google provides sign-in and the map, Vonage sends text messages, and Brevo sends email. We do not sell personal information.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>How long we keep it</h2>
                    <p className={text}>
                        Account and report records stay while the account and the report are needed for barangay operations. Sign-in codes expire after a few minutes. You can delete your account from Account settings. Deleting the account removes the login record. A report already sent to the barangay may remain so staff can finish the concern, without your name on the public view.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className={heading}>Contact</h2>
                    <p className={text}>
                        Questions about this policy can be sent through the feedback page at https://speakupayatas.com/feedback, or to the Barangay Payatas office. The related terms are at https://speakupayatas.com/terms.
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
