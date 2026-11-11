import type { Metadata } from "next";
import ConcernLog from "@/components/concern-log";

export const metadata: Metadata = {
    title: "Concern Log — SpeakUp Payatas",
    description: "Daily barangay log of concerns received by phone, text, Messenger, walk-in, or referral.",
};

export default function AdminLogPage() {
    return <ConcernLog />;
}
