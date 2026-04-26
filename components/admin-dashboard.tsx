"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import ThemeToggle from "@/components/theme-toggle";
import {
  Loader2,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Flame,
  Droplets,
  ShieldAlert,
  Wrench,
  HeartPulse,
  Leaf,
  CircleHelp,
  MapPin,
  Download,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClusterResult } from "@/types";

const AdminMapInner = dynamic(() => import("@/components/admin-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
    </div>
  ),
});

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  flooding: <Droplets className="h-3.5 w-3.5 text-blue-400" />,
  fire: <Flame className="h-3.5 w-3.5 text-orange-400" />,
  crime: <ShieldAlert className="h-3.5 w-3.5 text-red-400" />,
  infrastructure: <Wrench className="h-3.5 w-3.5 text-amber-400" />,
  health: <HeartPulse className="h-3.5 w-3.5 text-pink-400" />,
  environmental: <Leaf className="h-3.5 w-3.5 text-emerald-400" />,
  other: <CircleHelp className="h-3.5 w-3.5 text-gray-400" />,
};

const ALL_CATEGORIES = [
  "flooding",
  "fire",
  "crime",
  "infrastructure",
  "health",
  "environmental",
  "other",
];

function getDensityLabel(count: number) {
  if (count >= 15) return { text: "Critical", color: "bg-red-500" };
  if (count >= 10) return { text: "High", color: "bg-orange-500" };
  if (count >= 5) return { text: "Medium", color: "bg-amber-500" };
  return { text: "Low", color: "bg-emerald-500" };
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const [clusters, setClusters] = useState<ClusterResult[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [noiseCount, setNoiseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(ALL_CATEGORIES),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clusters", { method: "POST" });
        const data = await res.json();
        setClusters(data.clusters ?? []);
        setTotalReports(data.total_reports ?? 0);
        setNoiseCount(data.noise_count ?? 0);
      } catch (err) {
        console.error("Failed to fetch clusters:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredClusters = useMemo(() => {
    if (activeCategories.size === ALL_CATEGORIES.length) return clusters;
    return clusters
      .map((c) => {
        const filteredBreakdown: Record<string, number> = {};
        let filteredCount = 0;
        for (const [cat, count] of Object.entries(c.category_breakdown)) {
          if (activeCategories.has(cat)) {
            filteredBreakdown[cat] = count;
            filteredCount += count;
          }
        }
        if (filteredCount === 0) return null;
        return { ...c, count: filteredCount, category_breakdown: filteredBreakdown };
      })
      .filter(Boolean) as ClusterResult[];
  }, [clusters, activeCategories]);

  const totalFiltered = filteredClusters.reduce((s, c) => s + c.count, 0);

  return (
    <div className="relative flex flex-1 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] overflow-hidden">
      {/* Map */}
      <div className="absolute inset-0 z-0">
        <AdminMapInner
          clusters={filteredClusters}
          selectedCluster={selectedCluster}
          onClusterClick={setSelectedCluster}
          showHeatmap={showHeatmap}
        />
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col w-80 relative z-10 border-r overflow-y-auto ${isDark
          ? "bg-black/80 backdrop-blur-xl border-white/[0.06]"
          : "bg-white/80 backdrop-blur-xl border-black/[0.06]"
          }`}
      >
        <SidebarContent
          isDark={isDark}
          loading={loading}
          totalReports={totalReports}
          totalFiltered={totalFiltered}
          noiseCount={noiseCount}
          clusters={filteredClusters}
          selectedCluster={selectedCluster}
          setSelectedCluster={setSelectedCluster}
          activeCategories={activeCategories}
          toggleCategory={toggleCategory}
          t={t}
        />
      </aside>

      {/* Desktop controls */}
      <div className="hidden md:flex gap-2 absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${showHeatmap
            ? isDark
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : isDark
              ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
              : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"
            }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Heatmap
        </button>
        <ThemeToggle />
      </div>

      {/* Mobile heatmap FAB */}
      <button
        onClick={() => setShowHeatmap(!showHeatmap)}
        className={`md:hidden absolute top-4 right-4 z-[1000] flex items-center justify-center w-10 h-10 rounded-full shadow-lg backdrop-blur-xl transition-colors ${showHeatmap
          ? isDark
            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
          : isDark
            ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
            : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"
          }`}
      >
        <Layers className="h-4 w-4" />
      </button>

      {/* Mobile bottom panel */}
      <div
        className={`md:hidden absolute bottom-0 left-0 right-0 z-[1000] transition-transform duration-300 ${panelOpen ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"
          }`}
      >
        {/* Pull handle */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-t-2xl border-t ${isDark
            ? "bg-black/90 border-white/[0.08] text-white/70"
            : "bg-white/90 border-black/[0.08] text-gray-600"
            }`}
        >
          {panelOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {loading
              ? "Loading…"
              : `${filteredClusters.length} hotspots · ${totalFiltered} reports`}
          </span>
        </button>
        <div
          className={`h-[60vh] overflow-y-auto ${isDark ? "bg-black/90 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl"
            }`}
        >
          <SidebarContent
            isDark={isDark}
            loading={loading}
            totalReports={totalReports}
            totalFiltered={totalFiltered}
            noiseCount={noiseCount}
            clusters={filteredClusters}
            selectedCluster={selectedCluster}
            setSelectedCluster={(i) => {
              setSelectedCluster(i);
              setPanelOpen(false);
            }}
            activeCategories={activeCategories}
            toggleCategory={toggleCategory}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- Sidebar Content ---------- */

function SidebarContent({
  isDark,
  loading,
  totalReports,
  totalFiltered,
  noiseCount,
  clusters,
  selectedCluster,
  setSelectedCluster,
  activeCategories,
  toggleCategory,
  t,
}: {
  isDark: boolean;
  loading: boolean;
  totalReports: number;
  totalFiltered: number;
  noiseCount: number;
  clusters: ClusterResult[];
  selectedCluster: number | null;
  setSelectedCluster: (i: number | null) => void;
  activeCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  t: ReturnType<typeof import("@/lib/i18n").getTranslations>;
}) {
  const exportCSV = () => {
    const header = "Cluster,Latitude,Longitude,Report Count,Top Category,Density\n";
    const rows = clusters.map((c, i) => {
      const topCat = Object.entries(c.category_breakdown).sort((a, b) => b[1] - a[1])[0];
      const density = c.count >= 15 ? "Critical" : c.count >= 10 ? "High" : c.count >= 5 ? "Medium" : "Low";
      return `${i + 1},${c.latitude},${c.longitude},${c.count},${topCat?.[0] ?? "mixed"},${density}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speakup-payatas-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Stats */}
      <div>
        <h2
          className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"
            }`}
        >
          {t.adminOverview}
        </h2>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading data…</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t.adminReports, value: totalReports, icon: BarChart3 },
              { label: t.adminHotspots, value: clusters.length, icon: MapPin },
              { label: t.adminScattered, value: noiseCount, icon: MapPin },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl ${isDark ? "bg-white/[0.04]" : "bg-black/[0.03]"
                  }`}
              >
                <span
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {stat.value}
                </span>
                <span
                  className={`text-[10px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category filters */}
      <div>
        <h2
          className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"
            }`}
        >
          {t.adminFilterCategory}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${isActive
                  ? isDark
                    ? "bg-white/10 text-white"
                    : "bg-gray-100 text-gray-900"
                  : isDark
                    ? "bg-white/[0.03] text-white/25"
                    : "bg-black/[0.02] text-gray-300"
                  }`}
              >
                {CATEGORY_ICONS[cat]}
                {cat === "infrastructure" ? "Infra" : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cluster list */}
      <div>
        <h2
          className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"
            }`}
        >
          {t.adminHotspotsCount(clusters.length)}
        </h2>
        {clusters.length === 0 && !loading && (
          <p className={`text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}>
            {t.adminNoMatch}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {clusters.map((cluster, i) => {
            const density = getDensityLabel(cluster.count);
            const isSelected = selectedCluster === i;
            const topCategory = Object.entries(cluster.category_breakdown).sort(
              (a, b) => b[1] - a[1],
            )[0];

            return (
              <button
                key={i}
                onClick={() => setSelectedCluster(isSelected ? null : i)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${isSelected
                  ? isDark
                    ? "bg-indigo-500/15 ring-1 ring-indigo-500/30"
                    : "bg-indigo-50 ring-1 ring-indigo-200"
                  : isDark
                    ? "bg-white/[0.03] hover:bg-white/[0.06]"
                    : "bg-black/[0.02] hover:bg-black/[0.04]"
                  }`}
              >
                <div className="flex flex-col items-center gap-1 min-w-[40px]">
                  <span
                    className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {cluster.count}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${density.color}`} />
                    <span
                      className={`text-[9px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}
                    >
                      {density.text}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {topCategory && CATEGORY_ICONS[topCategory[0]]}
                    <span
                      className={`text-sm font-medium capitalize truncate ${isDark ? "text-white/80" : "text-gray-700"
                        }`}
                    >
                      {topCategory ? topCategory[0] : "Mixed"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono ${isDark ? "text-white/25" : "text-gray-400"}`}
                  >
                    {cluster.latitude.toFixed(5)}, {cluster.longitude.toFixed(5)}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"
                    }`}
                >
                  {Object.keys(cluster.category_breakdown).length} type
                  {Object.keys(cluster.category_breakdown).length > 1 ? "s" : ""}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div>
        <h2
          className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-gray-400"
            }`}
        >
          {t.adminDensityLegend}
        </h2>
        <div className="flex flex-col gap-1.5">
          {[
            { color: "bg-emerald-500", label: t.adminDensityLow },
            { color: "bg-amber-500", label: t.adminDensityMedium },
            { color: "bg-orange-500", label: t.adminDensityHigh },
            { color: "bg-red-500", label: t.adminDensityCritical },
          ].map((item) => (
            <div key={item.color} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span
                className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CSV Export */}
      {clusters.length > 0 && (
        <button
          onClick={exportCSV}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors ${isDark
            ? "bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white"
            : "bg-black/[0.04] text-gray-500 hover:bg-black/[0.08] hover:text-gray-900"
            }`}
        >
          <Download className="h-3.5 w-3.5" />
          {t.adminExportCSV}
        </button>
      )}
    </div>
  );
}
