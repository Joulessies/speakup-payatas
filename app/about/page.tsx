import {
  Shield,
  Eye,
  Users,
  Smartphone,
  Database,
  Lock,
  CheckCircle,
  Target,
  ArrowLeft,
  Info,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "About Us — SpeakUp Payatas",
  description:
    "Official institutional profile of the SpeakUp anonymous community reporting platform for Barangay Payatas-A.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-[#0a0a0f] text-slate-800 dark:text-slate-200">
      {/* Decorative top ambient blur blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none select-none" />

      {/* Hero Header Section */}
      <div className="relative border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0a0a0f] pt-16 pb-12 md:pt-32 md:pb-16">
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 space-y-4 relative z-10">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs tracking-wider uppercase bg-indigo-500/10 w-fit px-3 py-1 rounded-full border border-indigo-500/15">
            <Info className="h-3.5 w-3.5" />
            Platform Information & Profile
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight md:leading-tight text-slate-900 dark:text-white py-2">
            About SPEAKUP
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-zinc-400 max-w-3xl leading-relaxed">
            The official algorithm-based anonymous reporting platform developed
            for the residents of Barangay Payatas-A, built to support civic
            transparency and local governance.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 pt-10 pb-24 md:px-8 md:py-12 space-y-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Info */}
          <div className="lg:col-span-7 space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-500">
              Platform Overview
            </h2>

            <div className="text-sm md:text-base leading-relaxed text-slate-600 dark:text-zinc-300 space-y-5">
              <p>
                Welcome to{" "}
                <strong className="font-semibold text-slate-900 dark:text-white">
                  SPEAKUP
                </strong>
                , an algorithm-based anonymous reporting platform developed to
                provide residents of Barangay Payatas-A with a safe, convenient,
                and reliable way to report community concerns. The system was
                created to strengthen communication between residents and
                barangay officials while ensuring the privacy and anonymity of
                users.
              </p>
              <p>
                SPEAKUP aims to address common community issues such as noise
                disturbances, sanitation problems, public safety concerns,
                street obstructions, and other barangay-related complaints
                through a digital and accessible reporting platform. By allowing
                residents to submit reports anonymously, the system encourages
                community participation without fear of judgment, exposure, or
                retaliation.
              </p>
              <p>
                The platform is designed to improve the efficiency of issue
                reporting, monitoring, and response management through organized
                data handling and automated categorization features. Through
                technology-driven processes, SPEAKUP promotes transparency,
                accountability, and faster communication within the community.
              </p>
              <p>
                This system was developed as part of an academic research and
                system development project that focuses on enhancing community
                engagement and improving local governance through digital
                innovation.
              </p>
            </div>
          </div>

          {/* Quick Cards */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-indigo-500/20 group space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Mission
                </h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                To provide a secure and user-friendly anonymous reporting
                platform that empowers residents to voice community concerns
                responsibly and efficiently.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-emerald-500/20 group space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                  <Eye className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Vision
                </h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                To become a trusted digital platform that promotes safer, more
                responsive, and more connected communities through transparent
                and accessible reporting systems.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-indigo-500/20 group space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Developers
                </h3>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                Developed by the researchers and developers of the SPEAKUP
                system for Barangay Payatas-A community enhancement and
                accountability support.
              </p>
            </div>
          </div>
        </div>

        {/* System Features */}
        <div className="space-y-6 pt-8 border-t border-slate-200 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-500">
            Core System Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                label: "Anonymous community issue reporting",
                desc: "Empowers citizens to file detailed reports securely without sharing personal identifiers, ensuring complete privacy.",
              },
              {
                label: "Organized complaint management",
                desc: "Automated indexing and organization tools for barangay administrators to efficiently manage and delegate incoming reports.",
              },
              {
                label: "Real-time report monitoring",
                desc: "Provides tracking and direct status updates on submitted reports, increasing municipal accountability.",
              },
              {
                label: "Secure user data handling",
                desc: "Built with industry-standard cryptographic methods to secure transmission and prevent leaks or unauthorized access.",
              },
              {
                label: "Accessible and user-friendly interface",
                desc: "Crafted to be simple, fast, and light, facilitating usability for residents of all technological backgrounds.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex gap-4 p-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.01] backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 hover:border-indigo-500/10"
              >
                <div className="text-slate-400 dark:text-zinc-600 font-bold text-sm tracking-tight pt-0.5 select-none font-mono">
                  0{idx + 1}.
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.label}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Return Button */}
        <div className="flex justify-start pt-8 border-t border-slate-200 dark:border-white/[0.06]">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white/50 dark:bg-white/[0.02] rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
