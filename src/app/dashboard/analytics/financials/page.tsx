"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, type Auction } from "@/lib/types/database";
import { PoundSterling } from "lucide-react";

type FinancialRow = {
  auctionId: string;
  auctionName: string;
  saleNumber: string | null;
  auctionCategory: string | null;
  date: string;
  totalHammer: number;
  totalCommission: number;
  totalBP: number;
  totalEarned: number;
  lotCount: number;
};

type CategoryTotals = {
  category: string;
  totalHammer: number;
  totalCommission: number;
  totalBP: number;
  totalEarned: number;
};

function parseCommissionRate(rate: string | null): number {
  if (!rate) return 0;
  const cleaned = rate.replace("%", "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed / 100;
}

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[£$€,\s]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

async function fetchAllLots(
  supabase: ReturnType<typeof createClient>,
  auctionIds: string[]
) {
  const pageSize = 1000;
  const results: { auction_id: string; sold: boolean; hammer_price: unknown; commission_rate: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("lots")
      .select("auction_id, sold, hammer_price, commission_rate")
      .in("auction_id", auctionIds)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return results;
}

export default function FinancialsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const years = Array.from(new Set(auctions.map((a) => new Date(a.date).getFullYear()))).sort((a, b) => b - a);

  useEffect(() => {
    async function loadAuctions() {
      const { data } = await supabase.from("auctions").select("*").order("date", { ascending: false });
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

      let filteredAuctions = auctions;
      if (categoryFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => a.auction_category === categoryFilter);
      }
      if (yearFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => new Date(a.date).getFullYear() === parseInt(yearFilter));
      }

      if (filteredAuctions.length === 0) {
        setRows([]);
        setCategoryTotals([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);
      const allLots = await fetchAllLots(supabase, auctionIds);
      const lots = allLots.filter((l) => l.sold === true);

      const auctionMap = new Map<string, FinancialRow>();
      for (const auction of filteredAuctions) {
        auctionMap.set(auction.id, {
          auctionId: auction.id,
          auctionName: auction.name,
          saleNumber: auction.sale_number,
          auctionCategory: auction.auction_category,
          date: auction.date,
          totalHammer: toNum(auction.total_hammer_value),
          totalCommission: 0,
          totalBP: 0,
          totalEarned: 0,
          lotCount: auction.lots_sold,
        });
      }

      for (const lot of lots) {
        const row = auctionMap.get(lot.auction_id);
        if (!row) continue;
        const hammer = toNum(lot.hammer_price);
        const commRate = parseCommissionRate(lot.commission_rate);
        row.totalCommission += hammer * commRate;
        row.totalBP += hammer * 0.23;
      }

      Array.from(auctionMap.values()).forEach((row) => {
        row.totalEarned = row.totalCommission + row.totalBP;
      });

      const financialRows = Array.from(auctionMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRows(financialRows);

      const catMap = new Map<string, CategoryTotals>();
      for (const row of financialRows) {
        const cat = row.auctionCategory ?? "Uncategorised";
        const existing = catMap.get(cat) ?? { category: cat, totalHammer: 0, totalCommission: 0, totalBP: 0, totalEarned: 0 };
        catMap.set(cat, {
          category: cat,
          totalHammer: existing.totalHammer + row.totalHammer,
          totalCommission: existing.totalCommission + row.totalCommission,
          totalBP: existing.totalBP + row.totalBP,
          totalEarned: existing.totalEarned + row.totalEarned,
        });
      }
      setCategoryTotals(Array.from(catMap.values()).sort((a, b) => b.totalEarned - a.totalEarned));
      setLoading(false);
    }
    loadData();
  }, [categoryFilter, yearFilter, auctions]);

  const overallTotals = rows.reduce((acc, row) => ({
    totalHammer: acc.totalHammer + row.totalHammer,
    totalCommission: acc.totalCommission + row.totalCommission,
    totalBP: acc.totalBP + row.totalBP,
    totalEarned: acc.totalEarned + row.totalEarned,
  }), { totalHammer: 0, totalCommission: 0, totalBP: 0, totalEarned: 0 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Financials</h1>
        <p className="text-[#6687bc] text-sm mt-1">Commission, buyers premium and total earned by auction</p>
      </div>
      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Auction category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input">
              <option value="all">All categories</option>
              {AUCTION_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input">
              <option value="all">All years</option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <p className="stat-label">Total hammer value</p>
              <p className="stat-value mt-1">{formatCurrency(overallTotals.totalHammer)}</p>
            </div>
            <div className="card border-gold-500/30">
              <p className="stat-label">Total commission</p>
              <p className="stat-value mt-1 text-gold-400">{formatCurrency(overallTotals.totalCommission)}</p>
            </div>
            <div className="card border-gold-500/30">
              <p className="stat-label">Total buyers premium</p>
              <p className="stat-value mt-1 text-gold-400">{formatCurrency(overallTotals.totalBP)}</p>
            </div>
            <div className="card bg-gold-500/5 border-gold-500/40">
              <p className="stat-label">Total earned</p>
              <p className="stat-value mt-1 text-gold-300">{formatCurrency(overallTotals.totalEarned)}</p>
            </div>
          </div>
          {categoryTotals.length > 1 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1e3a6b]">
                <h2 className="section-title">By category</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left py-3 px-6">Category</th>
                      <th className="table-header text-right py-3 px-6">Hammer value</th>
                      <th className="table-header text-right py-3 px-6">Commission</th>
                      <th className="table-header text-right py-3 px-6">Buyers premium</th>
                      <th className="table-header text-right py-3 px-6">Total earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryTotals.map((cat) => (
                      <tr key={cat.category} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell px-6 font-medium text-[#f7f4ec]">
                          <span className="badge badge-amber">{cat.category}</span>
                        </td>
                        <td className="table-cell text-right px-6">{formatCurrency(cat.totalHammer)}</td>
                        <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(cat.totalCommission)}</td>
                        <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(cat.totalBP)}</td>
                        <td className="table-cell text-right px-6 font-medium text-gold-300">{formatCurrency(cat.totalEarned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e3a6b]">
              <h2 className="section-title">By auction</h2>
            </div>
            {rows.length === 0 ? (
              <div className="text-center py-12">
                <PoundSterling size={36} className="text-[#2f5597] mx-auto mb-3" />
                <p className="text-[#6687bc] text-sm">No financial data for this selection</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left py-3 px-6">Sale</th>
                      <th className="table-header text-left py-3 px-6">Category</th>
                      <th className="table-header text-left py-3 px-6">Date</th>
                      <th className="table-header text-right py-3 px-6">Lots sold</th>
                      <th className="table-header text-right py-3 px-6">Hammer value</th>
                      <th className="table-header text-right py-3 px-6">Commission</th>
                      <th className="table-header text-right py-3 px-6">Buyers premium</th>
                      <th className="table-header text-right py-3 px-6">Total earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.auctionId} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell px-6 font-medium text-[#f7f4ec]">
                          {row.saleNumber ? <span className="font-mono text-xs text-[#6687bc] mr-2">{row.saleNumber}</span> : null}
                          {row.auctionName}
                        </td>
                        <td className="table-cell px-6">
                          {row.auctionCategory ? <span className="badge badge-amber">{row.auctionCategory}</span> : "—"}
                        </td>
                        <td className="table-cell px-6">
                          {new Date(row.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="table-cell text-right px-6">{row.lotCount}</td>
                        <td className="table-cell text-right px-6">{formatCurrency(row.totalHammer)}</td>
                        <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(row.totalCommission)}</td>
                        <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(row.totalBP)}</td>
                        <td className="table-cell text-right px-6 font-medium text-gold-300">{formatCurrency(row.totalEarned)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#2f5597] bg-[#1e3a6b]/20">
                      <td className="table-cell px-6 font-semibold text-[#f7f4ec]" colSpan={4}>Total</td>
                      <td className="table-cell text-right px-6 font-semibold text-[#f7f4ec]">{formatCurrency(overallTotals.totalHammer)}</td>
                      <td className="table-cell text-right px-6 font-semibold text-gold-400">{formatCurrency(overallTotals.totalCommission)}</td>
                      <td className="table-cell text-right px-6 font-semibold text-gold-400">{formatCurrency(overallTotals.totalBP)}</td>
                      <td className="table-cell text-right px-6 font-semibold text-gold-300">{formatCurrency(overallTotals.totalEarned)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
