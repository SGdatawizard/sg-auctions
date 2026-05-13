"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { Gavel, TrendingUp, PackageCheck, BarChart3 } from "lucide-react";
import type { KPISummary, Auction } from "@/lib/types/database";
import Link from "next/link";

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [recentAuctions, setRecentAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: auctions } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: false });

      const { data: lots } = await supabase.from("lots").select("*");

      if (!auctions || !lots) return;

      const totalSold = lots.filter((l) => l.sold).length;
      const totalHammerValue = lots
        .filter((l) => l.sold && l.hammer_price)
        .reduce((sum, l) => sum + (l.hammer_price ?? 0), 0);

      setKpi({
        totalAuctions: auctions.length,
        totalLots: lots.length,
        totalSold,
        totalHammerValue,
        sellThroughRate: lots.length > 0 ? (totalSold / lots.length) * 100 : 0,
        averageLotValue: totalSold > 0 ? totalHammerValue / totalSold : 0,
      });

      setRecentAuctions(auctions.slice(0, 5));
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Total auctions",
      value: kpi?.totalAuctions.toString() ?? "0",
      icon: Gavel,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
      border: "border-brand-500/20",
    },
    {
      label: "Total hammer value",
      value: formatCurrency(kpi?.totalHammerValue ?? 0),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Sell-through rate",
      value: formatPercent(kpi?.sellThroughRate ?? 0),
      icon: PackageCheck,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Average lot value",
      value: formatCurrency(kpi?.averageLotValue ?? 0),
      icon: BarChart3,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">
          All-time auction performance summary
        </p>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">Total lots offered</p>
          <p className="stat-value mt-1">{kpi?.totalLots.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="stat-label">Total lots sold</p>
          <p className="stat-value mt-1">{kpi?.totalSold.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="stat-label">Lots unsold</p>
          <p className="stat-value mt-1">
            {((kpi?.totalLots ?? 0) - (kpi?.totalSold ?? 0)).toLocaleString()}
          </p>
        </div>
      </div>

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
                  <th className="table-header text-right pb-3 px-4">Hammer value</th>
                  <th className="table-header text-right pb-3 px-4">Sell-through</th>
                </tr>
              </thead>
              <tbody>
                {recentAuctions.map((auction) => (
                  <tr
                    key={auction.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="table-cell font-medium text-zinc-100">
                      <Link
                        href={`/dashboard/auctions/${auction.id}`}
                        className="hover:text-brand-400 transition-colors"
                      >
                        {auction.name}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {new Date(auction.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="table-cell text-right">{auction.total_lots}</td>
                    <td className="table-cell text-right">{auction.lots_sold}</td>
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
