"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, type Auction, maskName } from "@/lib/types/database";
import { PackageX } from "lucide-react";

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
};

type DescriberUnsold = {
  describerId: string;
  describerName: string;
  lots: UnsoldLotRow[];
};

export default function UnsoldLotsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [auctionFilter, setAuctionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [describerData, setDescriberData] = useState<DescriberUnsold[]>([]);
  const [selectedDescriber, setSelectedDescriber] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
      if (auctionFilter !== "all") {
        filteredAuctions = filteredAuctions.filter((a) => a.id === auctionFilter);
      }

      if (filteredAuctions.length === 0) {
        setDescriberData([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);

      const { data: unsoldLots } = await supabase
        .from("lots")
        .select("id, lot_number, stock_number, receipt_no, title, description, estimate_low, estimate_high, reserve, auction_id")
        .in("auction_id", auctionIds)
        .eq("sold", false);

      if (!unsoldLots || unsoldLots.length === 0) {
        setDescriberData([]);
        setLoading(false);
        return;
      }

      const lotIds = unsoldLots.map((l) => l.id);

      const { data: lotVendors } = await supabase.from("lot_vendors").select("lot_id, vendor_id").in("lot_id", lotIds);

      const vendorIds = Array.from(new Set((lotVendors ?? []).map((lv) => lv.vendor_id)));
      const vendorMap = new Map<string, { name: string | null }>();

      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase.from("vendors").select("id, name").in("id", vendorIds);
        if (vendors) {
          for (const v of vendors) {
            vendorMap.set(v.id, { name: v.name });
          }
        }
      }

      const lotToVendor = new Map<string, { name: string | null }>();
      for (const lv of lotVendors ?? []) {
        const vendor = vendorMap.get(lv.vendor_id);
        if (vendor) lotToVendor.set(lv.lot_id, vendor);
      }

      const { data: lotDescribers } = await supabase.from("lot_describers").select("lot_id, describer_id").in("lot_id", lotIds);

      const describerIds = Array.from(new Set((lotDescribers ?? []).map((ld) => ld.describer_id)));
      const describerMap = new Map<string, string>();

      if (describerIds.length > 0) {
        const { data: describers } = await supabase.from("describers").select("id, name").in("id", describerIds);
        if (describers) {
          for (const d of describers) {
            describerMap.set(d.id, d.name);
          }
        }
      }

      const describerToLots = new Map<string, { id: string; name: string; lots: UnsoldLotRow[] }>();

      for (const ld of lotDescribers ?? []) {
        const lot = unsoldLots.find((l) => l.id === ld.lot_id);
        if (!lot) continue;
        const describerName = describerMap.get(ld.describer_id) ?? "Unknown";
        const vendor = lotToVendor.get(lot.id);
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
          vendorName: vendor?.name ?? null,
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
      setSelectedDescriber("all");
      setLoading(false);
    }

    loadData();
  }, [auctionFilter, categoryFilter, auctions]);

  const filteredData = selectedDescriber === "all" ? describerData : describerData.filter((d) => d.describerId === selectedDescriber);
  const totalUnsold = describerData.reduce((sum, d) => sum + d.lots.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Unsold lots by describer</h1>
        <p className="text-[#6687bc] text-sm mt-1">Full details of unsold lots grouped by describer</p>
      </div>
      <div className="card space-y-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Auction category</label>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setAuctionFilter("all"); }} className="input">
              <option value="all">All categories</option>
              {AUCTION_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Auction</label>
            <select value={auctionFilter} onChange={(e) => setAuctionFilter(e.target.value)} className="input">
              <option value="all">All auctions</option>
              {auctions
                .filter((a) => categoryFilter === "all" || a.auction_category === categoryFilter)
                .map((a) => (<option key={a.id} value={a.id}>{a.sale_number ? `${a.sale_number} — ` : ""}{a.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Describer</label>
            <select value={selectedDescriber} onChange={(e) => setSelectedDescriber(e.target.value)} className="input">
              <option value="all">All describers</option>
              {describerData.map((d) => (<option key={d.describerId} value={d.describerId}>{d.describerName} ({d.lots.length} unsold)</option>))}
            </select>
          </div>
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
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="card-sm flex items-center gap-3 py-3">
              <PackageX size={16} className="text-red-400" />
              <div>
                <p className="text-xs text-[#6687bc]">Total unsold</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{totalUnsold}</p>
              </div>
            </div>
            <div className="card-sm flex items-center gap-3 py-3">
              <div>
                <p className="text-xs text-[#6687bc]">Describers with unsold lots</p>
                <p className="text-lg font-semibold text-[#f7f4ec]">{describerData.length}</p>
              </div>
            </div>
          </div>
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
                        <td className="table-cell px-4 font-medium text-[#f7f4ec] max-w-[200px]">
                          <div className="truncate" title={lot.title}>{lot.title}</div>
                        </td>
                        <td className="table-cell px-4 text-[#94aed6] max-w-[300px]">
                          <div className="truncate" title={lot.description ?? ""}>{lot.description ?? "—"}</div>
                        </td>
                        <td className="table-cell text-right px-4 text-[#94aed6] whitespace-nowrap">
                          {lot.estimateLow && lot.estimateHigh ? `${formatCurrency(lot.estimateLow)} – ${formatCurrency(lot.estimateHigh)}` : lot.estimateLow ? formatCurrency(lot.estimateLow) : "—"}
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