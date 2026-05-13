import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import {
  Gavel,
  TrendingUp,
  PackageCheck,
  BarChart3,
} from "lucide-react";
import type { KPISummary } from "@/lib/types/database";

async function getKPISummary(): Promise<KPISummary> {
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*");

  const { data: lots } = await supabase
    .from("lots")
    .select("*");

  if (!auctions || !lots) {
    return {
      totalAuctions: 0,
      totalLots: 0,
      totalSold: 0,
      totalHammerValue: 0,
      sellThroughRate: 0,
      averageLotValue: 0,
    };
  }

  const totalSold = lots.filter((l) => l.sold).length;
  const totalHammerValue = lots
    .filter((l) => l.sold && l.hammer_price)
    .reduce((sum, l) => sum + (l.hammer_price ?? 0), 0);

  return {
    totalAuctions: auctions.length,
    totalLots: lots.length,
    totalSold,
    totalHammerValue,
    sellThroughRate: lots.length > 0 ? (totalSold / lots.length) * 100 : 0,
    averageLotValue: totalSold > 0 ? totalHammerValue / totalSold : 0,
  };
}

async function getRecentAuctions() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("auctions")
    .select("*")
    .order("date", { ascending: false })
    .limit(5);

  return data ?? [];
}

export default async function DashboardPage() {
  const [kpi, recentAuctions] = await Promise.all([
    getKPISummary(),
    getRecentAuctions(),
  ]);

  const stats = [
    {
      label: "Total auctions",
      value: kpi.totalAuctions.toString(),
      icon: Gavel,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
      border: "border-brand-500/20",
    },
    {
      label: "Total hammer value",
      value: formatCurrency(kpi.totalHammerValue),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Sell-through rate",
      value: formatPercent(kpi.sellThroughRate),
      icon: PackageCheck,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Average lot value",
      value: formatCurrency(kpi.averageLotValue),
      icon: BarChart3,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">
          All-time auction performance summary
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center flex-shrink-0`}
            >
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">Total lots offered</p>
          <p className="stat-value mt-1">{kpi.totalLots.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="stat-label">Total lots sold</p>
          <p className="stat-value mt-1">{kpi.totalSold.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="stat-label">Lots unsold</p>
          <p className="stat-value mt-1">
            {(kpi.totalLots - kpi.totalSold).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Recent auctions */}
      <div className="card">
        <h2 className="section-title mb-4">Recent auctions</h2>
        {recentAuctions.length === 0 ? (
          <div className="text-center py-12">
            <Gavel size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No auctions yet</p>
            <p className="text-zinc-600 text-xs mt-1">
              Upload your first CSV to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="table-header text-left pb-3 px-4">Auction</th>
                  <th className="table-header text-left pb-3 px-4">Date</th>
                  <th className="table-header text-right pb-3 px-4">Lots</th>
                  <th className="table-header text-right pb-3 px-4">Sold</th>
                  <th className="table-header text-right pb-3 px-4">
                    Hammer value
                  </th>
                  <th className="table-header text-right pb-3 px-4">
                    Sell-through
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentAuctions.map((auction) => (
                  <tr
                    key={auction.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="table-cell font-medium text-zinc-100">
                      {auction.name}
                    </td>
                    <td className="table-cell">
                      {new Date(auction.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="table-cell text-right">
                      {auction.total_lots}
                    </td>
                    <td className="table-cell text-right">
                      {auction.lots_sold}
                    </td>
                    <td className="table-cell text-right">
                      {formatCurrency(auction.total_hammer_value)}
                    </td>
                    <td className="table-cell text-right">
                      <span
                        className={
                          auction.total_lots > 0 &&
                          (auction.lots_sold / auction.total_lots) * 100 >= 70
                            ? "badge-green"
                            : "badge-amber"
                        }
                      >
                        {auction.total_lots > 0
                          ? formatPercent(
                              (auction.lots_sold / auction.total_lots) * 100
                            )
                          : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
