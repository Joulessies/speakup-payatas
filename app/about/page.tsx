import Image from "next/image";
import { Shield, Eye, Users, Smartphone, Database, Lock, CheckCircle, Target, Star } from "lucide-react";

export const metadata = {
    title: "About Us — SpeakUp Payatas",
    description: "Learn about SpeakUp Payatas — an anonymous community reporting platform for Barangay Payatas-A.",
};

export default function AboutPage() {
    return (
        <div className="flex flex-col h-full overflow-y-auto bg-gray-50 dark:bg-[#0a0a0f]">
            <div className="max-w-4xl mx-auto w-full px-4 py-8 md:px-8 md:py-12 space-y-10">

                {/* Hero Image */}
                <div className="relative w-full h-56 md:h-72 rounded-3xl overflow-hidden shadow-2xl">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage:
                                "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1544984243-ec57ea16fe25?q=80&w=1600&auto=format&fit=crop')",
                        }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
                            <Shield className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Welcome to SpeakUp</h1>
                        <p className="text-white/80 text-sm mt-2 max-w-md">Barangay Payatas-A's anonymous community reporting platform</p>
                    </div>
                </div>

                {/* About section */}
                <div className="space-y-6">
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            <Star className="h-3.5 w-3.5" />
                            About the Platform
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Empowering Communities Through Anonymous Reporting
                        </h2>
                    </div>

                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-white/65 space-y-4 leading-relaxed text-sm md:text-base">
                        <p>
                            <strong className="text-gray-800 dark:text-white/90">SPEAKUP</strong> is an algorithm-based anonymous reporting platform developed to give residents of Barangay Payatas-A a safe, convenient, and reliable way to report community concerns. The system was built to strengthen communication between residents and barangay officials while protecting the privacy and anonymity of every user.
                        </p>
                        <p>
                            SPEAKUP addresses common community issues — noise disturbances, sanitation problems, public safety concerns, street obstructions, and other barangay-related complaints — through a digital and accessible reporting platform. By enabling anonymous submissions, the system encourages community participation without fear of judgment, exposure, or retaliation.
                        </p>
                        <p>
                            Through organized data handling and automated categorization, SPEAKUP promotes transparency, accountability, and faster communication within the community. This system was developed as part of an academic research and system development project focused on enhancing community engagement and improving local governance through digital innovation.
                        </p>
                    </div>
                </div>

                {/* Mission & Vision */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-6 rounded-2xl border bg-white dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.08] space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/15">
                                <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mission</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-white/65 leading-relaxed">
                            To provide a secure and user-friendly anonymous reporting platform that empowers residents to voice community concerns responsibly and efficiently.
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl border bg-white dark:bg-white/[0.03] border-gray-100 dark:border-white/[0.08] space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/15">
                                <Eye className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vision</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-white/65 leading-relaxed">
                            To become a trusted digital platform that promotes safer, more responsive, and more connected communities through transparent and accessible reporting systems.
                        </p>
                    </div>
                </div>

                {/* Core Features */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Core Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { icon: Lock, label: "Anonymous Community Issue Reporting", desc: "Submit reports without revealing your identity. Your privacy is always protected.", color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
                            { icon: Database, label: "Organized Complaint Management", desc: "AI-assisted categorization ensures reports reach the right department efficiently.", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
                            { icon: CheckCircle, label: "Real-Time Report Monitoring", desc: "Track the status of your reports from submission to resolution in real time.", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                            { icon: Shield, label: "Secure User Data Handling", desc: "All data is encrypted and processed with strict privacy controls.", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" },
                            { icon: Smartphone, label: "Accessible & User-Friendly Interface", desc: "Designed for all residents, including those with limited tech experience.", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
                            { icon: Users, label: "Community Transparency Board", desc: "See how resolved reports contribute to a safer and better barangay.", color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
                        ].map((f) => (
                            <div key={f.label} className={`flex flex-col gap-3 p-5 rounded-2xl border bg-white dark:bg-white/[0.02] border-gray-100 dark:border-white/[0.08] hover:shadow-sm transition-shadow`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.bg}`}>
                                    <f.icon className={`h-5 w-5 ${f.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{f.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-white/50 mt-1 leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Developed by */}
                <div className="p-6 rounded-2xl border bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/[0.07] dark:to-purple-500/[0.05] border-indigo-100 dark:border-indigo-500/20 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">About the Developers</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/65 leading-relaxed max-w-2xl mx-auto">
                        SPEAKUP was developed by the researchers and developers of the SPEAKUP system for Barangay Payatas-A community enhancement and accountability support — as part of an academic research and system development initiative focused on digital governance and community empowerment.
                    </p>
                </div>
            </div>
        </div>
    );
}
