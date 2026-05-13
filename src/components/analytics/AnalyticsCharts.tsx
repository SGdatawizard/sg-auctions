"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { YearSummary, CategorySummary } from "@/lib/types/database";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";

type Props = {
  yearSummaries: YearSummary[];
  categorySummaries: CategorySummary[];
};

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#f4f4f5",
  fontSize: "12px",
};

const tooltipLabelStyle = {
  color: "#a1a1aa",
  marginBottom: "4px",
};

export default function AnalyticsCharts({
  yearSummaries,
  categorySummaries,
}: Props) {
  const hasYearData = yearSummaries.length > 0;
  const hasCategoryData = categorySummaries.length > 0;

  if (!hasYearData && !hasCategoryData) {
    return (
      <div className="card text-center py-16">
        <p className="text-zinc-500 text-sm">No data available yet</p>
        <p className="text-zinc-600 text-xs mt-1">
          Upload auction data to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Year on year — hammer value */}
      {hasYearData && (
        <div className="card">
          <h2 className="section-title mb-6">Total hammer value by year</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={yearSummaries}
              margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value: number) => [
                  formatCurrency(value),
                  "Hammer value",
                ]}
              />
              <Bar
                dataKey="totalHammerValue"
                fill="#d4861f"
                radius={[4, 4, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year on year — sell-through rate */}
      {hasYearData && (
        <div className="card">
          <h2 className="section-title mb-6">Sell-through rate by year</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={yearSummaries}
              margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value: number) => [
                  formatPercent(value),
                  "Sell-through rate",
                ]}
              />
              <Line
                type="monotone"
                dataKey="sellThroughRate"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year on year — lots offered vs sold */}
      {hasYearData && (
        <div className="card">
          <h2 className="section-title mb-6">Lots offered vs sold by year</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={yearSummaries}
              margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#71717a" }}
              />
              <Bar
                dataKey="totalLots"
                name="Lots offered"
                fill="#3f3f46"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="totalSold"
                name="Lots sold"
                fill="#d4861f"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      {hasCategoryData && (
        <div className="card">
          <h2 className="section-title mb-6">
            Top categories by hammer value
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={categorySummaries}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 100, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={96}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value: number) => [
                  formatCurrency(value),
                  "Hammer value",
                ]}
              />
              <Bar
                dataKey="totalHammerValue"
                fill="#d4861f"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category sell-through table */}
      {hasCategoryData && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="section-title">Category performance breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="table-header text-left py-3 px-6">Category</th>
                  <th className="table-header text-right py-3 px-6">Lots</th>
                  <th className="table-header text-right py-3 px-6">Sold</th>
                  <th className="table-header text-right py-3 px-6">Hammer value</th>
                  <th className="table-header text-right py-3 px-6">Sell-through</th>
                </tr>
              </thead>
              <tbody>
                {categorySummaries.map((cat) => (
                  <tr
                    key={cat.category}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="table-cell px-6 font-medium text-zinc-100">
                      {cat.category}
                    </td>
                    <td className="table-cell text-right px-6">
                      {cat.totalLots.toLocaleString()}
                    </td>
                    <td className="table-cell text-right px-6">
                      {cat.totalSold.toLocaleString()}
                    </td>
                    <td className="table-cell text-right px-6 font-medium text-zinc-100">
                      {formatCurrency(cat.totalHammerValue)}
                    </td>
                    <td className="table-cell text-right px-6">
                      <span
                        className={
                          cat.sellThroughRate >= 80
                            ? "badge-green"
                            : cat.sellThroughRate >= 60
                            ? "badge-amber"
                            : "badge-red"
                        }
                      >
                        {formatPercent(cat.sellThroughRate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
