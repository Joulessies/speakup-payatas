"use client";
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
import { useTheme } from "@/components/theme-provider";

export default function AboutPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`flex flex-col h-screen overflow-y-auto ${isDark ? "bg-[#0d1b2e] text-white" : "bg-[#f0f4f8] text-[#0f1f3d]"}`}>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none select-none" />
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none select-none" />

      {/* Hero Header Section */}
      <div className={`relative border-b ${isDark ? "border-white/[0.06] bg-[#0d1b2e]" : "border-[#c8d6e8] bg-white"} pt-16 pb-12 md:pt-32 md:pb-16`}>
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 space-y-4 relative z-10">
          <div className={`flex items-center gap-2 font-semibold text-xs tracking-wider uppercase w-fit px-3 py-1 rounded-md border ${isDark ? "text-blue-400 bg-blue-500/10 border-blue-500/15" : "text-[#1a4fad] bg-[#e8f0fb] border-[#c8d6e8]"}`}>
            <Info className="h-3.5 w-3.5" />
            Platform Information &amp; Profile
          </div>
          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight leading-tight md:leading-tight py-2 ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
            About SPEAKUP
          </h1>
          <p className={`text-sm md:text-base max-w-3xl leading-relaxed ${isDark ? "text-white/50" : "text-[#4a6080]"}`}>
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
            <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`}>
              Platform Overview
            </h2>

            <div className={`text-sm md:text-base leading-relaxed space-y-5 ${isDark ? "text-white/65" : "text-[#4a6080]"}`}>
              <p>
                Welcome to{" "}
                <strong className={`font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
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
            {/* Mission */}
            <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 group space-y-3 ${isDark ? "bg-[#112240] border-white/[0.07] hover:border-blue-500/20" : "bg-white border-[#c8d6e8] hover:border-[#1a4fad]/30 hover:shadow-md"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border group-hover:scale-110 transition-transform duration-300 ${isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-[#e8f0fb] border-[#c8d6e8] text-[#1a4fad]"}`}>
                  <Target className="h-5 w-5" />
                </div>
                <h3 className={`font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                  Mission
                </h3>
              </div>
              <p className={`text-xs md:text-sm leading-relaxed ${isDark ? "text-white/55" : "text-[#4a6080]"}`}>
                To provide a secure and user-friendly anonymous reporting
                platform that empowers residents to voice community concerns
                responsibly and efficiently.
              </p>
            </div>

            {/* Vision */}
            <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 group space-y-3 ${isDark ? "bg-[#112240] border-white/[0.07] hover:border-emerald-500/20" : "bg-white border-[#c8d6e8] hover:border-emerald-500/30 hover:shadow-md"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border group-hover:scale-110 transition-transform duration-300 ${isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200/60 text-emerald-600"}`}>
                  <Eye className="h-5 w-5" />
                </div>
                <h3 className={`font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                  Vision
                </h3>
              </div>
              <p className={`text-xs md:text-sm leading-relaxed ${isDark ? "text-white/55" : "text-[#4a6080]"}`}>
                To become a trusted digital platform that promotes safer, more
                responsive, and more connected communities through transparent
                and accessible reporting systems.
              </p>
            </div>

            {/* Developers */}
            <div className={`p-6 rounded-xl border shadow-sm transition-all duration-300 group space-y-3 ${isDark ? "bg-[#112240] border-white/[0.07] hover:border-blue-500/20" : "bg-white border-[#c8d6e8] hover:border-[#1a4fad]/30 hover:shadow-md"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg border group-hover:scale-110 transition-transform duration-300 ${isDark ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-[#e8f0fb] border-[#c8d6e8] text-[#1a4fad]"}`}>
                  <Users className="h-5 w-5" />
                </div>
                <h3 className={`font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                  Developers
                </h3>
              </div>
              <p className={`text-xs md:text-sm leading-relaxed ${isDark ? "text-white/55" : "text-[#4a6080]"}`}>
                Developed by the researchers and developers of the SPEAKUP
                system for Barangay Payatas-A community enhancement and
                accountability support.
              </p>
            </div>
          </div>
        </div>

        {/* System Features */}
        <div className={`space-y-6 pt-8 border-t ${isDark ? "border-white/[0.06]" : "border-[#c8d6e8]"}`}>
          <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`}>
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
                className={`flex gap-4 p-5 rounded-xl border shadow-sm transition-all duration-300 ${isDark
                  ? "bg-[#112240] border-white/[0.07] hover:border-blue-500/10"
                  : "bg-white border-[#c8d6e8] hover:border-[#1a4fad]/20 hover:shadow-md"
                  }`}
              >
                <div className={`font-bold text-sm tracking-tight pt-0.5 select-none font-mono shrink-0 ${isDark ? "text-white/25" : "text-[#4a6080]/50"}`}>
                  0{idx + 1}.
                </div>
                <div className="space-y-1">
                  <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                    {item.label}
                  </h4>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-white/50" : "text-[#4a6080]"}`}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Return Button */}
        <div className={`flex justify-start pt-8 border-t ${isDark ? "border-white/[0.06]" : "border-[#c8d6e8]"}`}>
          <Link
            href="/dashboard"
            className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 border rounded-lg transition-colors shadow-sm ${isDark
              ? "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white"
              : "border-[#c8d6e8] bg-white text-[#1e3a6e] hover:bg-[#e8f0fb] hover:text-[#0f2d5c]"
              }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
