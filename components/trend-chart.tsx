"use client";

interface TrendPoint {
  date: string;
  count: number;
  categories: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, string> = {
  flooding: "#60a5fa",
  fire: "#fb923c",
  crime: "#f87171",
  infrastructure: "#fbbf24",
  health: "#f472b6",
  environmental: "#34d399",
  other: "#9ca3af",
};

export default function TrendChart({
  data,
  isDark,
}: {
  data: TrendPoint[];
  isDark: boolean;
}) {
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barMaxHeight = 120;

  return (
    <div className="w-full">
      {/* Y-axis labels + bars */}
      <div className="flex items-end gap-[4px] h-[152px] px-1.5">
        {data.map((point) => {
          const barHeight = (point.count / maxCount) * barMaxHeight;
          const categories = Object.entries(point.categories);
          const totalForStacking = point.count || 1;

          return (
            <div
              key={point.date}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              {/* Tooltip */}
              <div
                className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none ${
                  isDark ? "bg-white/10 text-white" : "bg-gray-800 text-white"
                }`}
              >
                {point.count} reports
              </div>

              {/* Stacked bar */}
              <div
                className="w-full rounded-t-md overflow-hidden transition-all"
                style={{ height: Math.max(barHeight, point.count > 0 ? 4 : 0) }}
              >
                {categories.length > 0 ? (
                  categories.map(([cat, count]) => (
                    <div
                      key={cat}
                      style={{
                        height: `${(count / totalForStacking) * 100}%`,
                        backgroundColor: CATEGORY_COLORS[cat] ?? "#9ca3af",
                        opacity: 0.85,
                      }}
                    />
                  ))
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis dates */}
      <div className="flex gap-[4px] px-1.5 mt-2">
        {data.map((point, i) => {
          // Only show labels every 2–3 days to avoid clutter
          const show = i === 0 || i === data.length - 1 || i % 3 === 0;
          return (
            <div key={point.date} className="flex-1 text-center">
              {show && (
                <span
                  className={`text-[9px] font-medium ${
                    isDark ? "text-white/30" : "text-gray-400"
                  }`}
                >
                  {new Date(point.date + "T00:00:00").toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3.5">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span
              className={`text-[10px] capitalize ${
                isDark ? "text-white/45" : "text-gray-500"
              }`}
            >
              {cat}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
