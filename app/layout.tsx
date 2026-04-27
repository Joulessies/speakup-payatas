import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import NavBar from "@/components/nav-bar";
import { Toaster } from "sonner";
const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
});
export const metadata: Metadata = {
    title: "SpeakUp Payatas (D2) — Anonymous Community Reporting",
    description: "Report incidents anonymously in Payatas, Quezon City (District 2). Works offline. Your identity stays private.",
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en" className={cn("h-full antialiased dark", instrumentSans.variable)} suppressHydrationWarning>
      <body className="h-dvh overflow-hidden flex flex-col font-sans">
        <ThemeProvider>
          <LanguageProvider>
            <NavBar />
            <main className="flex flex-col flex-1 min-h-0 overflow-hidden pb-14 md:pb-0">
              {children}
            </main>
            <Toaster richColors position="top-center"/>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>);
}
