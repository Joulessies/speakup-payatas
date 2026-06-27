"use client";
import { useState, useEffect } from "react";
import { Loader2, Star, MessageSquare, Send } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import { toast } from "sonner";

export default function FeedbackPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [rating, setRating] = useState<number>(0);
    const [hover, setHover] = useState<number>(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error("Please select a rating.");
            return;
        }
        setSubmitting(true);
        try {
            const hash = await generateReporterHash(getDeviceId());
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reporter_hash: hash, rating, comment }),
            });
            if (res.ok) {
                setSubmitted(true);
                toast.success("Thank you for your feedback!");
            } else {
                toast.error("Failed to submit feedback.");
            }
        } catch {
            toast.error("Network error.");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className={`flex flex-col h-full items-center justify-center p-6 ${isDark ? "bg-[#0d1b2e]" : "bg-[#f0f4f8]"}`}>
                <div className={`max-w-md w-full p-8 rounded-xl border text-center space-y-4 shadow-lg ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                        <Star className="h-8 w-8 fill-current" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>Thank You!</h2>
                    <p className={`text-sm ${isDark ? "text-white/60" : "text-[#4a6080]"}`}>
                        Your feedback helps us improve the SpeakUp Payatas platform.
                    </p>
                    <button
                        onClick={() => { setSubmitted(false); setRating(0); setComment(""); }}
                        className={`mt-4 text-sm font-semibold ${isDark ? "text-blue-400 hover:text-blue-300" : "text-[#1a4fad] hover:text-[#1544a0]"}`}
                    >
                        Submit another response
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full p-6 overflow-y-auto ${isDark ? "bg-[#0d1b2e]" : "bg-[#f0f4f8]"}`}>
            <div className={`max-w-md w-full mx-auto p-6 md:p-8 rounded-xl border shadow-lg ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDark ? "bg-blue-500/15 border-blue-500/20" : "bg-[#e8f0fb] border-[#c8d6e8]"}`}>
                        <MessageSquare className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`} />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                            Feedback
                        </h1>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                            Rate your experience with SpeakUp
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-3 text-center">
                        <label className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#1e3a6e]"}`}>
                            How would you rate the platform?
                        </label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHover(star)}
                                    onMouseLeave={() => setHover(0)}
                                    className={`p-2 transition-transform hover:scale-110 focus-visible:outline-none`}
                                >
                                    <Star className={`h-8 w-8 transition-colors ${
                                        star <= (hover || rating)
                                            ? "text-amber-400 fill-amber-400"
                                            : isDark ? "text-white/10" : "text-[#c8d6e8]"
                                    }`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${isDark ? "text-white/80" : "text-[#1e3a6e]"}`}>
                            Any comments or suggestions? (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us what you liked or what we can improve..."
                            className={`w-full h-32 p-3 text-sm rounded-lg resize-none border ${isDark ? "bg-white/[0.04] border-white/10 text-white placeholder:text-white/30" : "bg-white border-[#c8d6e8] text-[#0f1f3d] placeholder:text-[#4a6080]/60"}`}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || rating === 0}
                        className={`w-full flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all ${
                            rating > 0
                                ? isDark ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-[#1a4fad] text-white hover:bg-[#1544a0]"
                                : isDark ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#e4eaf4] text-[#4a6080] cursor-not-allowed"
                        }`}
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Submit Feedback
                    </button>
                </form>
            </div>
        </div>
    );
}
