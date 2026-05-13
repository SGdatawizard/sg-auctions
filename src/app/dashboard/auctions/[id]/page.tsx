import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatMultiplier,
  getSellThroughBadge,
} from "@/lib/utils/formatters";
import { ArrowLeft, TrendingUp, PackageCheck, Gavel, BarChart3 } from "lucide-react";

async function getAuction(id: string) {
  const supabase = await createClient();

  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .single();

  if (!auction) return null;

  const { data: lots } = await supabase
    .from("lots")
    .select("*")
    .eq("auction_id", id)
    .order("lot_number", { ascending: true });

  return { auction, lots: lots ?? [] };
}

export default async function AuctionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getAuction(params.id);

  if (!data) notFound();

  const { auction, lots } = data;

  const sellThrough =
    auction.total_lots > 0
      ? (auction.lots_sold / auction.total_lots) * 100
      : 0;

  const avgHammer =
    auction.lots_sold > 0
      ? auction.total_hammer_value / auction.lots_sold
      : 0;

  const soldLots = lots.filter((l) => l.sold);
  const unsoldLots = lots.filter((l) => !l.sold);

  const topLots = [...soldLots]
    .sort((a, b) => (b.hammer_price ?? 0) - (a.hammer_price ?? 0))
    .slice(0, 5);

  const categoryMap = new Map<string, { sold: number; total: number; value: number }>();
  for (const lot of lots) {
    const cat = lot.category ?? "Uncategorised";
    const existing = categoryMap.get(cat) ?? { sold: 0, total: 0, value: 0 };
    categoryMap.set(cat, {
      total: existing.total + 1,
      sold: existing.sold + (lot.sold ? 1 : 0),
      value: existing.value + (lot.sold ? (lot.hammer_price ?? 0) : 0),
    });
  }
  const categories = Array.from(categoryMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.value - a.value);

  const stats = [
    {
      label: "Total hammer value",
      value: formatCurrency(auction.total_hammer_value),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Sell-through rate",
      value: formatPercent(sellThrough),
      icon: PackageCheck,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Lots offered",
      value: auction.total_lots.toLocaleString(),
      icon: Gavel,
      color: "text-brand-400",
      bg: "bg-brand-500/10",
      border: "border-brand-500/20",
    },
    {
      label: "Average lot value",
      value: formatCurrency(avgHammer),
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
        <Link
          href="/dashboard/auctions"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to auctions
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">{auction.name}</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {formatDate(auction.date)}
              {auction.location ? ` · ${auction.location}` : ""}
            </p>
          </div>
          <span className={getSellThroughBadge(sellThrough)}>
            {formatPercent(sellThrough)} sell-through
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-start gap-4">
            <div
              className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center flex-shrink-0`}
            >
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="stat-value text-2xl">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Top lots */}
        <div className="card">
          <h2 className="section-title mb-4">Top lots by hammer price</h2>
          {topLots.length === 0 ? (
            <p className="text-zinc-600 text-sm">No sold lots recorded</p>
          ) : (
            <div className="space-y-3">
              {topLots.map((lot, i) => (
                <div
                  key={lot.id}
                  className="flex items-start gap-3 py-2 border-b border-zinc-800/50 last:border-0"
                >
                  <span className="text-xs font-medium text-zinc-600 w-5 flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {lot.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {lot.artist ?? "Unknown artist"}
                      {lot.category ? ` · ${lot.category}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-zinc-100">
                      {formatCurrency(lot.hammer_price ?? 0)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatMultiplier(
                        lot.hammer_price ?? 0,
                        lot.estimate_low ?? 0,
                        lot.estimate_high ?? 0
                      )}{" "}
                      est
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="card">
          <h2 className="section-title mb-4">Results by category</h2>
          {categories.length === 0 ? (
            <p className="text-zinc-600 text-sm">No category data</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 font-medium">{cat.name}</span>
                    <span className="text-zinc-100 font-medium">
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-brand-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${cat.total > 0 ? (cat.sold / cat.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-16 text-right">
                      {cat.sold}/{cat.total} sold
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Full lots table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="section-title">All lots</h2>
          <div className="flex items-center gap-3">
            <span className="badge-green">{soldLots.length} sold</span>
            <span className="badge-red">{unsoldLots.length} unsold</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header text-left py-3 px-6">Lot</th>
                <th className="table-header text-left py-3 px-6">Title</th>
                <th className="table-header text-left py-3 px-6">Artist</th>
                <th className="table-header text-left py-3 px-6">Category</th>
                <th className="table-header text-right py-3 px-6">Estimate</th>
                <th className="table-header text-right py-3 px-6">Hammer</th>
                <th className="table-header text-center py-3 px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr
                  key={lot.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="table-cell px-6 text-zinc-500 font-mono text-xs">
                    {lot.lot_number}
                  </td>
                  <td className="table-cell px-6 font-medium text-zinc-100 max-w-xs truncate">
                    {lot.title}
                  </td>
                  <td className="table-cell px-6 text-zinc-400">
                    {lot.artist ?? "—"}
                  </td>
                  <td className="table-cell px-6">
                    {lot.category ?? "—"}
                  </td>
                  <td className="table-cell text-right px-6 text-zinc-400">
                    {lot.estimate_low && lot.estimate_high
                      ? `${formatCurrency(lot.estimate_low)} – ${formatCurrency(lot.estimate_high)}`
                      : lot.estimate_low
                      ? formatCurrency(lot.estimate_low)
                      : "—"}
                  </td>
                  <td className="table-cell text-right px-6 font-medium text-zinc-100">
                    {lot.hammer_price ? formatCurrency(lot.hammer_price) : "—"}
                  </td>
                  <td className="table-cell text-center px-6">
                    <span className={lot.sold ? "badge-green" : "badge-red"}>
                      {lot.sold ? "Sold" : "Unsold"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
