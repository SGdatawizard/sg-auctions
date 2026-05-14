"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatMultiplier,
  getSellThroughBadge,
} from "@/lib/utils/formatters";
import {
  ArrowLeft,
  TrendingUp,
  PackageCheck,
  Gavel,
  BarChart3,
} from "lucide-react";
import type { Auction, Lot, TopBuyer, TopVendor } from "@/lib/types/database";

export default function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [topBuyers, setTopBuyers] = useState<TopBuyer[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lots" | "buyers" | "vendors">("lots");
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: auctionData } = await supabase
        .from("auctions")
        .select("*")
        .eq("id", id)
        .single();

      if (!auctionData) {
        setLoading(false);
        return;
      }

      const { data: lotsData } = await supabase
        .from("lots")
        .select("*")
        .eq("auction_id", id)
        .order("lot_number", { ascending: true });

      setAuction(auctionData);
      const allLots = lotsData ?? [];
      setLots(allLots);

      const lotIds = allLots.map((l) => l.id);

      if (lotIds.length > 0) {
        const { data: lotBuyers } = await supabase
          .from("lot_buyers")
          .select("lot_id, buyer_id")
          .in("lot_id", lotIds);

        if (lotBuyers && lotBuyers.length > 0) {
          const buyerIds = Array.from(new Set(lotBuyers.map((lb) => lb.buyer_id)));

          const { data: buyerDetails } = await supabase
            .from("buyers")
            .select("id, name, email, country")
            .in("id", buyerIds);

          if (buyerDetails) {
            const soldLots = allLots.filter((l) => l.sold);
            const buyerSpend = new Map<string, { lots: number; spend: number }>();

            for (const lb of lotBuyers) {
              const lot = soldLots.find((l) => l.id === lb.lot_id);
              if (lot) {
                const existing = buyerSpend.get(lb.buyer_id) ?? { lots: 0, spend: 0 };
                buyerSpend.set(lb.buyer_id, {
                  lots: existing.lots + 1,
                  spend: existing.spend + (lot.hammer_price ?? 0),
                });
              }
            }

            const buyers: TopBuyer[] = buyerDetails
              .map((b) => ({
                id: b.id,
                name: b.name,
                email: b.email,
                country: b.country,
                totalLots: buyerSpend.get(b.id)?.lots ?? 0,
                totalSpend: buyerSpend.get(b.id)?.spend ?? 0,
              }))
              .sort((a, b) => b.totalSpend - a.totalSpend)
              .slice(0, 10);

            setTopBuyers(buyers);
          }
        }

        const { data: lotVendors } = await supabase
          .from("lot_vendors")
          .select("lot_id, vendor_id")
          .in("lot_id", lotIds);

        if (lotVendors && lotVendors.length > 0) {
          const vendorIds = Array.from(new Set(lotVendors.map((lv) => lv.vendor_id)));

          const { data: vendorDetails } = await supabase
            .from("vendors")
            .select("id, name, email, country")
            .in("id", vendorIds);

          if (vendorDetails) {
            const vendorStats = new Map<string, { lots: number; value: number }>();

            for (const lv of lotVendors) {
              const lot = allLots.find((l) => l.id === lv.lot_id);
              if (lot) {
                const existing = vendorStats.get(lv.vendor_id) ?? { lots: 0, value: 0 };
                vendorStats.set(lv.vendor_id, {
                  lots: existing.lots + 1,
                  value: existing.value + (lot.sold ? (lot.hammer_price ?? 0) : 0),
                });
              }
            }

            const vendors: TopVendor[] = vendorDetails
              .map((v) => ({
                id: v.id,
                name: v.name,
                email: v.email,
                country: v.country,
                totalLots: vendorStats.get(v.id)?.lots ?? 0,
                totalHammerValue: vendorStats.get(v.id)?.value ?? 0,
              }))
              .sort((a, b) => b.totalHammerValue - a.totalHammerValue)
              .slice(0, 10);

            setTopVendors(vendors);
          }
        }
      }

      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Loading...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Auction not found</p>
      </div>
    );
  }

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
      color: "text-gold-400",
      bg: "bg-gold-500/10",
      border: "border-gold-500/20",
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
      <div>
        <Link
          href="/dashboard/auctions"
          className="inline-flex items-center gap-1.5 text-[#6687bc] hover:text-[#f7f4ec] text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to auctions
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title">{auction.name}</h1>
              {auction.sale_number && (
                <span className="badge badge-amber">{auction.sale_number}</span>
              )}
              {auction.auction_category && (
                <span className="badge badge-green">{auction.auction_category}</span>
              )}
            </div>
            <p className="text-[#6687bc] text-sm mt-1">
              {formatDate(auction.date)}
              {auction.location ? ` · ${auction.location}` : ""}
            </p>
          </div>
          <span className={getSellThroughBadge(sellThrough)}>
            {formatPercent(sellThrough)} sell-through
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center flex-shrink-0`}>
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
        <div className="card">
          <h2 className="section-title mb-4">Top lots by hammer price</h2>
          {topLots.length === 0 ? (
            <p className="text-[#2f5597] text-sm">No sold lots recorded</p>
          ) : (
            <div className="space-y-3">
              {topLots.map((lot, i) => (
                <div key={lot.id} className="flex items-start gap-3 py-2 border-b border-[#1e3a6b]/50 last:border-0">
                  <span className="text-xs font-medium text-[#2f5597] w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#f7f4ec] truncate">{lot.title}</p>
                    <p className="text-xs text-[#6687bc] mt-0.5">
                      {lot.department ?? lot.category ?? "—"}
                      {lot.category && lot.department ? ` · ${lot.category}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-[#f7f4ec]">{formatCurrency(lot.hammer_price ?? 0)}</p>
                    <p className="text-xs text-[#6687bc]">{formatMultiplier(lot.hammer_price ?? 0, lot.estimate_low ?? 0, lot.estimate_high ?? 0)} est</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Results by category</h2>
          {categories.length === 0 ? (
            <p className="text-[#2f5597] text-sm">No category data</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#d9d0bc] font-medium">{cat.name}</span>
                    <span className="text-[#f7f4ec] font-medium">{formatCurrency(cat.value)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1e3a6b] rounded-full h-1.5">
                      <div
                        className="bg-gold-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${cat.total > 0 ? (cat.sold / cat.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#6687bc] w-16 text-right">{cat.sold}/{cat.total} sold</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3a6b] flex items-center justify-between">
          <div className="flex items-center gap-1 bg-[#0e1e38] rounded-lg p-1">
            {(["lots", "buyers", "vendors"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-gold-500 text-[#0e1e38]" : "text-[#94aed6] hover:text-[#f7f4ec]"}`}
              >
                {tab === "lots" ? `All lots (${lots.length})` : tab === "buyers" ? `Top buyers (${topBuyers.length})` : `Top vendors (${topVendors.length})`}
              </button>
            ))}
          </div>
          {activeTab === "lots" && (
            <div className="flex items-center gap-3">
              <span className="badge-green">{soldLots.length} sold</span>
              <span className="badge-red">{unsoldLots.length} unsold</span>
            </div>
          )}
        </div>

        {activeTab === "lots" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a6b]">
                  <th className="table-header text-left py-3 px-6">Lot</th>
                  <th className="table-header text-left py-3 px-6">Title</th>
                  <th className="table-header text-left py-3 px-6">Department</th>
                  <th className="table-header text-left py-3 px-6">Category</th>
                  <th className="table-header text-right py-3 px-6">Estimate</th>
                  <th className="table-header text-right py-3 px-6">Hammer</th>
                  <th className="table-header text-center py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                    <td className="table-cell px-6 text-[#6687bc] font-mono text-xs">{lot.lot_number}</td>
                    <td className="table-cell px-6 font-medium text-[#f7f4ec] max-w-xs truncate">{lot.title}</td>
                    <td className="table-cell px-6 text-[#94aed6]">{lot.department ?? "—"}</td>
                    <td className="table-cell px-6 text-[#94aed6]">{lot.category ?? "—"}</td>
                    <td className="table-cell text-right px-6 text-[#94aed6]">
                      {lot.estimate_low && lot.estimate_high ? `${formatCurrency(lot.estimate_low)} – ${formatCurrency(lot.estimate_high)}` : lot.estimate_low ? formatCurrency(lot.estimate_low) : "—"}
                    </td>
                    <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">{lot.hammer_price ? formatCurrency(lot.hammer_price) : "—"}</td>
                    <td className="table-cell text-center px-6">
                      <span className={lot.sold ? "badge-green" : "badge-red"}>{lot.sold ? "Sold" : "Unsold"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "buyers" && (
          <div className="overflow-x-auto">
            {topBuyers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#6687bc] text-sm">No buyer data for this auction</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e3a6b]">
                    <th className="table-header text-left py-3 px-6">Rank</th>
                    <th className="table-header text-left py-3 px-6">Buyer</th>
                    <th className="table-header text-left py-3 px-6">Email</th>
                    <th className="table-header text-left py-3 px-6">Country</th>
                    <th className="table-header text-right py-3 px-6">Lots bought</th>
                    <th className="table-header text-right py-3 px-6">Total spend</th>
                  </tr>
                </thead>
                <tbody>
                  {topBuyers.map((buyer, i) => (
                    <tr key={buyer.id} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                      <td className="table-cell px-6 text-[#6687bc] font-mono text-xs">{i + 1}</td>
                      <td className="table-cell px-6 font-medium text-[#f7f4ec]">{buyer.name ?? "—"}</td>
                      <td className="table-cell px-6 text-[#94aed6]">{buyer.email ?? "—"}</td>
                      <td className="table-cell px-6 text-[#94aed6]">{buyer.country ?? "—"}</td>
                      <td className="table-cell text-right px-6">{buyer.totalLots}</td>
                      <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">{formatCurrency(buyer.totalSpend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "vendors" && (
          <div className="overflow-x-auto">
            {topVendors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#6687bc] text-sm">No vendor data for this auction</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e3a6b]">
                    <th className="table-header text-left py-3 px-6">Rank</th>
                    <th className="table-header text-left py-3 px-6">Vendor</th>
                    <th className="table-header text-left py-3 px-6">Email</th>
                    <th className="table-header text-left py-3 px-6">Country</th>
                    <th className="table-header text-right py-3 px-6">Lots consigned</th>
                    <th className="table-header text-right py-3 px-6">Total hammer value</th>
                  </tr>
                </thead>
                <tbody>
                  {topVendors.map((vendor, i) => (
                    <tr key={vendor.id} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                      <td className="table-cell px-6 text-[#6687bc] font-mono text-xs">{i + 1}</td>
                      <td className="table-cell px-6 font-medium text-[#f7f4ec]">{vendor.name ?? "—"}</td>
                      <td className="table-cell px-6 text-[#94aed6]">{vendor.email ?? "—"}</td>
                      <td className="table-cell px-6 text-[#94aed6]">{vendor.country ?? "—"}</td>
                      <td className="table-cell text-right px-6">{vendor.totalLots}</td>
                      <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">{formatCurrency(vendor.totalHammerValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}