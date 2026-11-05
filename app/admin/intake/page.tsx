import type { Metadata } from "next";
import IntakeReportForm from "@/components/intake-report-form";

export const metadata: Metadata = {
    title: "Encode Report — SpeakUp Payatas",
    description: "Log concerns residents sent by Messenger, text, phone call, walk-in, or referral.",
};

export default function AdminIntakePage() {
    return <IntakeReportForm queueHref="/admin/reports" />;
}
