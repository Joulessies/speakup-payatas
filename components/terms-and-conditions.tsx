"use client";

import { useEffect } from "react";
import { X, ScrollText } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface TermsAndConditionsProps {
    open: boolean;
    onClose: () => void;
}

export default function TermsAndConditions({ open, onClose }: TermsAndConditionsProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const sectionTitle = `text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`;
    const paragraph = `text-xs leading-relaxed mb-3 ${isDark ? "text-white/70" : "text-gray-600"}`;
    const listItem = `text-xs leading-relaxed ${isDark ? "text-white/70" : "text-gray-600"}`;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="terms-title"
                className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
                    isDark ? "bg-[#121318] border-white/10" : "bg-white border-gray-200"
                }`}
            >
                <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDark ? "border-white/[0.08]" : "border-gray-100"}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                            <ScrollText className={`h-4 w-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <h2 id="terms-title" className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            Terms & Conditions
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`p-1.5 rounded-lg ${isDark ? "text-white/50 hover:bg-white/[0.06]" : "text-gray-400 hover:bg-gray-100"}`}
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    <p className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                        Last updated: May 2026
                    </p>

                    <div>
                        <h3 className={sectionTitle}>1. Acceptance of Terms</h3>
                        <p className={paragraph}>
                            By creating an account or using SpeakUp Payatas, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the platform.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>2. Purpose of the Platform</h3>
                        <p className={paragraph}>
                            SpeakUp Payatas is an anonymous community reporting system designed for residents of Barangay Payatas, Quezon City (District 2). It allows users to report incidents, complaints, and concerns to barangay staff for review and resolution.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>3. User Accounts</h3>
                        <ul className="list-disc pl-4 space-y-1.5 mb-3">
                            <li className={listItem}>You must provide a valid email address and Philippine mobile number to register.</li>
                            <li className={listItem}>You are responsible for maintaining the confidentiality of your login credentials.</li>
                            <li className={listItem}>Each mobile number may only be linked to one account.</li>
                            <li className={listItem}>You may deactivate or delete your account at any time through Account Settings.</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>4. Anonymous Reporting</h3>
                        <p className={paragraph}>
                            Reports submitted through SpeakUp Payatas are designed to protect the identity of the reporter. Your personal information is not attached to the reports viewed by staff. However, your device generates a hash for tracking purposes only.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>5. Acceptable Use</h3>
                        <p className={paragraph}>You agree not to:</p>
                        <ul className="list-disc pl-4 space-y-1.5 mb-3">
                            <li className={listItem}>Submit false, misleading, or fabricated reports.</li>
                            <li className={listItem}>Use offensive, abusive, or discriminatory language in reports or feedback.</li>
                            <li className={listItem}>Attempt to identify other anonymous reporters.</li>
                            <li className={listItem}>Misuse the platform to harass individuals or disrupt barangay operations.</li>
                            <li className={listItem}>Upload inappropriate, illegal, or harmful content (including photos).</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>6. Content Moderation</h3>
                        <p className={paragraph}>
                            Submitted reports are subject to automated content moderation and manual review by barangay staff. Reports containing spam, offensive language, or duplicate content may be flagged or removed. The platform uses automated classification to categorize and prioritize reports.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>7. Feedback & Transparency</h3>
                        <p className={paragraph}>
                            Users may leave feedback on resolved reports. Feedback (ratings and comments) may be displayed publicly on the Transparency Board to promote accountability. By submitting feedback, you consent to its public display.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>8. Data & Privacy</h3>
                        <ul className="list-disc pl-4 space-y-1.5 mb-3">
                            <li className={listItem}>We collect only the information necessary to operate the platform (email, phone number, report content).</li>
                            <li className={listItem}>Your data is stored securely and is not sold to third parties.</li>
                            <li className={listItem}>Location data included in reports is used solely for mapping and prioritizing community issues.</li>
                            <li className={listItem}>You may request deletion of your data by deleting your account.</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>9. Limitation of Liability</h3>
                        <p className={paragraph}>
                            SpeakUp Payatas is provided &quot;as is.&quot; We do not guarantee uninterrupted service or that all reports will result in action. The platform serves as a communication tool between residents and barangay officials and does not replace emergency services. For emergencies, call the appropriate authorities.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>10. Changes to Terms</h3>
                        <p className={paragraph}>
                            We may update these Terms & Conditions from time to time. Continued use of the platform after changes constitutes acceptance of the revised terms. Users will be notified of significant changes.
                        </p>
                    </div>

                    <div>
                        <h3 className={sectionTitle}>11. Contact</h3>
                        <p className={paragraph}>
                            For questions or concerns about these terms, contact your local barangay office or reach out through the platform&apos;s feedback system.
                        </p>
                    </div>
                </div>

                <div className={`flex items-center justify-end px-5 py-4 border-t shrink-0 ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-gray-100 bg-gray-50"}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`px-5 h-9 rounded-lg text-sm font-semibold transition-colors ${
                            isDark
                                ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                    >
                        I understand
                    </button>
                </div>
            </div>
        </div>
    );
}
