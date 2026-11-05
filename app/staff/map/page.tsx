import type { Metadata } from "next";
import AdminDashboard from "@/components/admin-dashboard";

export const metadata: Metadata = {
    title: "Staff Hotspot Map — SpeakUp Payatas",
    description: "Full-screen DBSCAN cluster visualization of reported incidents in Payatas for barangay staff.",
};

export default function StaffMapPage() {
    return <AdminDashboard role="staff" />;
}

