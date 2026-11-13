"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { Gavel, TrendingUp, PackageCheck, BarChart3, PoundSterling, Receipt, Wallet } from "lucide-react";
import type { Auction } from "@/lib/types/database";
import { AUCTION_CATEGORIES, OFFICES } from "@/lib/types/database";
import Link from "next/link";

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

type AuctionAgg = {
  auction: Auction;
  office: string;
  category: string;
  lots: number;
  sold: number;
  hammer: number;
  commission: number;
  bp: number;
};

type Totals = {
  auctions: number;
  lots: number;
  sold: number;
  hammer: number;
  commission: number;
  bp: number;
  earned: number;
};

function sumAggs(list: AuctionAgg[]): Totals {
  const t: Totals = { auctions: 0, lots: 0, sold: 0, hammer: 0, commission: 0, bp: 0, earned: 0 };
  for (const a of list) {
    t.auctions += 1;
    t.lots += a.lots;
    t.sold += a.sold;
    t.hammer += a.hammer;
    t.commission += a.commission;
    t.bp += a.bp;
  }
  t.earned = t.commission + t.bp;
  return t;
}

type BreakdownRow = {
  label: string;
  sublabel?: string;
  totals: Totals;
  emphasise?: boolean;
};

function BreakdownTable({
  title,
  subtitle,
  firstHeader,
  rows,
}: {
  title: string;
  subtitle?: string;
  firstHeader: string;
  rows: BreakdownRow[];
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e3a6b]">
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-xs text-[#6687bc] mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e3a6b]">
              <th className="table-header text-left py-3 px-6">{firstHeader}</th>
              <th className="table-header text-right py-3 px-6">Auctions</th>
              <th className="table-header text-right py-3 px-6">Lots sold</th>
              <th className="table-header text-right py-3 px-6">Hammer value</th>
              <th className="table-header text-right py-3 px-6">Commission</th>
              <th className="table-header text-right py-3 px-6">Buyers premium</th>
              <th className="table-header text-right py-3 px-6">Total earned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={
                  row.emphasise
                    ? "border-t-2 border-[#2f5597] bg-[#1e3a6b]/20"
                    : "border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors"
                }
              >
                <td className={`table-cell px-6 ${row.emphasise ? "font-semibold" : "font-medium"} text-[#f7f4ec]`}>
                  {row.label}
                  {row.sublabel && <span className="ml-2 text-xs font-normal text-[#6687bc]">{row.sublabel}</span>}
                </td>
                <td className="table-cell text-right px-6">{row.totals.auctions}</td>
                <td className="table-cell text-right px-6">{row.totals.sold.toLocaleString()}</td>
                <td className={`table-cell text-right px-6 ${row.emphasise ? "font-semibold text-[#f7f4ec]" : ""}`}>{formatCurrency(row.totals.hammer)}</td>
                <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(row.totals.commission)}</td>
                <td className="table-cell text-right px-6 text-gold-400">{formatCurrency(row.totals.bp)}</td>
                <td className="table-cell text-right px-6 font-medium text-gold-300">{formatCurrency(row.totals.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const pillClass = (active: boolean) =>
  `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
    active ? "bg-gold-500 text-[#0e1e38]" : "bg-[#1e3a6b] text-[#94aed6] hover:text-[#f7f4ec]"
  }`;

export default function DashboardPage() {
  const [aggs, setAggs] = useState<AuctionAgg[]>([]);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const currentYear = new Date().getFullYear();

  // Load every auction for the current year once; filtering happens in the browser
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const year = new Date().getFullYear();
      const { data: auctionRows } = await supabase
        .from("auctions")
        .select("*")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .order("date", { ascending: false });

      if (!auctionRows) {
        setLoading(false);
        return;
      }

      const auctionList = auctionRows as Auction[];
      const ids = auctionList.map((a) => a.id);

      // Paginated lots fetch, in chunks of auction ids
      const lots: { auction_id: string; sold: boolean; hammer_price: unknown; commission_rate: string | null }[] = [];
      for (let i = 0; i < ids.length; i += 40) {
        const idChunk = ids.slice(i, i + 40);
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("lots")
            .select("auction_id, sold, hammer_price, commission_rate")
            .in("auction_id", idChunk)
            .order("id", { ascending: true })
            .range(from, from + 999);
          if (error || !data || data.length === 0) break;
          lots.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }
      }

      // Commission + buyers premium per auction (sold lots only)
      const feesByAuction = new Map<string, { commission: number; bp: number }>();
      for (const lot of lots) {
        if (lot.sold !== true) continue;
        const hammer = toNum(lot.hammer_price);
        const entry = feesByAuction.get(lot.auction_id) ?? { commission: 0, bp: 0 };
        entry.commission += hammer * parseCommissionRate(lot.commission_rate);
        entry.bp += hammer * 0.23;
        feesByAuction.set(lot.auction_id, entry);
      }

      const result: AuctionAgg[] = auctionList.map((a) => {
        const fees = feesByAuction.get(a.id);
        return {
          auction: a,
          office: a.office ?? "London",
          category: a.auction_category ?? "Uncategorised",
          lots: toNum(a.total_lots),
          sold: toNum(a.lots_sold),
          hammer: toNum(a.total_hammer_value),
          commission: fees ? fees.commission : 0,
          bp: fees ? fees.bp : 0,
        };
      });

      setAggs(result);
      setLoading(false);
    }
    loadData();
  }, []);

  const matchesOffice = (a: AuctionAgg) => officeFilter === "all" || a.office === officeFilter;
  const matchesCategory = (a: AuctionAgg) => categoryFilter === "all" || a.category === categoryFilter;

  const filtered = aggs.filter((a) => matchesOffice(a) && matchesCategory(a));
  const officeFiltered = aggs.filter(matchesOffice);
  const categoryFiltered = aggs.filter(matchesCategory);

  const totals = sumAggs(filtered);
  const sellThrough = totals.lots > 0 ? (totals.sold / totals.lots) * 100 : 0;
  const avgLotValue = totals.sold > 0 ? totals.hammer / totals.sold : 0;
  const recentAuctions = filtered.slice(0, 5);

  // By office (respects the category filter)
  const officeRows: BreakdownRow[] = [
    ...OFFICES.map((o) => ({
      label: o,
      totals: sumAggs(categoryFiltered.filter((a) => a.office === o)),
    })),
    { label: "Combined", sublabel: "all offices", totals: sumAggs(categoryFiltered), emphasise: true },
  ];

  // By category (respects the office filter)
  const knownCategories = AUCTION_CATEGORIES as readonly string[];
  const uncategorised = officeFiltered.filter((a) => knownCategories.indexOf(a.category) === -1);
  const categoryRows: BreakdownRow[] = [
    ...AUCTION_CATEGORIES.map((c) => ({
      label: c,
      sublabel: c === "Entertainment" ? "pop culture excl. comics" : undefined,
      totals: sumAggs(officeFiltered.filter((a) => a.category === c)),
    })),
    ...(uncategorised.length > 0
      ? [{ label: "Uncategorised", totals: sumAggs(uncategorised) }]
      : []),
    { label: "Total", totals: sumAggs(officeFiltered), emphasise: true },
  ];

  const stats = [
    { label: "Total auctions", value: totals.auctions.toString(), icon: Gavel, color: "text-gold-400", bg: "bg-gold-500/10", border: "border-gold-500/20" },
    { label: "Total hammer value", value: formatCurrency(totals.hammer), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Sell-through rate", value: formatPercent(sellThrough), icon: PackageCheck, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: "Average lot value", value: formatCurrency(avgLotValue), icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  ];

  const financialStats = [
    { label: "Total commission", value: formatCurrency(totals.commission), icon: Receipt, color: "text-gold-400", bg: "bg-gold-500/10", border: "border-gold-500/20" },
    { label: "Total buyers premium", value: formatCurrency(totals.bp), icon: PoundSterling, color: "text-gold-400", bg: "bg-gold-500/10", border: "border-gold-500/20" },
    { label: "Total earned", value: formatCurrency(totals.earned), icon: Wallet, color: "text-gold-300", bg: "bg-gold-500/15", border: "border-gold-400/30" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="text-[#6687bc] text-sm mt-1">{currentYear} performance summary (all figures in £)</p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span className="text-xs text-[#6687bc] w-16">Office</span>
            <button onClick={() => setOfficeFilter("all")} className={pillClass(officeFilter === "all")}>All offices</button>
            {OFFICES.map((o) => (
              <button key={o} onClick={() => setOfficeFilter(o)} className={pillClass(officeFilter === o)}>{o}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span className="text-xs text-[#6687bc] w-16">Category</span>
            <button onClick={() => setCategoryFilter("all")} className={pillClass(categoryFilter === "all")}>All</button>
            {AUCTION_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={pillClass(categoryFilter === cat)}>{cat}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : (
        <>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="stat-label">Total lots offered</p>
              <p className="stat-value mt-1">{totals.lots.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="stat-label">Total lots sold</p>
              <p className="stat-value mt-1">{totals.sold.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="stat-label">Lots unsold</p>
              <p className="stat-value mt-1">{(totals.lots - totals.sold).toLocaleString()}</p>
            </div>
          </div>

          <BreakdownTable
            title="By office"
            subtitle={categoryFilter === "all" ? "London, Singapore and combined" : `${categoryFilter} only — London, Singapore and combined`}
            firstHeader="Office"
            rows={officeRows}
          />

          <BreakdownTable
            title="By category"
            subtitle={officeFilter === "all" ? "Both offices combined" : `${officeFilter} only`}
            firstHeader="Category"
            rows={categoryRows}
          />

          <div className="card">
            <h2 className="section-title mb-4">
              Recent auctions
              {officeFilter !== "all" && (<span className="ml-2 badge badge-green">{officeFilter}</span>)}
              {categoryFilter !== "all" && (<span className="ml-2 badge badge-amber">{categoryFilter}</span>)}
            </h2>
            {recentAuctions.length === 0 ? (
              <div className="text-center py-12">
                <Gavel size={32} className="text-[#2f5597] mx-auto mb-3" />
                <p className="text-[#6687bc] text-sm">No auctions found for {currentYear}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left pb-3 px-4">Auction</th>
                      <th className="table-header text-left pb-3 px-4">Office</th>
                      <th className="table-header text-left pb-3 px-4">Category</th>
                      <th className="table-header text-left pb-3 px-4">Date</th>
                      <th className="table-header text-right pb-3 px-4">Lots</th>
                      <th className="table-header text-right pb-3 px-4">Sold</th>
                      <th className="table-header text-right pb-3 px-4">Hammer value</th>
                      <th className="table-header text-right pb-3 px-4">Sell-through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAuctions.map((a) => (
                      <tr key={a.auction.id} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell font-medium text-[#f7f4ec]">
                          <Link href={`/dashboard/auctions/${a.auction.id}`} className="hover:text-gold-400 transition-colors">
                            {a.auction.sale_number ? `${a.auction.sale_number} — ` : ""}{a.auction.name}
                          </Link>
                        </td>
                        <td className="table-cell text-[#94aed6]">{a.office}</td>
                        <td className="table-cell">
                          {a.auction.auction_category ? (<span className="badge badge-amber">{a.auction.auction_category}</span>) : "—"}
                        </td>
                        <td className="table-cell">
                          {new Date(a.auction.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="table-cell text-right">{a.lots}</td>
                        <td className="table-cell text-right">{a.sold}</td>
                        <td className="table-cell text-right">{formatCurrency(a.hammer)}</td>
                        <td className="table-cell text-right">
                          <span className={a.lots > 0 && (a.sold / a.lots) * 100 >= 70 ? "badge-green" : "badge-amber"}>
                            {a.lots > 0 ? formatPercent((a.sold / a.lots) * 100) : "—"}
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
