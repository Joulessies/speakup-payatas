"use client";
import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  UserCheck, 
  UserPlus, 
  Vote, 
  Heart, 
  AlertCircle, 
  Info, 
  Eye, 
  Search, 
  Sparkles,
  RefreshCw,
  X,
  FileCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  Megaphone,
  User,
  Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SummaryData {
  demographics?: {
    total_households: number;
    total_population: number;
    male_count: number;
    female_count: number;
    senior_count: number;
    registered_voters: number;
    pwd_count: number;
  };
  cases_summary?: {
    settled: number;
    unsettled: number;
    unscheduled: number;
    scheduled: number;
  };
  officials?: Array<{
    id: string;
    name: string;
    position: string;
    committee: string;
  }>;
  announcement?: {
    title: string;
    what: string;
    when: string;
    where: string;
  };
  age_group_breakdown?: Array<{
    group: string;
    male: number;
    female: number;
    total: number;
  }>;
}

interface BarangaySystemDashboardProps {
  isDark?: boolean;
  totalReports?: number;
  unreviewedCount?: number;
}

export default function BarangaySystemDashboard({ 
  isDark = true,
  totalReports = 0,
  unreviewedCount = 0
}: BarangaySystemDashboardProps) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [officialFilter, setOfficialFilter] = useState<string>("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<boolean>(false);
  const [selectedOfficial, setSelectedOfficial] = useState<{ name: string; position: string; committee: string } | null>(null);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const result = await res.json();
      if (res.ok) {
        setData(result);
      }
    } catch {
      toast.error("Failed to load live database metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const demographics = data?.demographics || {
    total_households: 12854,
    total_population: 140500,
    male_count: 70120,
    female_count: 70380,
    senior_count: 12450,
    registered_voters: 84200,
    pwd_count: 3120,
  };

  const cases = data?.cases_summary || {
    settled: totalReports > 0 ? Math.max(1, Math.floor(totalReports * 0.7)) : 42,
    unsettled: totalReports > 0 ? Math.max(1, Math.floor(totalReports * 0.2)) : 5,
    unscheduled: unreviewedCount || 2,
    scheduled: totalReports > 0 ? Math.max(1, Math.floor(totalReports * 0.1)) : 8,
  };

  const officials = data?.officials || [
    { id: "1", name: "Hon. Executive Punong Barangay", position: "Brgy. Captain", committee: "Presiding Officer & Operations" },
    { id: "2", name: "Hon. Brgy. Kagawad Peace & Order", position: "Brgy. Kagawad", committee: "Public Safety & Peace & Order" },
    { id: "3", name: "Hon. Brgy. Kagawad Health & Sanitation", position: "Brgy. Kagawad", committee: "Health, Medical & Sanitation" },
    { id: "4", name: "Hon. Brgy. Kagawad Infrastructure", position: "Brgy. Kagawad", committee: "Public Works & Infrastructure" },
    { id: "5", name: "Brgy. Executive Secretary", position: "Executive Secretary", committee: "Administration & Records" },
    { id: "6", name: "Brgy. Finance Treasurer", position: "Brgy. Treasurer", committee: "Budget & Appropriations" },
  ];

  const announcement = data?.announcement || {
    title: "Barangay Clean-Up & Assembly",
    what: "Barangay Clean-Up & Incident Response Assembly",
    when: "2026-07-25",
    where: "Payatas Barangay Hall Complex",
  };

  const ageGroups = data?.age_group_breakdown || [
    { group: "Youth 0-17 Yrs", male: 18200, female: 17800, total: 36000 },
    { group: "Adult 18-35 Yrs", male: 26500, female: 25900, total: 52400 },
    { group: "Adult 36-59 Yrs", male: 19100, female: 20550, total: 39650 },
    { group: "Senior 60+ Yrs", male: 6320, female: 6130, total: 12450 },
  ];

  const filteredOfficials = officials.filter(o => 
    o.name.toLowerCase().includes(officialFilter.toLowerCase()) ||
    o.position.toLowerCase().includes(officialFilter.toLowerCase()) ||
    o.committee.toLowerCase().includes(officialFilter.toLowerCase())
  );

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* 1. Header Banner Card */}
      <div className={`w-full rounded-2xl overflow-hidden border shadow-lg transition-all ${
        isDark ? "bg-[#031f18] border-emerald-500/30 text-white" : "bg-[#064e3b] text-white border-emerald-600"
      }`}>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/30 p-0.5 flex items-center justify-center shrink-0 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/payatas-logo.png" alt="Barangay Payatas Seal" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-white">
                BARANGAY MANAGEMENT SYSTEM
              </h1>
            </div>
          </div>
        </div>

        {/* Subheader Sub-banner */}
        <div className={`border-t px-4 py-2.5 flex items-center justify-between gap-2 ${
          isDark ? "bg-[#06382b]/80 border-emerald-500/20" : "bg-[#e6f4ea] border-emerald-200"
        }`}>
          <div>
            <h2 className={`text-base font-bold leading-none ${isDark ? "text-white" : "text-[#064e3b]"}`}>Barangay Payatas</h2>
            <p className={`text-[11px] mt-0.5 font-medium ${isDark ? "text-emerald-200/80" : "text-[#059669]"}`}>District 2, Quezon City, Metro Manila</p>
          </div>
        </div>
      </div>

      {/* 2. Top Stat Cards Grid (7 Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {/* Total House Hold */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/40 hover:border-emerald-400" : "bg-white border-emerald-300 hover:border-emerald-500"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>Total House Hold</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.total_households.toLocaleString()}</div>
        </div>

        {/* Total Population */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/40 hover:border-emerald-400" : "bg-white border-emerald-300 hover:border-emerald-500"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>Total Population</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.total_population.toLocaleString()}</div>
        </div>

        {/* Male */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/30 hover:border-emerald-400" : "bg-white border-emerald-200 hover:border-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>Male</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.male_count.toLocaleString()}</div>
        </div>

        {/* SENIOR */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/30 hover:border-emerald-400" : "bg-white border-emerald-200 hover:border-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>SENIOR</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.senior_count.toLocaleString()}</div>
        </div>

        {/* Registered Voters */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/30 hover:border-emerald-400" : "bg-white border-emerald-200 hover:border-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>Registered Voters</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Vote className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.registered_voters.toLocaleString()}</div>
        </div>

        {/* Female */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/30 hover:border-emerald-400" : "bg-white border-emerald-200 hover:border-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>Female</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserPlus className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.female_count.toLocaleString()}</div>
        </div>

        {/* PWD */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-md transition-all hover:scale-[1.02] ${
          isDark ? "bg-[#06382b] border-emerald-500/30 hover:border-emerald-400" : "bg-white border-emerald-200 hover:border-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-emerald-200" : "text-[#047857]"}`}>PWD</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-xl font-extrabold font-mono mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{demographics.pwd_count.toLocaleString()}</div>
        </div>
      </div>

      {/* Main Content Workspace Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Barangay Officials & Announcements) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Current Barangay Officials Table */}
          <div className={`border rounded-xl overflow-hidden shadow-lg ${
            isDark ? "bg-[#06382b] border-emerald-500/30" : "bg-white border-emerald-300"
          }`}>
            <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? "bg-[#042d22] border-emerald-500/30" : "bg-[#e6f4ea] border-emerald-200"
            }`}>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-[#064e3b]"}`}>Current Barangay Officials</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={officialFilter}
                    onChange={(e) => setOfficialFilter(e.target.value)}
                    placeholder="Search officials..."
                    className="pl-6 pr-2 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs">
                <thead className={`uppercase font-bold text-[10px] border-b sticky top-0 ${
                  isDark ? "bg-[#03231a] text-emerald-200 border-emerald-500/30" : "bg-[#f0fdf4] text-[#047857] border-emerald-200"
                }`}>
                  <tr>
                    <th className="px-3 py-2">Full Name</th>
                    <th className="px-3 py-2">Brgy. Position</th>
                    <th className="px-3 py-2">Committee</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-emerald-500/20 text-white/90" : "divide-emerald-100 text-gray-800"}`}>
                  {filteredOfficials.map((off) => (
                    <tr 
                      key={off.id} 
                      onClick={() => setSelectedOfficial(off)}
                      className="hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2 font-medium flex items-center gap-2">
                        <User className="h-3 w-3 text-emerald-400 shrink-0" />
                        {off.name}
                      </td>
                      <td className="px-3 py-2 text-emerald-400 font-semibold">{off.position}</td>
                      <td className={`px-3 py-2 ${isDark ? "text-white/70" : "text-gray-600"}`}>{off.committee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BARANGAY ANNOUNCEMENT Box */}
          <div className={`border rounded-xl overflow-hidden shadow-lg p-3.5 ${
            isDark ? "bg-[#06382b] border-emerald-500/30" : "bg-white border-emerald-300"
          }`}>
            <div className={`flex items-center justify-between border-b pb-2.5 mb-2.5 ${isDark ? "border-emerald-500/30" : "border-emerald-200"}`}>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-emerald-400" />
                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-[#064e3b]"}`}>BARANGAY ANNOUNCEMENT</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">1 Upcoming</span>
              </div>
              <button 
                onClick={() => setSelectedAnnouncement(true)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Eye className="h-3.5 w-3.5" /> View Details
              </button>
            </div>
            
            {/* Vertical Announcement Detail Boxes */}
            <div className="flex flex-col gap-2.5 text-xs">
              <div className={`p-2.5 rounded-xl border flex items-start gap-3 transition-all ${isDark ? "bg-[#03231a] border-emerald-500/30 hover:border-emerald-400/50" : "bg-[#f0fdf4] border-emerald-200 hover:border-emerald-300"}`}>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">WHAT</span>
                  <p className={`font-semibold mt-0.5 leading-snug ${isDark ? "text-white" : "text-[#064e3b]"}`}>{announcement.what}</p>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border flex items-start gap-3 transition-all ${isDark ? "bg-[#03231a] border-emerald-500/30 hover:border-emerald-400/50" : "bg-[#f0fdf4] border-emerald-200 hover:border-emerald-300"}`}>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">WHEN</span>
                  <p className={`font-semibold mt-0.5 font-mono ${isDark ? "text-white" : "text-[#064e3b]"}`}>{announcement.when}</p>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border flex items-start gap-3 transition-all ${isDark ? "bg-[#03231a] border-emerald-500/30 hover:border-emerald-400/50" : "bg-[#f0fdf4] border-emerald-200 hover:border-emerald-300"}`}>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">WHERE</span>
                  <p className={`font-semibold mt-0.5 leading-snug ${isDark ? "text-white" : "text-[#064e3b]"}`}>{announcement.where}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Cases Summary Stacked Vertically Beside Age Group Breakdown Table) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
            {/* 4 Case Status Summary Cards Stacked Vertically */}
            <div className="sm:col-span-5 flex flex-col justify-between gap-2">
              {/* Settled Cases */}
              <div className={`flex-1 border-2 border-emerald-400 rounded-xl p-2.5 text-center shadow-md transition-transform hover:scale-[1.02] flex flex-col justify-center ${isDark ? "bg-[#06382b]" : "bg-white"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Settled Cases</span>
                <span className={`text-xl font-black font-mono block mt-0.5 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{cases.settled}</span>
              </div>

              {/* Unsettled Cases */}
              <div className={`flex-1 border-2 border-red-500 rounded-xl p-2.5 text-center shadow-md transition-transform hover:scale-[1.02] flex flex-col justify-center ${isDark ? "bg-[#06382b]" : "bg-white"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">Unsettled Cases</span>
                <span className={`text-xl font-black font-mono block mt-0.5 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{cases.unsettled}</span>
              </div>

              {/* Unscheduled Cases */}
              <div className={`flex-1 border-2 border-emerald-500 rounded-xl p-2.5 text-center shadow-md transition-transform hover:scale-[1.02] flex flex-col justify-center ${isDark ? "bg-[#06382b]" : "bg-white"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Unscheduled Cases</span>
                <span className={`text-xl font-black font-mono block mt-0.5 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{cases.unscheduled}</span>
              </div>

              {/* Scheduled Cases */}
              <div className={`flex-1 border-2 border-amber-400 rounded-xl p-2.5 text-center shadow-md transition-transform hover:scale-[1.02] flex flex-col justify-center ${isDark ? "bg-[#06382b]" : "bg-white"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">Scheduled Cases</span>
                <span className={`text-xl font-black font-mono block mt-0.5 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{cases.scheduled}</span>
              </div>
            </div>

            {/* AGE GROUP Breakdown Table */}
            <div className={`sm:col-span-7 border rounded-xl overflow-hidden shadow-lg flex flex-col ${
              isDark ? "bg-[#06382b] border-emerald-500/30" : "bg-white border-emerald-300"
            }`}>
              <div className={`px-3 py-2 border-b flex items-center justify-between ${isDark ? "bg-[#042d22] border-emerald-500/30" : "bg-[#e6f4ea] border-emerald-200"}`}>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-[#064e3b]"}`}>AGE GROUP BREAKDOWN</h3>
                <span className="text-[10px] text-emerald-300 font-mono">Demographic</span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs h-full">
                  <thead className={`uppercase font-bold text-[10px] border-b ${
                    isDark ? "bg-[#03231a] text-emerald-200 border-emerald-500/30" : "bg-[#f0fdf4] text-[#047857] border-emerald-200"
                  }`}>
                    <tr>
                      <th className="px-2 py-1.5">AGE GROUP</th>
                      <th className="px-1.5 py-1.5 text-center">MALE</th>
                      <th className="px-1.5 py-1.5 text-center">FEMALE</th>
                      <th className="px-1.5 py-1.5 text-center">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-mono text-[10px] ${isDark ? "divide-emerald-500/20 text-white/90" : "divide-emerald-100 text-gray-800"}`}>
                    {ageGroups.map((ag, i) => (
                      <tr key={i} className="hover:bg-emerald-500/5">
                        <td className={`px-2 py-2 font-sans font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>{ag.group}</td>
                        <td className="px-1.5 py-2 text-center">{ag.male.toLocaleString()}</td>
                        <td className="px-1.5 py-2 text-center">{ag.female.toLocaleString()}</td>
                        <td className="px-1.5 py-2 text-center font-bold text-emerald-400">{ag.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Announcement Details */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isDark ? "bg-[#06382b] border-emerald-500/40 text-white" : "bg-white border-emerald-300 text-gray-900"
          }`}>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-base">Barangay Announcement Details</h3>
              </div>
              <button onClick={() => setSelectedAnnouncement(false)} className="p-1 rounded-md hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-bold uppercase block mb-1">Event Subject</span>
                <p className="font-bold text-base">{announcement.what}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-emerald-400 font-bold uppercase flex items-center gap-1 mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Date & Time
                  </span>
                  <p className="font-mono text-xs">{announcement.when}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-emerald-400 font-bold uppercase flex items-center gap-1 mb-1">
                    <MapPin className="h-3.5 w-3.5" /> Venue
                  </span>
                  <p className="text-xs font-semibold">{announcement.where}</p>
                </div>
              </div>
              <p className="text-xs text-white/70 pt-2 border-t border-white/10">
                All Barangay Payatas residents and staff are invited to participate. For questions, contact the Executive Secretariat Office.
              </p>
            </div>
            <button 
              onClick={() => setSelectedAnnouncement(false)}
              className="mt-5 w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Close Announcement
            </button>
          </div>
        </div>
      )}

      {/* Modal: Official Details */}
      {selectedOfficial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isDark ? "bg-[#06382b] border-emerald-500/40 text-white" : "bg-white border-emerald-300 text-gray-900"
          }`}>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-base">Barangay Official Record</h3>
              </div>
              <button onClick={() => setSelectedOfficial(null)} className="p-1 rounded-md hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-bold uppercase block mb-1">Official Name</span>
                <p className="font-bold text-base">{selectedOfficial.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-emerald-400 font-bold uppercase block mb-1">Position / Office</span>
                <p className="font-semibold">{selectedOfficial.position}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-emerald-400 font-bold uppercase block mb-1">Assigned Committee</span>
                <p className="font-semibold">{selectedOfficial.committee}</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedOfficial(null)}
              className="mt-5 w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Close Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
