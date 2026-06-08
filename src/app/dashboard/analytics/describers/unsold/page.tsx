"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, ESTIMATE_RANGES, type Auction, maskName } from "@/lib/types/database";
import { PackageX, Plus, X } from "lucide-react";

type UnsoldLotRow = {
  lotId: string;
  lotNumber: string | null;
  stockNumber: string | null;
  receiptNo: string | null;
  title: string;
  description: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  reserve: number | null;
  vendorName: string | null;
  department: string | null;
  lotCategory: string | null;
};

type DescriberUnsold = {
  describerId: string;
  describerName: string;
  lots: UnsoldLotRow[];
};

type DynamicFilter = {
  id: string;
  type: "title" | "description" | "estimate_range" | "department" | "lot_category" | "receipt_no" | "stock_no";
  value: string;
};

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[£$€,\s]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

const FILTER_TYPE_LABELS: Record<DynamicFilter["type"], string> = {
  title: "Title contains",
  description: "Description contains",
  estimate_range: "Estimate range",
  department: "Department",
  lot_category: "Lot category",
  receipt_no: "Receipt no. contains",
  stock_no: "Stock no. contains",
};

export default function UnsoldLotsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [auctionFilter, setAuctionFilter] = useState("all");
  const [describerFilter, setDescriberFilter] = useState("all");
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([]);
  const [describerData, setDescriberData] = useState<DescriberUnsold[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [lotCategories, setLotCategories] = useState<string[]>([]);
  const supabase = createClient();

  // Derive available years from auctions
  const years = Array.from(new Set(auctions.map((a) => new Date(a.date).getFullYear()))).sort((a, b) => b - a);

  // Filtered auctions for dropdowns
  const filteredAuctionList = auctions.filter((a) => {
    if (categoryFilter !== "all" && a.auction_category !== categoryFilter) return false;
    if (yearFilter !== "all" && new Date(a.date).getFullYear() !== parseInt(yearFilter)) return false;
    return true;
  });

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
      if (auctionFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => a.id === auctionFilter);
      }

      if (filteredAuctions.length === 0) {
        setDescriberData([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);

      // Paginated unsold lots fetch
      const unsoldLots: {
        id: string; lot_number: string | null; stock_number: string | null;
        receipt_no: string | null; title: string; description: string | null;
        estimate_low: number | null; estimate_high: number | null;
        reserve: number | null; auction_id: string;
        department: string | null; category: string | null;
      }[] = [];
      {
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("lots")
            .select("id, lot_number, stock_number, receipt_no, title, description, estimate_low, estimate_high, reserve, auction_id, department, category")
            .in("auction_id", auctionIds)
            .range(from, from + 999);
          if (error || !data || data.length === 0) break;
          // Filter unsold in JS to avoid boolean quirk
          unsoldLots.push(...data.filter((l: { sold: boolean }) => l.sold === false));
          if (data.length < 1000) break;
          from += 1000;
        }
      }

      if (unsoldLots.length === 0) {
        setDescriberData([]);
        setLoading(false);
        return;
      }

      // Extract unique departments and lot categories for filter dropdowns
      const depts = Array.from(new Set(unsoldLots.map((l) => l.department).filter(Boolean) as string[])).sort();
      const cats = Array.from(new Set(unsoldLots.map((l) => l.category).filter(Boolean) as string[])).sort();
      setDepartments(depts);
      setLotCategories(cats);

      const lotIds = unsoldLots.map((l) => l.id);

      // Vendors
      const { data: lotVendors } = await supabase.from("lot_vendors").select("lot_id, vendor_id").in("lot_id", lotIds);
      const vendorIds = Array.from(new Set((lotVendors ?? []).map((lv) => lv.vendor_id)));
      const vendorMap = new Map<string, string | null>();
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase.from("vendors").select("id, name").in("id", vendorIds);
        if (vendors) { for (const v of vendors) { vendorMap.set(v.id, v.name); } }
      }
      const lotToVendor = new Map<string, string | null>();
      for (const lv of lotVendors ?? []) {
        lotToVendor.set(lv.lot_id, vendorMap.get(lv.vendor_id) ?? null);
      }

      // Describers
      const { data: lotDescribers } = await supabase.from("lot_describers").select("lot_id, describer_id").in("lot_id", lotIds);
      const describerIds = Array.from(new Set((lotDescribers ?? []).map((ld) => ld.describer_id)));
      const describerMap = new Map<string, string>();
      if (describerIds.length > 0) {
        const { data: describers } = await supabase.from("describers").select("id, name").in("id", describerIds);
        if (describers) { for (const d of describers) { describerMap.set(d.id, d.name); } }
      }

      // Build describer → lots map
      const describerToLots = new Map<string, { id: string; name: string; lots: UnsoldLotRow[] }>();
      for (const ld of lotDescribers ?? []) {
        const lot = unsoldLots.find((l) => l.id === ld.lot_id);
        if (!lot) continue;
        const describerName = describerMap.get(ld.describer_id) ?? "Unknown";
        const unsoldRow: UnsoldLotRow = {
          lotId: lot.id,
          lotNumber: lot.lot_number,
          stockNumber: lot.stock_number,
          receiptNo: lot.receipt_no,
          title: lot.title,
          description: lot.description,
          estimateLow: lot.estimate_low,
          estimateHigh: lot.estimate_high,
          reserve: lot.reserve,
          vendorName: lotToVendor.get(lot.id) ?? null,
          department: lot.department,
          lotCategory: lot.category,
        };
        const existing = describerToLots.get(ld.describer_id);
        if (existing) {
          existing.lots.push(unsoldRow);
        } else {
          describerToLots.set(ld.describer_id, { id: ld.describer_id, name: describerName, lots: [unsoldRow] });
        }
      }

      const result: DescriberUnsold[] = Array.from(describerToLots.values())
        .map((d) => ({
          describerId: d.id,
          describerName: d.name,
          lots: d.lots.sort((a, b) => (a.lotNumber ?? "").localeCompare(b.lotNumber ?? "")),
        }))
        .sort((a, b) => b.lots.length - a.lots.length);

      setDescriberData(result);
      setLoading(false);
    }

    loadData();
  }, [auctionFilter, categoryFilter, yearFilter, auctions]);

  // Apply all filters client-side
  const getFilteredData = (): DescriberUnsold[] => {
    let data = describerData;

    // Describer filter
    if (describerFilter !== "all") {
      data = data.filter((d) => d.describerId === describerFilter);
    }

    // Dynamic filters — only apply if a describer is selected
    if (describerFilter !== "all" && dynamicFilters.length > 0) {
      data = data.map((d) => ({
        ...d,
        lots: d.lots.filter((lot) => {
          return dynamicFilters.every((f) => {
            switch (f.type) {
              case "title":
                return lot.title.toLowerCase().includes(f.value.toLowerCase());
              case "description":
                return (lot.description ?? "").toLowerCase().includes(f.value.toLowerCase());
              case "receipt_no":
                return (lot.receiptNo ?? "").toLowerCase().includes(f.value.toLowerCase());
              case "stock_no":
                return (lot.stockNumber ?? "").toLowerCase().includes(f.value.toLowerCase());
              case "department":
                return lot.department === f.value;
              case "lot_category":
                return lot.lotCategory === f.value;
              case "estimate_range": {
                const range = ESTIMATE_RANGES.find((r) => r.label === f.value);
                if (!range) return true;
                const mid = (toNum(lot.estimateLow) + toNum(lot.estimateHigh)) / 2;
                if (mid < range.min) return false;
                if (range.max !== null && mid > range.max) return false;
                return true;
              }
              default:
                return true;
            }
          });
        }),
      })).filter((d) => d.lots.length > 0);
    }

    return data;
  };

  const filteredData = getFilteredData();
  const totalUnsold = filteredData.reduce((sum, d) => sum + d.lots.length, 0);

  // Estimate range breakdown for filtered data
  const estimateRangeBreakdown = ESTIMATE_RANGES.map((range) => {
    const allLots = filteredData.flatMap((d) => d.lots);
    const rangeLots = allLots.filter((lot) => {
      const mid = (toNum(lot.estimateLow) + toNum(lot.estimateHigh)) / 2;
      if (mid < range.min) return false;
      if (range.max !== null && mid > range.max) return false;
      return true;
    });
    return { label: range.label, count: rangeLots.length };
  }).filter((r) => r.count > 0);

  const addDynamicFilter = () => {
    setDynamicFilters((prev) => [...prev, { id: crypto.randomUUID(), type: "title", value: "" }]);
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
        <h1 className="page-title">Unsold lots by describer</h1>
        <p className="text-[#6687bc] text-sm mt-1">Full details of unsold lots grouped by describer</p>
      </div>

      {/* Fixed filters */}
      <div className="card space-y-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="label">Auction category</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setAuctionFilter("all"); setDescriberFilter("all"); setDynamicFilters([]); }}
              className="input"
            >
              <option value="all">All categories</option>
              {AUCTION_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setAuctionFilter("all"); setDescriberFilter("all"); setDynamicFilters([]); }}
              className="input"
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
            >
              <option value="all">All describers</option>
              {describerData.map((d) => (
                <option key={d.describerId} value={d.describerId}>{d.describerName} ({d.lots.length} unsold)</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic filters — only show when describer selected */}
        {describerFilter !== "all" && (
          <div className="space-y-3 pt-2 border-t border-[#1e3a6b]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6687bc] font-medium">Additional filters (AND logic)</p>
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
                  onChange={(e) => updateDynamicFilter(filter.id, { type: e.target.value as DynamicFilter["type"], value: "" })}
                  className="input w-48 flex-shrink-0"
                >
                  {(Object.entries(FILTER_TYPE_LABELS) as [DynamicFilter["type"], string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {filter.type === "estimate_range" ? (
                  <select
                    value={filter.value}
                    onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Select range...</option>
                    {ESTIMATE_RANGES.map((r) => (<option key={r.label} value={r.label}>{r.label}</option>))}
                  </select>
                ) : filter.type === "department" ? (
                  <select
                    value={filter.value}
                    onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                ) : filter.type === "lot_category" ? (
                  <select
                    value={filter.value}
                    onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">Select category...</option>
                    {lotCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateDynamicFilter(filter.id, { value: e.target.value })}
                    placeholder={`Enter ${FILTER_TYPE_LABELS[filter.type].toLowerCase()}...`}
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-[#6687bc] text-sm">Loading...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card text-center py-16">
          <PackageX size={36} className="text-[#2f5597] mx-auto mb-3" />
          <p className="text-[#6687bc] text-sm">No unsold lots found for this selection</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-sm flex items-center gap-3 py-3">
              <PackageX size={16} className="text-red-400" />
              <div>
                <p className="text-xs text-[#6687bc]">Total unsold</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{totalUnsold}</p>
              </div>
            </div>
            <div className="card-sm flex items-center gap-3 py-3">
              <div>
                <p className="text-xs text-[#6687bc]">Describers</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{filteredData.length}</p>
              </div>
            </div>
            <div className="card-sm flex items-center gap-3 py-3">
              <div>
                <p className="text-xs text-[#6687bc]">Avg per describer</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">
                  {filteredData.length > 0 ? Math.round(totalUnsold / filteredData.length) : 0}
                </p>
              </div>
            </div>
            <div className="card-sm flex items-center gap-3 py-3">
              <div>
                <p className="text-xs text-[#6687bc]">Active filters</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{dynamicFilters.filter((f) => f.value).length}</p>
              </div>
            </div>
          </div>

          {/* Estimate range breakdown */}
          {estimateRangeBreakdown.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1e3a6b]">
                <h2 className="section-title">Unsold by estimate range</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left py-3 px-6">Estimate range</th>
                      <th className="table-header text-right py-3 px-6">Unsold lots</th>
                      <th className="table-header py-3 px-6 w-48">Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateRangeBreakdown.map((r) => (
                      <tr key={r.label} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell px-6 font-medium text-[#f7f4ec]">{r.label}</td>
                        <td className="table-cell text-right px-6 text-red-400">{r.count}</td>
                        <td className="px-6 py-3">
                          <div className="w-full bg-[#1e3a6b] rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-red-500 transition-all"
                              style={{ width: `${totalUnsold > 0 ? (r.count / totalUnsold) * 100 : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lots grouped by describer */}
          {filteredData.map((d) => (
            <div key={d.describerId} className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1e3a6b] flex items-center justify-between">
                <div>
                  <h2 className="section-title">{d.describerName}</h2>
                  <p className="text-xs text-[#6687bc] mt-0.5">{d.lots.length} unsold lot{d.lots.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="badge-red">{d.lots.length} unsold</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e3a6b]">
                      <th className="table-header text-left py-3 px-4">Lot</th>
                      <th className="table-header text-left py-3 px-4">SG No.</th>
                      <th className="table-header text-left py-3 px-4">Receipt</th>
                      <th className="table-header text-left py-3 px-4">Title</th>
                      <th className="table-header text-left py-3 px-4">Description</th>
                      <th className="table-header text-left py-3 px-4">Dept</th>
                      <th className="table-header text-right py-3 px-4">Estimate</th>
                      <th className="table-header text-right py-3 px-4">Reserve</th>
                      <th className="table-header text-left py-3 px-4">Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lots.map((lot) => (
                      <tr key={lot.lotId} className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors">
                        <td className="table-cell px-4 font-mono text-xs text-[#6687bc]">{lot.lotNumber ?? "—"}</td>
                        <td className="table-cell px-4 font-mono text-xs text-[#6687bc]">{lot.stockNumber ?? "—"}</td>
                        <td className="table-cell px-4 font-mono text-xs text-[#6687bc]">{lot.receiptNo ?? "—"}</td>
                        <td className="table-cell px-4 font-medium text-[#f7f4ec] max-w-[180px]">
                          <div className="truncate" title={lot.title}>{lot.title}</div>
                        </td>
                        <td className="table-cell px-4 text-[#94aed6] max-w-[250px]">
                          <div className="truncate" title={lot.description ?? ""}>{lot.description ?? "—"}</div>
                        </td>
                        <td className="table-cell px-4 text-[#94aed6] text-xs">{lot.department ?? "—"}</td>
                        <td className="table-cell text-right px-4 text-[#94aed6] whitespace-nowrap">
                          {lot.estimateLow && lot.estimateHigh
                            ? `${formatCurrency(lot.estimateLow)} – ${formatCurrency(lot.estimateHigh)}`
                            : lot.estimateLow ? formatCurrency(lot.estimateLow) : "—"}
                        </td>
                        <td className="table-cell text-right px-4 text-[#94aed6]">{lot.reserve ? formatCurrency(lot.reserve) : "—"}</td>
                        <td className="table-cell px-4 text-[#94aed6]">{maskName(lot.vendorName)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
