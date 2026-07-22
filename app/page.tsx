"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function HomePageRedirect() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) {
                    router.replace("/login");
                    return;
                }
                const session = await res.json();
                if (session?.role === "admin") {
                    router.replace("/admin/dashboard");
                } else if (session?.role === "staff") {
                    router.replace("/staff/dashboard");
                } else if (session?.role === "user") {
                    router.replace("/dashboard");
                } else {
                    router.replace("/login");
                }
            } catch {
                router.replace("/login");
            }
        })();
    }, [router]);

    return (
        <div className={`flex flex-col items-center justify-center w-full h-full min-h-screen ${isDark ? "bg-[#04271e]" : "bg-white"}`}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className={`text-sm ${isDark ? "text-white/80" : "text-[#064e3b]"}`}>Loading SpeakUp Payatas...</p>
            </div>
        </div>
    );
}
