"use client";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer, ShieldCheck, MapPin, Lock, WifiOff, MapPin as PinIcon } from "lucide-react";

export default function QRPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [url, setUrl] = useState("https://speakupayatas.com");

    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1e1b4b`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#0d1b2e]" : "bg-[#f0f4f8]"} print:bg-white`}>
            <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:py-12 print:p-0 print:max-w-none">
                
                {/* Control Panel */}
                <div className="print:hidden mb-8 max-w-md mx-auto">
                    <h1 className={`text-xl md:text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                        QR Code Poster
                    </h1>
                    <p className={`text-xs md:text-sm mb-6 leading-relaxed ${isDark ? "text-white/50" : "text-[#4a6080]"}`}>
                        Generate printable QR posters for posting around Payatas. Residents can scan to report incidents.
                    </p>

                    <div className={`space-y-3 p-4 rounded-xl border shadow-sm ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                        <label className={`block text-[10px] uppercase tracking-widest font-bold ${isDark ? "text-white/35" : "text-[#4a6080]"}`}>
                            App URL Redirect
                        </label>
                        <div className="flex gap-2">
                            <Input 
                                value={url} 
                                onChange={(e) => setUrl(e.target.value)} 
                                placeholder="App URL" 
                                className={`font-mono text-xs ${isDark ? "bg-white/[0.06] border-white/10 text-white" : "border-[#c8d6e8] text-[#0f1f3d]"}`}
                            />
                            <Button onClick={handlePrint} className={`shrink-0 gap-2 text-white ${isDark ? "bg-blue-600 hover:bg-blue-700" : "bg-[#1a4fad] hover:bg-[#1544a0]"}`}>
                                <Printer className="h-4 w-4"/>
                                Print
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Printable Poster Card */}
                <div className="mx-auto max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-[#c8d6e8] print:border-none print:shadow-none print:rounded-none print:max-w-full print:w-full print:h-screen print:m-0 flex flex-col justify-between" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                    
                    {/* Header Banner */}
                    <div className="bg-[#0f1f3d] px-8 py-6 text-center">
                        <div className="flex items-center justify-center gap-2.5 mb-1">
                            <ShieldCheck className="h-7 w-7 text-blue-300"/>
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                SpeakUp Payatas
                            </h2>
                        </div>
                        <p className="text-blue-200/70 text-[10px] tracking-widest uppercase font-semibold">
                            Anonymous Community Incident Reporting
                        </p>
                    </div>

                    {/* Content Section */}
                    <div className="px-8 py-8 text-center flex-grow flex flex-col justify-around">
                        <div className="space-y-2">
                            <p className="text-[#0f1f3d] text-base font-bold leading-snug">
                                Scan this QR code to report an incident anonymously.
                            </p>
                            <p className="text-[#4a6080] text-xs md:text-sm font-medium italic">
                                I-scan ang QR code na ito para mag-ulat ng insidente nang hindi nagpapakilala.
                            </p>
                        </div>

                        {/* QR Code Container */}
                        <div className="flex justify-center my-6">
                            <div className="p-4 bg-white rounded-xl border border-[#c8d6e8] shadow-sm inline-block">
                                <img src={qrSrc} alt="QR Code" className="w-52 h-52 md:w-60 md:h-60" crossOrigin="anonymous"/>
                            </div>
                        </div>

                        {/* Redirection Link */}
                        <div className="space-y-1 my-2">
                            <p className="text-[9px] uppercase tracking-widest font-bold text-[#4a6080]">Visit Platform Directly</p>
                            <p className="text-xs md:text-sm font-mono font-semibold text-[#0f1f3d] select-all">{url}</p>
                        </div>

                        {/* Styled Vector Features */}
                        <div className="flex justify-around gap-4 text-center my-6 max-w-sm mx-auto w-full">
                            {[
                                { icon: Lock, label: "Anonymous" },
                                { icon: WifiOff, label: "Works Offline" },
                                { icon: PinIcon, label: "GPS Location" },
                            ].map((f, i) => (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                    <div className="w-9 h-9 rounded-lg bg-[#e8f0fb] border border-[#c8d6e8] flex items-center justify-center text-[#1a4fad]">
                                        <f.icon className="h-4.5 w-4.5" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-[#4a6080] tracking-tight">{f.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer Affiliation */}
                        <div className="border-t border-[#c8d6e8] pt-4">
                            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4a6080]">
                                <MapPin className="h-3.5 w-3.5 text-red-500"/>
                                Barangay Payatas-A, Quezon City
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
