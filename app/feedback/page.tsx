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
            <div className={`flex flex-col h-full items-center justify-center p-6 ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
                <div className={`max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                        <Star className="h-8 w-8 fill-current" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Thank You!</h2>
                    <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
                        Your feedback helps us improve the SpeakUp Payatas platform.
                    </p>
                    <button
                        onClick={() => { setSubmitted(false); setRating(0); setComment(""); }}
                        className="mt-4 text-sm font-medium text-indigo-500 hover:text-indigo-600"
                    >
                        Submit another response
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full p-6 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className={`max-w-md w-full mx-auto p-6 md:p-8 rounded-2xl border shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                        <MessageSquare className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Feedback
                        </h1>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Rate your experience with SpeakUp
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-3 text-center">
                        <label className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
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
                                            : isDark ? "text-white/10" : "text-gray-200"
                                    }`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
                            Any comments or suggestions? (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tell us what you liked or what we can improve..."
                            className={`w-full h-32 p-3 text-sm rounded-xl resize-none border ${isDark ? "bg-black/20 border-white/10 text-white placeholder:text-white/30" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"}`}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || rating === 0}
                        className={`w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all ${
                            rating > 0
                                ? "bg-indigo-500 text-white hover:bg-indigo-600"
                                : isDark ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
