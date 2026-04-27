import type { Metadata } from "next";
import AdminDashboard from "@/components/admin-dashboard";
export const metadata: Metadata = {
    title: "Admin Heatmap — SpeakUp Payatas",
    description: "DBSCAN cluster visualization of reported incidents in Payatas.",
};
export default function AdminPage() {
    return <AdminDashboard />;
}
