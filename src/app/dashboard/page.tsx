"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { Gavel, TrendingUp, PackageCheck, BarChart3, PoundSterling, Receipt, Wallet } from "lucide-react";
import type { KPISummary, Auction } from "@/lib/types/database";
import { AUCTION_CATEGORIES } from "@/lib/types/database";
import Link from "next/link";

function parseCommissionRate(rate: string | null): number {
  if (!rate) return 0;
  const cleaned = rate.replace("%", "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed / 100;
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalBP, setTotalBP] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [recentAuctions, setRecentAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      let auctionQuery = supabase.from("auctions").select("*").order("date", { ascending: false });
      if (categoryFilter !== "all") {
        auctionQuery = auctionQuery.eq("auction_category", categoryFilter);
      }
      const { data: auctions } = await auctionQuery;

      if (!auctions) {
        setLoading(false);
        return;
      }

      const auctionIds = auctions.map((a) => a.id);
      let lots: { sold: boolean; hammer_price: number | null; commission_rate: string | null }[] = [];

      if (auctionIds.length > 0) {
        const { data: lotsData } = await supabase
          .from("lots")
          .select("sold, hammer_price, commission_rate")
          .in("auction_id", auctionIds);
        lots = lotsData ?? [];
      }

      const soldLots = lots.filter((l) => l.sold);
      const totalSold = soldLots.length;
      const totalHammerValue = soldLots.reduce((sum, l) => sum + (l.hammer_price ?? 0), 0);

      let commission = 0;
      let bp = 0;
      for (const lot of soldLots) {
        const hammer = lot.hammer_price ?? 0;
        commission += hammer * parseCommissionRate(lot.commission_rate);
        bp += hammer * 0.23;
      }

      setKpi({
        totalAuctions: auctions.length,
        totalLots: lots.length,
        totalSold,
        totalHammerValue,
        sellThroughRate: lots.length > 0 ? (totalSold / lots.length) * 100 : 0,
        averageLotValue: totalSold > 0 ? totalHammerValue / totalSold : 0,
      });

      setTotalCommission(commission);
      setTotalBP(bp);
      setTotalEarned(commission + bp);
      setRecentAuctions(auctions.slice(0, 5));
      setLoading(false);
    }
    loadData();
  }, [categoryFilter]);

  const stats = [
    {
      label: "Total auctions",
      value: kpi?.totalAuctions.toString() ?? "0",
      icon: Gavel,
      color: "text-gold-400",
      bg: "bg-gold-500/10",
      border: "border-gold-500/20",
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

  const financialStats = [
    {
      label: "Total commission",
      value: formatCurrency(totalCommission),
      icon: Receipt,
      color: "text-gold-400",
      bg: "bg-gold-500/10",
      border: "border-gold-500/20",
    },
    {
      label: "Total buyers premium",
      value: formatCurrency(totalBP),
      icon: PoundSterling,
      color: "text-gold-400",
      bg: "bg-gold-500/10",
      border: "border-gold-500/20",
    },
    {
      label: "Total earned",
      value: formatCurrency(totalEarned),
      icon: Wallet,
      color: "text-gold-300",
      bg: "bg-gold-500/15",
      border: "border-gold-400/30",
    },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="text-[#6687bc] text-sm mt-1">All-time auction performance summary</p>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === "all" ? "bg-gold-500 text-[#0e1e38]" : "bg-[#1e3a6b] text-[#94aed6] hover:text-[#f7f4ec]"}`}
          >
            All
          </button>
          {AUCTION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat ? "bg-gold-500 text-[#0e1e38]" : "bg-[#1e3a6b] text-[#94aed6] hover:text-[#f7f4ec]"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="card flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="stat-value">{stat.value}</p>
                  <p className="stat-label">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {financialStats.map((stat) => (
              <div key={stat.label} className="card flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center flex-shrink-0`}>
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

          {/* Recent auctions */}
          <div className="card">
            <h2 className="section-title mb-4">
              Recent auctions
              {categoryFilter !== "all" && (
                <span className="ml-2 badge badge-amber">{categoryFilter}</span>
              )}
            </h2>
            {recentAuctions.length === 0 ? (
              <div className="text-center py-12">
                <Gavel size={32} className="text-[#2f5597] mx-auto mb-3" />
                <p className="text-[#6687bc] text-sm">No auctions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left pb-3 px-4">Auction</th>
                      <th className="table-header text-left pb-3 px-4">Category</th>
                      <th className="table-header text-left pb-3 px-4">Date</th>
                      <th className="table-header text-right pb-3 px-4">Lots</th>
                      <th className="table-header text-right pb-3 px-4">Sold</th>
                      <th className="table-header text-right pb-3 px-4">Hammer value</th>
                      <th className="table-header text-right pb-3 px-4">Sell-through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAuctions.map((auction) => (
                      <tr key={auction.id} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell font-medium text-[#f7f4ec]">
                          <Link href={`/dashboard/auctions/${auction.id}`} className="hover:text-gold-400 transition-colors">
                            {auction.sale_number ? `${auction.sale_number} — ` : ""}{auction.name}
                          </Link>
                        </td>
                        <td className="table-cell">
                          {auction.auction_category ? (
                            <span className="badge badge-amber">{auction.auction_category}</span>
                          ) : "—"}
                        </td>
                        <td className="table-cell">
                          {new Date(auction.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="table-cell text-right">{auction.total_lots}</td>
                        <td className="table-cell text-right">{auction.lots_sold}</td>
                        <td className="table-cell text-right">{formatCurrency(auction.total_hammer_value)}</td>
                        <td className="table-cell text-right">
                          <span className={auction.total_lots > 0 && (auction.lots_sold / auction.total_lots) * 100 >= 70 ? "badge-green" : "badge-amber"}>
                            {auction.total_lots > 0 ? formatPercent((auction.lots_sold / auction.total_lots) * 100) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
