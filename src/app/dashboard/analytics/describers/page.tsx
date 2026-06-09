"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { ESTIMATE_RANGES, AUCTION_CATEGORIES, type Auction } from "@/lib/types/database";
import { Users, FileSpreadsheet, Mail, Plus, X } from "lucide-react";
import * as XLSX from "xlsx";

type FilterType = "title" | "description" | "estimate_range" | "department" | "lot_category" | "receipt_no" | "stock_no";

type DynamicFilter = {
  id: string;
  type: FilterType;
  value: string;
};

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  title: "Title contains",
  description: "Description contains",
  estimate_range: "Estimate range",
  department: "Department",
  lot_category: "Lot category",
  receipt_no: "Receipt no. contains",
  stock_no: "Stock no. contains",
};

type RawLot = {
  id: string;
  sold: boolean;
  hammer_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  auction_id: string;
  title: string;
  description: string | null;
  department: string | null;
  category: string | null;
  lot_number: string | null;
  stock_number: string | null;
  receipt_no: string | null;
  reserve: number | null;
};

type DescriberRow = {
  id: string;
  name: string;
  email: string | null;
};

type DescriberSummary = {
  id: string;
  name: string;
  email: string | null;
  totalLots: number;
  totalSold: number;
  totalHammerValue: number;
  sellThroughRate: number;
  averageHammerVsEstimate: number;
  estimateRangeBreakdown: {
    range: string;
    totalLots: number;
    totalSold: number;
    sellThroughRate: number;
  }[];
};

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[£$€,\s]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function applyDynamicFilters(lots: RawLot[], filters: DynamicFilter[]): RawLot[] {
  const active = filters.filter((f) => f.value !== "");
  if (active.length === 0) return lots;
  return lots.filter((lot) =>
    active.every((f) => {
      switch (f.type) {
        case "title":
          return (lot.title ?? "").toLowerCase().includes(f.value.toLowerCase());
        case "description":
          return (lot.description ?? "").toLowerCase().includes(f.value.toLowerCase());
        case "receipt_no":
          return (lot.receipt_no ?? "").toLowerCase().includes(f.value.toLowerCase());
        case "stock_no":
          return (lot.stock_number ?? "").toLowerCase().includes(f.value.toLowerCase());
        case "department":
          return lot.department === f.value;
        case "lot_category":
          return lot.category === f.value;
        case "estimate_range": {
          const range = ESTIMATE_RANGES.find((r) => r.label === f.value);
          if (!range) return true;
          const mid = (toNum(lot.estimate_low) + toNum(lot.estimate_high)) / 2;
          if (mid < range.min) return false;
          if (range.max !== null && mid > range.max) return false;
          return true;
        }
        default:
          return true;
      }
    })
  );
}

function buildSummary(describer: DescriberRow, lots: RawLot[]): DescriberSummary {
  const totalLots = lots.length;
  const soldLots = lots.filter((l) => l.sold === true);
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
    const rangeLots = lots.filter((l) => {
      const mid = (toNum(l.estimate_low) + toNum(l.estimate_high)) / 2;
      if (mid < range.min) return false;
      if (range.max !== null && mid > range.max) return false;
      return true;
    });
    const rangeSold = rangeLots.filter((l) => l.sold === true).length;
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
}

export default function DescribersPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [auctionFilter, setAuctionFilter] = useState("all");
  const [describerFilter, setDescriberFilter] = useState("all");
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([]);
  const [describerRows, setDescriberRows] = useState<DescriberRow[]>([]);
  const [lotDescribers, setLotDescribers] = useState<{ lot_id: string; describer_id: string }[]>([]);
  const [allLots, setAllLots] = useState<RawLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [lotCategories, setLotCategories] = useState<string[]>([]);
  const supabase = createClient();

  const years = Array.from(new Set(auctions.map((a) => new Date(a.date).getFullYear()))).sort((a, b) => b - a);

  const filteredAuctionList = auctions.filter((a) => {
    if (categoryFilter !== "all" && a.auction_category !== categoryFilter) return false;
    if (yearFilter !== "all" && new Date(a.date).getFullYear() !== parseInt(yearFilter)) return false;
    return true;
  });

  useEffect(() => {
    async function loadStatic() {
      const { data: auctionRows } = await supabase.from("auctions").select("*").order("date", { ascending: false });
      setAuctions(auctionRows ?? []);
      const { data: dRows } = await supabase.from("describers").select("id, name, email").order("name");
      setDescriberRows(dRows ?? []);
    }
    loadStatic();
  }, []);

  useEffect(() => {
    if (categoryFilter === "all") {
      setAllLots([]);
      setLotDescribers([]);
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);

      let filteredAuctions = auctions.filter((a) => a.auction_category === categoryFilter);
      if (yearFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => new Date(a.date).getFullYear() === parseInt(yearFilter));
      }
      if (auctionFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => a.id === auctionFilter);
      }

      if (filteredAuctions.length === 0) {
        setAllLots([]);
        setLotDescribers([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);

      const lots: RawLot[] = [];
      {
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("lots")
            .select("id, sold, hammer_price, estimate_low, estimate_high, auction_id, title, description, department, category, lot_number, stock_number, receipt_no, reserve")
            .in("auction_id", auctionIds)
            .range(from, from + 999);
          if (error || !data || data.length === 0) break;
          lots.push(...(data as RawLot[]));
          if (data.length < 1000) break;
          from += 1000;
        }
      }

      setAllLots(lots);

      const depts = Array.from(new Set(lots.map((l) => l.department).filter((d): d is string => d !== null))).sort();
      const cats = Array.from(new Set(lots.map((l) => l.category).filter((c): c is string => c !== null))).sort();
      setDepartments(depts);
      setLotCategories(cats);

      const lotIds = lots.map((l) => l.id);
      const lds: { lot_id: string; describer_id: string }[] = [];
      for (let i = 0; i < lotIds.length; i += 200) {
        const chunk = lotIds.slice(i, i + 200);
        const { data } = await supabase.from("lot_describers").select("lot_id, describer_id").in("lot_id", chunk);
        if (data) lds.push(...data);
      }
      setLotDescribers(lds);
      setLoading(false);
    }

    if (auctions.length > 0) loadData();
  }, [categoryFilter, yearFilter, auctionFilter, auctions]);

  const buildDescribers = (): DescriberSummary[] => {
    if (categoryFilter === "all" || allLots.length === 0) return [];
    const lotMap = new Map(allLots.map((l) => [l.id, l]));
    return describerRows.map((describer) => {
      const myLotIds = lotDescribers
        .filter((ld) => ld.describer_id === describer.id)
        .map((ld) => ld.lot_id);
      let myLots = myLotIds.map((id) => lotMap.get(id)).filter(Boolean) as RawLot[];
      if (describerFilter === describer.id && dynamicFilters.length > 0) {
        myLots = applyDynamicFilters(myLots, dynamicFilters);
      }
      if (myLots.length === 0) return null;
      return buildSummary(describer, myLots);
    }).filter((d): d is DescriberSummary => d !== null && d.totalLots > 0)
      .sort((a, b) => b.totalHammerValue - a.totalHammerValue);
  };

  const allDescribers = buildDescribers();
  const filteredDescribers = describerFilter === "all" ? allDescribers : allDescribers.filter((d) => d.id === describerFilter);
  const selected = filteredDescribers.find((d) => d.id === describerFilter) ?? filteredDescribers[0] ?? null;

  async function generateReport(describer: DescriberSummary) {
    setGenerating(true);
    try {
      const selectedAuction = auctionFilter !== "all" ? auctions.find((a) => a.id === auctionFilter) : null;
      const auctionLabel = selectedAuction
        ? `${selectedAuction.sale_number ? selectedAuction.sale_number + " — " : ""}${selectedAuction.name}`
        : categoryFilter !== "all" ? categoryFilter : "All Auctions";

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

      const myLotIds = lotDescribers.filter((ld) => ld.describer_id === describer.id).map((ld) => ld.lot_id);
      const lotMap = new Map(allLots.map((l) => [l.id, l]));
      let myLots = myLotIds.map((id) => lotMap.get(id)).filter(Boolean) as RawLot[];
      if (dynamicFilters.length > 0) myLots = applyDynamicFilters(myLots, dynamicFilters);
      const myUnsoldLots = myLots.filter((l) => l.sold === false);

      let unsoldLotsData: (string | number | null)[][] = [
        ["LOT NO.", "SG NUMBER", "RECEIPT NO.", "TITLE", "ESTIMATE LOW", "ESTIMATE HIGH", "RESERVE", "VENDOR"],
      ];

      if (myUnsoldLots.length > 0) {
        const unsoldIds = myUnsoldLots.map((l) => l.id);
        const lotVendors: { lot_id: string; vendor_id: string }[] = [];
        for (let i = 0; i < unsoldIds.length; i += 200) {
          const chunk = unsoldIds.slice(i, i + 200);
          const { data } = await supabase.from("lot_vendors").select("lot_id, vendor_id").in("lot_id", chunk);
          if (data) lotVendors.push(...data);
        }
        const vendorIds = Array.from(new Set(lotVendors.map((lv) => lv.vendor_id)));
        const vendorMap = new Map<string, string>();
        if (vendorIds.length > 0) {
          const { data: vendors } = await supabase.from("vendors").select("id, name").in("id", vendorIds);
          if (vendors) { for (const v of vendors) { vendorMap.set(v.id, v.name ?? ""); } }
        }
        const lotToVendor = new Map<string, string>();
        for (const lv of lotVendors) {
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

  const addDynamicFilter = () => {
    setDynamicFilters((prev) => [...prev, { id: Math.random().toString(36).slice(2), type: "title", value: "" }]);
  };
  const removeDynamicFilter = (id: string) => {
    setDynamicFilters((prev) => prev.filter((f) => f.id !== id));
  };
  const updateDynamicFilter = (id: string, updates: Partial<DynamicFilter>) => {
    setDynamicFilters((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Describers</h1>
        <p className="text-[#6687bc] text-sm mt-1">Performance breakdown by describer</p>
      </div>

      <div className="card space-y-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="label">Auction category <span className="text-red-400">*</span></label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setAuctionFilter("all"); setDescriberFilter("all"); setDynamicFilters([]); }}
              className="input"
            >
              <option value="all">Select a category...</option>
              {AUCTION_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setAuctionFilter("all"); setDescriberFilter("all"); setDynamicFilters([]); }}
              className="input"
              disabled={categoryFilter === "all"}
            >
              <option value="all">All years</option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Auction</label>
            <select
              value={auctionFilter}
              onChange={(e) => { setAuctionFilter(e.target.value); setDescriberFilter("all"); setDynamicFilters([]); }}
              className="input"
              disabled={categoryFilter === "all"}
            >
              <option value="all">All auctions</option>
              {filteredAuctionList.map((a) => (
                <option key={a.id} value={a.id}>{a.sale_number ? `${a.sale_number} — ` : ""}{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Describer</label>
            <select
              value={describerFilter}
              onChange={(e) => { setDescriberFilter(e.target.value); setDynamicFilters([]); }}
              className="input"
              disabled={categoryFilter === "all"}
            >
              <option value="all">All describers</option>
              {allDescribers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {describerFilter !== "all" && (
          <div className="space-y-3 pt-3 border-t border-[#1e3a6b]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6687bc] font-medium">Additional filters — all combine with AND logic, stats update in real time</p>
              <button
                onClick={addDynamicFilter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e3a6b] hover:bg-[#2f5597] text-[#f7f4ec] transition-colors"
              >
                <Plus size={12} />
                Add filter
              </button>
            </div>
            {dynamicFilters.map((filter) => (
              <div key={filter.id} className="flex items-center gap-3">
                <select
                  value={filter.type}
                  onChange={(e) => updateDynamicFilter(filter.id, { type: e.target.value as FilterType, value: "" })}
                  className="input w-52 flex-shrink-0"
                >
                  {(Object.entries(FILTER_TYPE_LABELS) as [FilterType, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {filter.type === "estimate_range" ? (
                  <select value={filter.value} onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })} className="input flex-1">
                    <option value="">Select range...</option>
                    {ESTIMATE_RANGES.map((r) => (<option key={r.label} value={r.label}>{r.label}</option>))}
                  </select>
                ) : filter.type === "department" ? (
                  <select value={filter.value} onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })} className="input flex-1">
                    <option value="">Select department...</option>
                    {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                ) : filter.type === "lot_category" ? (
                  <select value={filter.value} onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })} className="input flex-1">
                    <option value="">Select category...</option>
                    {lotCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })}
                    placeholder={`${FILTER_TYPE_LABELS[filter.type]}...`}
                    className="input flex-1"
                  />
                )}
                <button
                  onClick={() => removeDynamicFilter(filter.id)}
                  className="p-2 rounded-lg text-[#6687bc] hover:text-red-400 hover:bg-red-900/10 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={() => { setCategoryFilter("all"); setYearFilter("all"); setAuctionFilter("all"); setDescriberFilter("all"); setDynamicFilters([]); }}
            className="btn-secondary text-sm"
          >
            Clear all filters
          </button>
        </div>
      </div>

      {categoryFilter === "all" ? (
        <div className="card text-center py-16">
          <Users size={36} className="text-[#2f5597] mx-auto mb-3" />
          <p className="text-[#f7f4ec] text-sm font-medium">Select an auction category to load describer data</p>
          <p className="text-[#6687bc] text-xs mt-1">Choose Stamps, Coins or Pop Culture above to get started</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : filteredDescribers.length === 0 ? (
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
                  {(describerFilter === "all" ? allDescribers : filteredDescribers).map((d) => (
                    <tr
                      key={d.id}
                      className={`border-b border-[#1e3a6b]/50 transition-colors cursor-pointer ${selected?.id === d.id ? "bg-gold-500/5 border-l-2 border-l-gold-500" : "hover:bg-[#1e3a6b]/30"}`}
                      onClick={() => setDescriberFilter(d.id)}
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
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="section-title text-xl">{selected.name}</h2>
                  <span className="badge badge-amber">Estimate range breakdown</span>
                  {selected.email && (<span className="text-xs text-[#6687bc]">{selected.email}</span>)}
                  {dynamicFilters.filter((f) => f.value).length > 0 && (
                    <span className="badge badge-green">{dynamicFilters.filter((f) => f.value).length} filter{dynamicFilters.filter((f) => f.value).length !== 1 ? "s" : ""} active</span>
                  )}
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
