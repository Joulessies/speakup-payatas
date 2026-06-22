"use client";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";

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

export default function TrendChart({ data, isDark, }: {
    data: TrendPoint[];
    isDark: boolean;
}) {
    if (!data || data.length === 0)
        return null;

    const chartData = data.map(d => ({
        ...d,
        formattedDate: new Date(d.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
        ...d.categories
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Count total from payload
            const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
            return (
                <div className={`p-2.5 rounded-xl shadow-xl border text-xs font-sans ${isDark ? "bg-[#0a0a0f]/95 backdrop-blur-md border-white/10 text-white" : "bg-white/95 backdrop-blur-md border-gray-200 text-gray-900"}`}>
                    <p className={`font-semibold mb-2 pb-2 border-b ${isDark ? "text-white/60 border-white/10" : "text-gray-500 border-gray-100"}`}>{label} · {total} Reports</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => {
                            if (!entry.value) return null;
                            return (
                                <div key={index} className="flex items-center justify-between gap-4 font-medium">
                                    <span className={`flex items-center gap-1.5 capitalize ${isDark ? "text-white/80" : "text-gray-600"}`}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                        {entry.name}
                                    </span>
                                    <span className="font-bold">{entry.value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full">
            <div className="w-full h-[152px] mt-2" style={{ fontFamily: "inherit" }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barSize={12}>
                        <XAxis 
                            dataKey="formattedDate" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)" }} 
                            dy={5}
                            minTickGap={20}
                        />
                        <Tooltip 
                            content={<CustomTooltip />} 
                            cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} 
                        />
                        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                            <Bar key={cat} dataKey={cat} stackId="a" fill={color} radius={[0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3.5 px-1.5">
                {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                    <div key={cat} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }}/>
                        <span className={`text-[10px] capitalize ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            {cat}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
