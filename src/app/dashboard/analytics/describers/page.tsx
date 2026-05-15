"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { ESTIMATE_RANGES, AUCTION_CATEGORIES, type DescriberSummary, type Auction } from "@/lib/types/database";
import { Users, FileSpreadsheet, Mail } from "lucide-react";
import * as XLSX from "xlsx";

type AuctionFilter = "all" | string;

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[£$€,\s]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export default function DescribersPage() {
  const [describers, setDescribers] = useState<DescriberSummary[]>([]);
  const [selected, setSelected] = useState<DescriberSummary | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [auctionFilter, setAuctionFilter] = useState<AuctionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: auctionRows } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: false });

      const { data: describerRows } = await supabase
        .from("describers")
        .select("id, name, email")
        .order("name");

      const { data: lotDescribers } = await supabase
        .from("lot_describers")
        .select("lot_id, describer_id");

      const { data: lots } = await supabase
        .from("lots")
        .select("id, sold, hammer_price, estimate_low, estimate_high, auction_id");

      if (!describerRows || !lotDescribers || !lots || !auctionRows) {
        setLoading(false);
        return;
      }

      setAuctions(auctionRows);

      const buildSummaries = (filteredAuctionIds: string[] | null) => {
        const filteredLots = filteredAuctionIds
          ? lots.filter((l) => filteredAuctionIds.includes(l.auction_id))
          : lots;

        const lotMap = new Map(filteredLots.map((l) => [l.id, l]));

        return describerRows.map((describer) => {
          const lotIds = lotDescribers
            .filter((ld) => ld.describer_id === describer.id)
            .map((ld) => ld.lot_id);

          const describerLots = lotIds
            .map((id) => lotMap.get(id))
            .filter(Boolean) as typeof filteredLots;

          const totalLots = describerLots.length;
          const soldLots = describerLots.filter((l) => l.sold);
          const totalSold = soldLots.length;
          const totalHammerValue = soldLots.reduce((sum, l) => sum + toNum(l.hammer_price), 0);
          const sellThroughRate = totalLots > 0 ? (totalSold / totalLots) * 100 : 0;

          const lotsWithEstimates = soldLots.filter((l) => l.estimate_low && l.estimate_high && l.hammer_price);
          const avgHammerVsEstimate = lotsWithEstimates.length > 0
            ? lotsWithEstimates.reduce((sum, l) => {
                const mid = (toNum(l.estimate_low) + toNum(l.estimate_high)) / 2;
                return sum + (mid > 0 ? toNum(l.hammer_price) / mid : 0);
              }, 0) / lotsWithEstimates.length
            : 0;

          const estimateRangeBreakdown = ESTIMATE_RANGES.map((range) => {
            const rangeLots = describerLots.filter((l) => {
              const mid = (toNum(l.estimate_low) + toNum(l.estimate_high)) / 2;
              if (mid < range.min) return false;
              if (range.max !== null && mid > range.max) return false;
              return true;
            });
            const rangeSold = rangeLots.filter((l) => l.sold).length;
            return {
              range: range.label,
              totalLots: rangeLots.length,
              totalSold: rangeSold,
              sellThroughRate: rangeLots.length > 0 ? (rangeSold / rangeLots.length) * 100 : 0,
            };
          });

          return {
            id: describer.id,
            name: describer.name,
            email: describer.email,
            totalLots,
            totalSold,
            totalHammerValue,
            sellThroughRate,
            averageHammerVsEstimate: avgHammerVsEstimate,
            estimateRangeBreakdown,
          };
        }).filter((d) => d.totalLots > 0)
          .sort((a, b) => b.totalHammerValue - a.totalHammerValue);
      };

      let filteredAuctionIds: string[] | null = null;
      if (auctionFilter !== "all" || categoryFilter !== "all") {
        let filtered = auctionRows;
        if (auctionFilter !== "all") filtered = filtered.filter((a) => a.id === auctionFilter);
        if (categoryFilter !== "all") filtered = filtered.filter((a) => a.auction_category === categoryFilter);
        filteredAuctionIds = filtered.map((a) => a.id);
      }

      const summaries = buildSummaries(filteredAuctionIds);
      setDescribers(summaries);
      if (summaries.length > 0) setSelected(summaries[0]);
      setLoading(false);
    }

    loadData();
  }, [auctionFilter, categoryFilter]);

  async function generateReport(describer: DescriberSummary) {
    setGenerating(true);
    try {
      const selectedAuction = auctionFilter !== "all" ? auctions.find((a) => a.id === auctionFilter) : null;
      const auctionLabel = selectedAuction
        ? `${selectedAuction.sale_number ? selectedAuction.sale_number + " — " : ""}${selectedAuction.name}`
        : "All Auctions";

      const summaryData = [
        ["SG Auctions — Describer Performance Report"],
        [""],
        ["Describer", describer.name],
        ["Auction", auctionLabel],
        ["Report generated", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
        [""],
        ["PERFORMANCE SUMMARY"],
        ["Total lots described", describer.totalLots],
        ["Total lots sold", describer.totalSold],
        ["Total unsold", describer.totalLots - describer.totalSold],
        ["Sell-through rate", `${describer.sellThroughRate.toFixed(1)}%`],
        ["Total hammer value", `£${describer.totalHammerValue.toLocaleString()}`],
        ["Avg hammer vs estimate", describer.averageHammerVsEstimate > 0 ? `${describer.averageHammerVsEstimate.toFixed(2)}x` : "—"],
        [""],
        ["SELL-THROUGH BY ESTIMATE RANGE"],
        ["Estimate Range", "Lots", "Sold", "Unsold", "Sell-through %"],
        ...describer.estimateRangeBreakdown.map((r) => [
          r.range, r.totalLots, r.totalSold, r.totalLots - r.totalSold,
          r.totalLots > 0 ? `${r.sellThroughRate.toFixed(1)}%` : "—",
        ]),
      ];

      let unsoldLotsData: (string | number | null)[][] = [
        ["LOT NO.", "SG NUMBER", "RECEIPT NO.", "TITLE", "ESTIMATE LOW", "ESTIMATE HIGH", "RESERVE", "VENDOR"],
      ];

      let auctionIds: string[] = [];
      if (auctionFilter !== "all") {
        auctionIds = [auctionFilter];
      } else if (categoryFilter !== "all") {
        auctionIds = auctions.filter((a) => a.auction_category === categoryFilter).map((a) => a.id);
      } else {
        auctionIds = auctions.map((a) => a.id);
      }

      if (auctionIds.length > 0) {
        const { data: unsoldLots } = await supabase
          .from("lots")
          .select("id, lot_number, stock_number, receipt_no, title, estimate_low, estimate_high, reserve")
          .in("auction_id", auctionIds)
          .eq("sold", false);

        if (unsoldLots && unsoldLots.length > 0) {
          const lotIds = unsoldLots.map((l) => l.id);
          const { data: lotDescribers } = await supabase
            .from("lot_describers")
            .select("lot_id, describer_id")
            .in("lot_id", lotIds)
            .eq("describer_id", describer.id);

          const describerLotIds = new Set((lotDescribers ?? []).map((ld) => ld.lot_id));
          const myUnsoldLots = unsoldLots.filter((l) => describerLotIds.has(l.id));

          if (myUnsoldLots.length > 0) {
            const { data: lotVendors } = await supabase
              .from("lot_vendors")
              .select("lot_id, vendor_id")
              .in("lot_id", myUnsoldLots.map((l) => l.id));

            const vendorIds = Array.from(new Set((lotVendors ?? []).map((lv) => lv.vendor_id)));
            const vendorMap = new Map<string, string>();
            if (vendorIds.length > 0) {
              const { data: vendors } = await supabase.from("vendors").select("id, name").in("id", vendorIds);
              if (vendors) { for (const v of vendors) { vendorMap.set(v.id, v.name ?? ""); } }
            }

            const lotToVendor = new Map<string, string>();
            for (const lv of lotVendors ?? []) {
              const name = vendorMap.get(lv.vendor_id);
              if (name) lotToVendor.set(lv.lot_id, name);
            }

            unsoldLotsData = [
              ...unsoldLotsData,
              ...myUnsoldLots
                .sort((a, b) => (a.lot_number ?? "").localeCompare(b.lot_number ?? ""))
                .map((lot) => [
                  lot.lot_number ?? "", lot.stock_number ?? "", lot.receipt_no ?? "", lot.title,
                  lot.estimate_low ?? "", lot.estimate_high ?? "", lot.reserve ?? "",
                  lotToVendor.get(lot.id) ?? "",
                ]),
            ];
          }
        }
      }

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      ws1["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Performance Summary");

      const ws2 = XLSX.utils.aoa_to_sheet(unsoldLotsData);
      ws2["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Unsold Lots");

      const filename = `${describer.name.replace(/\s+/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (describer.email) {
        const subject = encodeURIComponent(`Your Performance Report — ${auctionLabel}`);
        const body = encodeURIComponent(`Dear ${describer.name.split(" ")[0]},\n\nPlease find attached your performance report for ${auctionLabel}.\n\nThe report includes your sell-through summary, performance by estimate range, and a full list of unsold lots.\n\nKind regards`);
        setTimeout(() => { window.location.href = `mailto:${describer.email}?subject=${subject}&body=${body}`; }, 1000);
      }
    } catch (err) {
      console.error("Report generation error:", err);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Loading...</p>
      </div>
    );
  }

  if (describers.length === 0 && auctionFilter === "all" && categoryFilter === "all") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="page-title">Describers</h1>
          <p className="text-[#6687bc] text-sm mt-1">Performance breakdown by describer</p>
        </div>
        <div className="card text-center py-16">
          <Users size={36} className="text-[#2f5597] mx-auto mb-3" />
          <p className="text-[#6687bc] text-sm">No describer data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Describers</h1>
          <p className="text-[#6687bc] text-sm mt-1">Performance breakdown by describer</p>
        </div>
      </div>

      <div className="card flex items-center gap-4 py-4">
        <div className="flex-1">
          <label className="label">Filter by auction category</label>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setAuctionFilter("all"); }} className="input">
            <option value="all">All categories</option>
            {AUCTION_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Filter by auction</label>
          <select value={auctionFilter} onChange={(e) => setAuctionFilter(e.target.value)} className="input">
            <option value="all">All auctions</option>
            {auctions
              .filter((a) => categoryFilter === "all" || a.auction_category === categoryFilter)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.sale_number ? `${a.sale_number} — ` : ""}{a.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex-none pt-5">
          <button onClick={() => { setCategoryFilter("all"); setAuctionFilter("all"); }} className="btn-secondary text-sm">Clear filters</button>
        </div>
      </div>

      {describers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[#6687bc] text-sm">No describer data for this selection</p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e3a6b]">
              <h2 className="section-title">All describers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e3a6b]">
                    <th className="table-header text-left py-3 px-6">Describer</th>
                    <th className="table-header text-right py-3 px-6">Lots</th>
                    <th className="table-header text-right py-3 px-6">Sold</th>
                    <th className="table-header text-right py-3 px-6">Hammer value</th>
                    <th className="table-header text-right py-3 px-6">Sell-through</th>
                    <th className="table-header text-right py-3 px-6">Avg vs estimate</th>
                    <th className="table-header text-center py-3 px-6">Report</th>
                    <th className="table-header py-3 px-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {describers.map((d) => (
                    <tr
                      key={d.id}
                      className={`border-b border-[#1e3a6b]/50 transition-colors cursor-pointer ${selected?.id === d.id ? "bg-gold-500/5 border-l-2 border-l-gold-500" : "hover:bg-[#1e3a6b]/30"}`}
                      onClick={() => setSelected(d)}
                    >
                      <td className="table-cell px-6 font-medium text-[#f7f4ec]">{d.name}</td>
                      <td className="table-cell text-right px-6">{d.totalLots.toLocaleString()}</td>
                      <td className="table-cell text-right px-6">{d.totalSold.toLocaleString()}</td>
                      <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">{formatCurrency(d.totalHammerValue)}</td>
                      <td className="table-cell text-right px-6">
                        <span className={d.sellThroughRate >= 80 ? "badge-green" : d.sellThroughRate >= 60 ? "badge-amber" : "badge-red"}>
                          {formatPercent(d.sellThroughRate)}
                        </span>
                      </td>
                      <td className="table-cell text-right px-6">
                        <span className={d.averageHammerVsEstimate >= 1.2 ? "text-emerald-400" : d.averageHammerVsEstimate >= 0.9 ? "text-[#f7f4ec]" : "text-red-400"}>
                          {d.averageHammerVsEstimate > 0 ? `${d.averageHammerVsEstimate.toFixed(2)}x` : "—"}
                        </span>
                      </td>
                      <td className="table-cell text-center px-6" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => generateReport(d)}
                          disabled={generating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e3a6b] hover:bg-[#2f5597] text-[#f7f4ec] transition-colors disabled:opacity-50"
                        >
                          <FileSpreadsheet size={12} />
                          {generating ? "..." : "Export"}
                          {d.email && <Mail size={12} className="text-gold-400" />}
                        </button>
                      </td>
                      <td className="table-cell px-6">
                        <span className="text-gold-400 text-sm">{selected?.id === d.id ? "Selected" : "View →"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="section-title text-xl">{selected.name}</h2>
                  <span className="badge badge-amber">Estimate range breakdown</span>
                  {selected.email && (<span className="text-xs text-[#6687bc]">{selected.email}</span>)}
                </div>
                <button onClick={() => generateReport(selected)} disabled={generating} className="btn-primary flex items-center gap-2 text-sm">
                  <FileSpreadsheet size={14} />
                  {generating ? "Generating..." : "Generate & send report"}
                  {selected.email && <Mail size={14} />}
                </button>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card"><p className="stat-label">Total lots</p><p className="stat-value mt-1">{selected.totalLots.toLocaleString()}</p></div>
                <div className="card"><p className="stat-label">Total sold</p><p className="stat-value mt-1">{selected.totalSold.toLocaleString()}</p></div>
                <div className="card"><p className="stat-label">Total hammer value</p><p className="stat-value mt-1">{formatCurrency(selected.totalHammerValue)}</p></div>
                <div className="card"><p className="stat-label">Sell-through rate</p><p className="stat-value mt-1">{formatPercent(selected.sellThroughRate)}</p></div>
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#1e3a6b]">
                  <h3 className="section-title">Sell-through by estimate range</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e3a6b]">
                        <th className="table-header text-left py-3 px-6">Estimate range</th>
                        <th className="table-header text-right py-3 px-6">Lots</th>
                        <th className="table-header text-right py-3 px-6">Sold</th>
                        <th className="table-header text-right py-3 px-6">Unsold</th>
                        <th className="table-header text-right py-3 px-6">Sell-through</th>
                        <th className="table-header py-3 px-6 w-48">Visual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.estimateRangeBreakdown.map((r) => (
                        <tr key={r.range} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                          <td className="table-cell px-6 font-medium text-[#f7f4ec]">{r.range}</td>
                          <td className="table-cell text-right px-6">{r.totalLots}</td>
                          <td className="table-cell text-right px-6 text-emerald-400">{r.totalSold}</td>
                          <td className="table-cell text-right px-6 text-red-400">{r.totalLots - r.totalSold}</td>
                          <td className="table-cell text-right px-6">
                            {r.totalLots > 0 ? (
                              <span className={r.sellThroughRate >= 80 ? "badge-green" : r.sellThroughRate >= 60 ? "badge-amber" : "badge-red"}>
                                {formatPercent(r.sellThroughRate)}
                              </span>
                            ) : (<span className="text-[#2f5597]">—</span>)}
                          </td>
                          <td className="px-6 py-3">
                            {r.totalLots > 0 ? (
                              <div className="w-full bg-[#1e3a6b] rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${r.sellThroughRate >= 80 ? "bg-emerald-500" : r.sellThroughRate >= 60 ? "bg-gold-500" : "bg-red-500"}`} style={{ width: `${r.sellThroughRate}%` }} />
                              </div>
                            ) : (<div className="w-full bg-[#1e3a6b] rounded-full h-2" />)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
