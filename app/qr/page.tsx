"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, QrCode, Printer, ShieldCheck, MapPin } from "lucide-react";

export default function QRPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [url, setUrl] = useState("https://speakup-payatas.vercel.app");

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1e1b4b`;

  const handlePrint = () => window.print();

  return (
    <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:py-12">
        {/* Controls — hidden on print */}
        <div className="print:hidden mb-8">
          <h1 className={`text-xl md:text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            QR Code Poster
          </h1>
          <p className={`text-sm mb-6 ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Generate printable QR posters for posting around Payatas. Residents can scan to report incidents.
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="App URL"
              className={`font-mono text-sm ${isDark ? "bg-white/[0.06] border-white/10 text-white" : ""}`}
            />
            <Button onClick={handlePrint} className="shrink-0 gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Printable poster */}
        <div
          className="mx-auto max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-full"
          style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        >
          {/* Header band */}
          <div className="bg-[#1e1b4b] px-6 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShieldCheck className="h-6 w-6 text-indigo-300" />
              <h2 className="text-xl font-bold text-white tracking-tight">
                SpeakUp Payatas
              </h2>
            </div>
            <p className="text-indigo-200/60 text-xs">
              Anonymous Community Incident Reporting
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center">
            <p className="text-gray-700 text-sm font-medium mb-6">
              Scan this QR code to report an incident anonymously.
              <br />
              <span className="text-gray-400 text-xs">
                I-scan ang QR code na ito para mag-ulat ng insidente nang hindi nagpapakilala.
              </span>
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 inline-block">
                <img
                  src={qrSrc}
                  alt="QR Code"
                  className="w-48 h-48 md:w-56 md:h-56"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            <p className="text-[10px] font-mono text-gray-400 break-all mb-6">{url}</p>

            {/* Features row */}
            <div className="flex justify-center gap-6 text-center mb-6">
              {[
                { emoji: "🔒", label: "Anonymous" },
                { emoji: "📶", label: "Works Offline" },
                { emoji: "📍", label: "GPS Location" },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{f.emoji}</span>
                  <span className="text-[10px] font-medium text-gray-500">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 pt-4">
              <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3 w-3" />
                Barangay Payatas-A, Quezon City
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
