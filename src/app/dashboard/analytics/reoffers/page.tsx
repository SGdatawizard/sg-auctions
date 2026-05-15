"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, type Auction } from "@/lib/types/database";
import { RefreshCw } from "lucide-react";

type AuctionAppearance = {
  auctionId: string;
  auctionName: string;
  saleNumber: string | null;
  date: string;
  estimateLow: number | null;
  estimateHigh: number | null;
  lotNumber: string | null;
};

type ReofferRow = {
  stockNumber: string;
  title: string;
  description: string | null;
  category: string | null;
  department: string | null;
  auctionCategory: string | null;
  timesReoffered: number;
  appearances: AuctionAppearance[];
};

export default function ReoffersPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [reoffers, setReoffers] = useState<ReofferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadAuctions() {
      const { data } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: true });
      setAuctions(data ?? []);
    }
    loadAuctions();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (auctions.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // Filter auctions by category if needed
      const filteredAuctions = categoryFilter === "all"
        ? auctions
        : auctions.filter((a) => a.auction_category === categoryFilter);

      if (filteredAuctions.length === 0) {
        setReoffers([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);

      // Get ALL lots for these auctions that have a stock number
      const { data: allLots } = await supabase
        .from("lots")
        .select("id, stock_number, title, description, category, department, auction_id, sold, lot_number, estimate_low, estimate_high")
        .in("auction_id", auctionIds)
        .not("stock_number", "is", null);

      if (!allLots || allLots.length === 0) {
        setReoffers([]);
        setLoading(false);
        return;
      }

      // Build auction map for quick lookup
      const auctionMap = new Map(filteredAuctions.map((a) => [a.id, a]));

      // Group lots by stock number
      const stockMap = new Map<string, typeof allLots>();
      for (const lot of allLots) {
        if (!lot.stock_number) continue;
        const existing = stockMap.get(lot.stock_number) ?? [];
        existing.push(lot);
        stockMap.set(lot.stock_number, existing);
      }

      const result: ReofferRow[] = [];

      for (const [stockNumber, lots] of stockMap.entries()) {
        // If ANY appearance is sold, skip this stock number entirely
        const everSold = lots.some((l) => l.sold);
        if (everSold) continue;

        // Only include if it appears in 2+ auctions (i.e. been reoffered)
        const uniqueAuctionIds = Array.from(new Set(lots.map((l) => l.auction_id)));
        if (uniqueAuctionIds.length < 2) continue;

        // Build auction appearances sorted by date
        const appearances: AuctionAppearance[] = uniqueAuctionIds
          .map((aid) => {
            const auction = auctionMap.get(aid);
            const lot = lots.find((l) => l.auction_id === aid);
            if (!auction || !lot) return null;
            return {
              auctionId: aid,
              auctionName: auction.name,
              saleNumber: auction.sale_number,
              date: auction.date,
              estimateLow: lot.estimate_low,
              estimateHigh: lot.estimate_high,
              lotNumber: lot.lot_number,
            };
          })
          .filter(Boolean) as AuctionAppearance[];

        appearances.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Use the most recent lot for title/description/category
        const latestLot = lots.reduce((latest, lot) => {
          const latestAuction = auctionMap.get(latest.auction_id);
          const currentAuction = auctionMap.get(lot.auction_id);
          if (!latestAuction || !currentAuction) return latest;
          return new Date(currentAuction.date) > new Date(latestAuction.date) ? lot : latest;
        });

        const auctionCategory = auctionMap.get(latestLot.auction_id)?.auction_category ?? null;

        result.push({
          stockNumber,
          title: latestLot.title,
          description: latestLot.description,
          category: latestLot.category,
          department: latestLot.department,
          auctionCategory,
          timesReoffered: uniqueAuctionIds.length - 1,
          appearances,
        });
      }

      // Sort by most times reoffered first
      result.sort((a, b) => b.timesReoffered - a.timesReoffered);

      setReoffers(result);
      setLoading(false);
    }

    loadData();
  }, [categoryFilter, auctions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Re-offer tracker</h1>
        <p className="text-[#6687bc] text-sm mt-1">
          Lots that have gone unsold across multiple auctions — automatically removed once sold
        </p>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Auction category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input"
            >
              <option value="all">All categories</option>
              {AUCTION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="card-sm py-3 flex items-center gap-3 w-full">
              <RefreshCw size={16} className="text-gold-400" />
              <div>
                <p className="text-xs text-[#6687bc]">Active re-offers</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{reoffers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : reoffers.length === 0 ? (
        <div className="card text-center py-16">
          <RefreshCw size={36} className="text-[#2f5597] mx-auto mb-3" />
          <p className="text-[#6687bc] text-sm">No active re-offers found</p>
          <p className="text-[#2f5597] text-xs mt-1">
            Items appear here when the same stock number goes unsold in 2 or more auctions
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e3a6b] flex items-center justify-between">
            <h2 className="section-title">Active re-offers</h2>
            <span className="badge badge-red">{reoffers.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a6b]">
                  <th className="table-header text-left py-3 px-6">Stock no.</th>
                  <th className="table-header text-left py-3 px-6">Title</th>
                  <th className="table-header text-left py-3 px-6">Department</th>
                  <th className="table-header text-left py-3 px-6">Category</th>
                  <th className="table-header text-center py-3 px-6">Times reoffered</th>
                  <th className="table-header text-left py-3 px-6">Auction history & estimates</th>
                </tr>
              </thead>
              <tbody>
                {reoffers.map((item) => (
                  <tr
                    key={item.stockNumber}
                    className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors align-top"
                  >
                    <td className="table-cell px-6 font-mono text-xs text-[#6687bc] pt-4">
                      {item.stockNumber}
                    </td>
                    <td className="table-cell px-6 font-medium text-[#f7f4ec] max-w-[220px] pt-4">
                      <div className="truncate" title={item.title}>{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-[#6687bc] mt-0.5 truncate" title={item.description}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="table-cell px-6 text-[#94aed6] pt-4">
                      {item.department ?? "—"}
                    </td>
                    <td className="table-cell px-6 pt-4">
                      {item.category ?? "—"}
                    </td>
                    <td className="table-cell text-center px-6 pt-4">
                      <span className={`badge ${item.timesReoffered >= 3 ? "badge-red" : item.timesReoffered >= 2 ? "badge-amber" : "badge-green"}`}>
                        {item.timesReoffered}×
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="space-y-1.5">
                        {item.appearances.map((app, i) => (
                          <div key={app.auctionId} className="flex items-center gap-2 text-xs">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i === item.appearances.length - 1 ? "bg-gold-500 text-[#0e1e38]" : "bg-[#1e3a6b] text-[#6687bc]"}`}>
                              {i + 1}
                            </span>
                            <span className="text-[#6687bc] font-mono flex-shrink-0">
                              {app.saleNumber ?? "—"}
                            </span>
                            <span className="text-[#94aed6] flex-shrink-0">
                              {new Date(app.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <span className="text-[#f7f4ec] flex-shrink-0">
                              {app.estimateLow && app.estimateHigh
                                ? `${formatCurrency(app.estimateLow)} – ${formatCurrency(app.estimateHigh)}`
                                : app.estimateLow
                                ? formatCurrency(app.estimateLow)
                                : "No estimate"}
                            </span>
                            {i === item.appearances.length - 1 && (
                              <span className="text-gold-400 text-[10px]">← latest</span>
                            )}
                          </div>
                        ))}
                      </div>
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
