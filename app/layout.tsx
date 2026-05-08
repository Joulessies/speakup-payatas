import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import NavBar from "@/components/nav-bar";
import SidebarNav from "@/components/sidebar-nav";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken, type UserRole } from "@/lib/auth";

const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    title: "SpeakUp Payatas (D2) — Anonymous Community Reporting",
    description: "Report incidents anonymously in Payatas, Quezon City (District 2). Works offline. Your identity stays private.",
};

// Determine if role should use sidebar (all roles now use sidebar for consistency)
function shouldUseSidebar(role: UserRole | null): boolean {
    // All authenticated roles use sidebar navigation
    return role === "admin" || role === "staff" || role === "user";
}

export default async function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthToken(token);
    const isLoggedIn = Boolean(session);
    const role = session?.role || null;
    const useSidebar = shouldUseSidebar(role);

    return (
        <html lang="en" className={cn("h-full antialiased dark", instrumentSans.variable)} suppressHydrationWarning>
            <body className="h-dvh overflow-hidden flex flex-col md:flex-row font-sans">
                <ThemeProvider>
                    <LanguageProvider>
                        {isLoggedIn && useSidebar && <SidebarNav />}
                        {isLoggedIn && !useSidebar && <NavBar />}
                        <main className={`flex-1 min-h-0 overflow-hidden ${isLoggedIn ? "pb-14 md:pb-0" : "pb-0"}`}>
                            {children}
                        </main>
                        <Toaster richColors position="top-center" />
                    </LanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
