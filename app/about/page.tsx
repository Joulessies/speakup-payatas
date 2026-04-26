"use client";

import { useTheme } from "@/components/theme-provider";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import {
  ShieldCheck,
  Database,
  Brain,
  AlertTriangle,
  Globe,
  Lock,
  Wifi,
  MapPin,
  BarChart3,
  Zap,
} from "lucide-react";

const TECH_STACK = [
  { name: "Next.js 16", desc: "React framework with App Router" },
  { name: "Supabase + PostGIS", desc: "PostgreSQL with spatial geography queries" },
  { name: "Dexie.js", desc: "IndexedDB wrapper for offline storage" },
  { name: "Serwist", desc: "Service worker for PWA caching" },
  { name: "Web Crypto API", desc: "SHA-256 hashing for anonymity" },
  { name: "density-clustering", desc: "DBSCAN implementation in JavaScript" },
  { name: "Leaflet", desc: "Interactive map visualization" },
];

export default function AboutPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const sectionClass = `p-5 md:p-6 rounded-2xl border ${
    isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"
  }`;
  const headingClass = `text-base md:text-lg font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`;
  const textClass = `text-sm leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`;
  const subheadClass = `text-sm font-semibold mt-4 mb-2 ${isDark ? "text-white/80" : "text-gray-800"}`;
  const codeClass = `px-3 py-3 rounded-xl text-xs ${
    isDark ? "bg-white/[0.04] border border-white/[0.06] text-white/80" : "bg-gray-50 border border-gray-100 text-gray-700"
  }`;
  const eqCaptionClass = `mt-1 text-[11px] ${isDark ? "text-white/35" : "text-gray-500"}`;

  return (
    <div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 md:py-12 space-y-5">
        {/* Title */}
        <div className="text-center mb-2">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${
            isDark ? "bg-indigo-500/10" : "bg-indigo-50"
          }`}>
            <Brain className={`h-7 w-7 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          </div>
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            Methodology & Algorithms
          </h1>
          <p className={`text-sm max-w-2xl mx-auto ${isDark ? "text-white/45" : "text-gray-500"}`}>
            SpeakUp: Algorithm-Based Anonymous Reporting Platform for Barangay Payatas-A
          </p>
        </div>

        {/* System Overview */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            <h2 className={headingClass}>System Overview</h2>
          </div>
          <p className={textClass}>
            SpeakUp Payatas is an anonymous, offline-capable Progressive Web Application (PWA) 
            designed for community incident reporting in Barangay Payatas-A, Quezon City. 
            The platform employs three core algorithms for intelligent data analysis: 
            DBSCAN spatial clustering, urgency auto-scoring, and anomaly detection.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Lock, label: "SHA-256 Anonymity" },
              { icon: Wifi, label: "Offline-First PWA" },
              { icon: MapPin, label: "PostGIS Geofencing" },
              { icon: BarChart3, label: "DBSCAN Clustering" },
            ].map((f) => (
              <div key={f.label} className={`flex flex-col items-center gap-2 py-3 rounded-xl ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}>
                <f.icon className={`h-4 w-4 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                <span className={`text-[10px] font-medium text-center ${isDark ? "text-white/50" : "text-gray-500"}`}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Algorithm 1: DBSCAN */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-3">
            <Database className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
            <h2 className={headingClass}>Algorithm 1: DBSCAN Spatial Clustering</h2>
          </div>
          <p className={textClass}>
            DBSCAN (Density-Based Spatial Clustering of Applications with Noise) groups nearby 
            incident reports into clusters based on geographic density without requiring the number 
            of clusters to be specified in advance.
          </p>

          <h3 className={subheadClass}>Parameters</h3>
          <div className={`${codeClass} overflow-x-auto`}>
            <div className="mb-2">
              <BlockMath math={"\\varepsilon = 50\\,\\text{meters}"} />
            </div>
            <div>
              <BlockMath math={"\\mathrm{minPts} = 3"} />
            </div>
            <p className={eqCaptionClass}>Eq. (1) DBSCAN neighborhood and minimum cluster density parameters.</p>
          </div>

          <h3 className={subheadClass}>Coordinate Projection</h3>
          <p className={textClass}>
            GPS coordinates (latitude, longitude) are converted to a meter-based local plane 
            using the Haversine approximation at Payatas latitude (~14.7°N):
          </p>
          <div className={`${codeClass} mt-2 space-y-2 overflow-x-auto`}>
            <BlockMath math={"x = \\lambda \\cdot 111{,}320 \\cdot \\cos(14.7^{\\circ})"} />
            <BlockMath math={"y = \\phi \\cdot 111{,}320"} />
            <p className={eqCaptionClass}>Eq. (2) Local planar projection used before spatial clustering.</p>
          </div>
          <p className={`${textClass} mt-2`}>
            This ensures the epsilon of 50m accurately represents spatial distance. Reports not 
            belonging to any cluster are classified as <strong>noise</strong> (scattered incidents).
          </p>
        </div>

        {/* Algorithm 2: Urgency */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            <h2 className={headingClass}>Algorithm 2: Urgency Auto-Scoring</h2>
          </div>
          <p className={textClass}>
            Each cluster is automatically ranked by a composite urgency score that combines 
            three factors to prioritize the most critical hotspots:
          </p>

          <h3 className={subheadClass}>Formula</h3>
          <div className={`${codeClass} space-y-2 overflow-x-auto`}>
            <BlockMath math={"U = S \\times D \\times R"} />
            <div className="mt-2 space-y-1">
              <BlockMath math={"S = \\frac{\\text{report severity}}{5} \\in [0.2, 1.0]"} />
              <BlockMath math={"D = \\min\\left(\\frac{\\text{cluster count}}{3},\\,3.0\\right) \\in [0.33, 3.0]"} />
              <BlockMath math={"R = e^{-\\lambda t}"} />
            </div>
            <p className={eqCaptionClass}>Eq. (3) Composite urgency score from severity, density, and recency factors.</p>
          </div>

          <h3 className={subheadClass}>Decay Function</h3>
          <p className={textClass}>
            The recency factor uses exponential decay with a <strong>72-hour half-life</strong>. 
            A report submitted now scores 1.0, drops to 0.5 after 3 days, and 0.25 after 6 days. 
            This ensures recent incidents are prioritized while older reports naturally de-escalate.
          </p>
          <div className={`${codeClass} mt-2 space-y-2 overflow-x-auto`}>
            <BlockMath math={"\\lambda = \\frac{\\ln(2)}{72} \\approx 0.00963"} />
            <BlockMath math={"R(t) = e^{-0.00963\\,t}"} />
            <p className={eqCaptionClass}>Eq. (4) Exponential recency decay with 72-hour half-life.</p>
          </div>

          <h3 className={subheadClass}>Score Normalization</h3>
          <p className={textClass}>
            The raw score (max = 3.0) is normalized to a 0–100 scale and classified as:
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              { label: "Critical", range: "75–100", color: "bg-red-500" },
              { label: "High", range: "50–74", color: "bg-orange-500" },
              { label: "Medium", range: "25–49", color: "bg-amber-500" },
              { label: "Low", range: "0–24", color: "bg-emerald-500" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{l.label} ({l.range})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Algorithm 3: Anomaly Detection */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-5 w-5 ${isDark ? "text-red-400" : "text-red-600"}`} />
            <h2 className={headingClass}>Algorithm 3: Anomaly Detection</h2>
          </div>
          <p className={textClass}>
            The system detects spatial-temporal anomalies — sudden spikes in incident reports 
            within a geographic cluster — using two complementary triggers:
          </p>

          <h3 className={subheadClass}>Trigger 1: Absolute Threshold</h3>
          <div className={`${codeClass} overflow-x-auto`}>
            <BlockMath math={"\\text{If } N_{24h} \\ge 5,\\ \\text{flag as anomaly}"} />
            <p className={eqCaptionClass}>Eq. (5) Absolute anomaly threshold based on recent incident count.</p>
          </div>

          <h3 className={subheadClass}>Trigger 2: Rate Comparison</h3>
          <div className={`${codeClass} mt-2 space-y-2 overflow-x-auto`}>
            <BlockMath math={"\\bar{r}_{\\text{daily}} = \\frac{N_{\\text{total}}}{d_{\\text{span}}}"} />
            <BlockMath math={"\\rho = \\frac{N_{24h}}{\\bar{r}_{\\text{daily}}}"} />
            <BlockMath math={"\\text{If } \\rho \\ge 2.0,\\ \\text{flag as anomaly}"} />
            <p className={eqCaptionClass}>Eq. (6) Spike-ratio anomaly detection using rolling daily baseline.</p>
          </div>

          <p className={`${textClass} mt-3`}>
            Anomalies are visually flagged in the dashboard and analytics page with red alert 
            banners, helping barangay officials identify emerging crises before they escalate.
          </p>
        </div>

        {/* Tech Stack */}
        <div className={sectionClass}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
            <h2 className={headingClass}>Technology Stack</h2>
          </div>
          <div className="grid gap-2">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className={`flex flex-col items-start gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 rounded-xl ${isDark ? "bg-white/[0.03]" : "bg-gray-50"}`}
              >
                <span className={`text-sm font-semibold sm:min-w-[140px] ${isDark ? "text-white/80" : "text-gray-800"}`}>
                  {tech.name}
                </span>
                <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-500"}`}>
                  {tech.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
