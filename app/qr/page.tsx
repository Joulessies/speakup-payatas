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
        <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"} print:bg-white`}>
            <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:py-12 print:p-0 print:max-w-none">
                
                {/* Control Panel */}
                <div className="print:hidden mb-8 max-w-md mx-auto">
                    <h1 className={`text-xl md:text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                        QR Code Poster
                    </h1>
                    <p className={`text-xs md:text-sm mb-6 leading-relaxed ${isDark ? "text-white/50" : "text-gray-500"}`}>
                        Generate printable QR posters for posting around Payatas. Residents can scan to report incidents.
                    </p>

                    <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
                            App URL Redirect
                        </label>
                        <div className="flex gap-2">
                            <Input 
                                value={url} 
                                onChange={(e) => setUrl(e.target.value)} 
                                placeholder="App URL" 
                                className={`font-mono text-xs ${isDark ? "bg-white/[0.06] border-white/10 text-white" : "border-slate-200 text-slate-900"}`}
                            />
                            <Button onClick={handlePrint} className="shrink-0 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Printer className="h-4 w-4"/>
                                Print
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Printable Poster Card */}
                <div className="mx-auto max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:border-none print:shadow-none print:rounded-none print:max-w-full print:w-full print:h-screen print:m-0 flex flex-col justify-between" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
                    
                    {/* Header Banner */}
                    <div className="bg-[#1e1b4b] px-8 py-6 text-center">
                        <div className="flex items-center justify-center gap-2.5 mb-1">
                            <ShieldCheck className="h-7 w-7 text-indigo-300"/>
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                SpeakUp Payatas
                            </h2>
                        </div>
                        <p className="text-indigo-200/70 text-[10px] tracking-widest uppercase font-semibold">
                            Anonymous Community Incident Reporting
                        </p>
                    </div>

                    {/* Content Section */}
                    <div className="px-8 py-8 text-center flex-grow flex flex-col justify-around">
                        <div className="space-y-2">
                            <p className="text-slate-800 text-base font-bold leading-snug">
                                Scan this QR code to report an incident anonymously.
                            </p>
                            <p className="text-slate-400 text-xs md:text-sm font-medium italic">
                                I-scan ang QR code na ito para mag-ulat ng insidente nang hindi nagpapakilala.
                            </p>
                        </div>

                        {/* QR Code Container */}
                        <div className="flex justify-center my-6">
                            <div className="p-4 bg-white rounded-2xl border border-slate-150 shadow-sm inline-block">
                                <img src={qrSrc} alt="QR Code" className="w-52 h-52 md:w-60 md:h-60" crossOrigin="anonymous"/>
                            </div>
                        </div>

                        {/* Redirection Link */}
                        <div className="space-y-1 my-2">
                            <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Visit Platform Directly</p>
                            <p className="text-xs md:text-sm font-mono font-semibold text-[#1e1b4b] select-all">{url}</p>
                        </div>

                        {/* Styled Vector Features */}
                        <div className="flex justify-around gap-4 text-center my-6 max-w-sm mx-auto w-full">
                            {[
                                { icon: Lock, label: "Anonymous" },
                                { icon: WifiOff, label: "Works Offline" },
                                { icon: PinIcon, label: "GPS Location" },
                            ].map((f, i) => (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                    <div className="w-9 h-9 rounded-full bg-[#1e1b4b]/5 flex items-center justify-center text-[#1e1b4b]">
                                        <f.icon className="h-4.5 w-4.5" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-600 tracking-tight">{f.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer Affiliation */}
                        <div className="border-t border-slate-100 pt-4">
                            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
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
