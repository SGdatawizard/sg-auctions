"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, type Auction } from "@/lib/types/database";
import { Users, ShoppingBag } from "lucide-react";

type PersonRow = {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  totalLots: number;
  totalValue: number;
};

export default function PeoplePage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"buyers" | "vendors">("buyers");
  const [topBuyers, setTopBuyers] = useState<PersonRow[]>([]);
  const [topVendors, setTopVendors] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Get available years from auctions
  const years = [...new Set(auctions.map((a) => new Date(a.date).getFullYear()))]
    .sort((a, b) => b - a);

  useEffect(() => {
    async function loadAuctions() {
      const { data } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: false });
      setAuctions(data ?? []);
    }
    loadAuctions();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (auctions.length === 0) return;
      setLoading(true);

      // Filter auctions by category and year
      let filteredAuctions = auctions;
      if (categoryFilter !== "all") {
        filteredAuctions = filteredAuctions.filter(
          (a) => a.auction_category === categoryFilter
        );
      }
      if (yearFilter !== "all") {
        filteredAuctions = filteredAuctions.filter(
          (a) => new Date(a.date).getFullYear() === parseInt(yearFilter)
        );
      }

      if (filteredAuctions.length === 0) {
        setTopBuyers([]);
        setTopVendors([]);
        setLoading(false);
        return;
      }

      const auctionIds = filteredAuctions.map((a) => a.id);

      // Get all lots for these auctions
      const { data: lots } = await supabase
        .from("lots")
        .select("id, sold, hammer_price, auction_id")
        .in("auction_id", auctionIds);

      if (!lots) {
        setLoading(false);
        return;
      }

      const lotIds = lots.map((l) => l.id);
      const soldLots = lots.filter((l) => l.sold);
      const soldLotIds = soldLots.map((l) => l.id);

      // ── Top Buyers ──────────────────────────────────────────────
      if (soldLotIds.length > 0) {
        const { data: lotBuyers } = await supabase
          .from("lot_buyers")
          .select("lot_id, buyer_id")
          .in("lot_id", soldLotIds);

        if (lotBuyers && lotBuyers.length > 0) {
          const buyerIds = [...new Set(lotBuyers.map((lb) => lb.buyer_id))];

          const { data: buyerDetails } = await supabase
            .from("buyers")
            .select("id, name, email, country")
            .in("id", buyerIds);

          if (buyerDetails) {
            const buyerStats = new Map<string, { lots: number; spend: number }>();
            for (const lb of lotBuyers) {
              const lot = soldLots.find((l) => l.id === lb.lot_id);
              if (lot) {
                const existing = buyerStats.get(lb.buyer_id) ?? { lots: 0, spend: 0 };
                buyerStats.set(lb.buyer_id, {
                  lots: existing.lots + 1,
                  spend: existing.spend + (lot.hammer_price ?? 0),
                });
              }
            }

            const buyers: PersonRow[] = buyerDetails
              .map((b) => ({
                id: b.id,
                name: b.name,
                email: b.email,
                country: b.country,
                totalLots: buyerStats.get(b.id)?.lots ?? 0,
                totalValue: buyerStats.get(b.id)?.spend ?? 0,
              }))
              .sort((a, b) => b.totalValue - a.totalValue)
              .slice(0, 10);

            setTopBuyers(buyers);
          }
        } else {
          setTopBuyers([]);
        }
      } else {
        setTopBuyers([]);
      }

      // ── Top Vendors ──────────────────────────────────────────────
      if (lotIds.length > 0) {
        const { data: lotVendors } = await supabase
          .from("lot_vendors")
          .select("lot_id, vendor_id")
          .in("lot_id", lotIds);

        if (lotVendors && lotVendors.length > 0) {
          const vendorIds = [...new Set(lotVendors.map((lv) => lv.vendor_id))];

          const { data: vendorDetails } = await supabase
            .from("vendors")
            .select("id, name, email, country")
            .in("id", vendorIds);

          if (vendorDetails) {
            const vendorStats = new Map<string, { lots: number; value: number }>();
            for (const lv of lotVendors) {
              const lot = lots.find((l) => l.id === lv.lot_id);
              if (lot) {
                const existing = vendorStats.get(lv.vendor_id) ?? { lots: 0, value: 0 };
                vendorStats.set(lv.vendor_id, {
                  lots: existing.lots + 1,
                  value: existing.value + (lot.sold ? (lot.hammer_price ?? 0) : 0),
                });
              }
            }

            const vendors: PersonRow[] = vendorDetails
              .map((v) => ({
                id: v.id,
                name: v.name,
                email: v.email,
                country: v.country,
                totalLots: vendorStats.get(v.id)?.lots ?? 0,
                totalValue: vendorStats.get(v.id)?.value ?? 0,
              }))
              .sort((a, b) => b.totalValue - a.totalValue)
              .slice(0, 10);

            setTopVendors(vendors);
          }
        } else {
          setTopVendors([]);
        }
      } else {
        setTopVendors([]);
      }

      setLoading(false);
    }

    loadData();
  }, [categoryFilter, yearFilter, auctions]);

  const activeData = activeTab === "buyers" ? topBuyers : topVendors;

  return (
    <div className="space-y-8">

      <div>
        <h1 className="page-title">Buyers & Vendors</h1>
        <p className="text-[#6687bc] text-sm mt-1">
          Top 10 buyers and vendors filtered by category and year
        </p>
      </div>

      {/* Filters */}
      <div className="card py-4 space-y-4">
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
          <div>
            <label className="label">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="input"
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-[#0e1e38] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("buyers")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "buyers"
              ? "bg-gold-500 text-[#0e1e38]"
              : "text-[#94aed6] hover:text-[#f7f4ec]"
          }`}
        >
          <ShoppingBag size={14} />
          Top buyers
        </button>
        <button
          onClick={() => setActiveTab("vendors")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "vendors"
              ? "bg-gold-500 text-[#0e1e38]"
              : "text-[#94aed6] hover:text-[#f7f4ec]"
          }`}
        >
          <Users size={14} />
          Top vendors
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e3a6b]">
          <h2 className="section-title">
            Top 10 {activeTab === "buyers" ? "buyers" : "vendors"}
            {categoryFilter !== "all" && (
              <span className="ml-2 badge badge-amber">{categoryFilter}</span>
            )}
            {yearFilter !== "all" && (
              <span className="ml-2 badge badge-green">{yearFilter}</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-[#6687bc] text-sm">Loading...</p>
          </div>
        ) : activeData.length === 0 ? (
          <div className="text-center py-16">
            <Users size={36} className="text-[#2f5597] mx-auto mb-3" />
            <p className="text-[#6687bc] text-sm">
              No {activeTab} data for this selection
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a6b]">
                  <th className="table-header text-left py-3 px-6">Rank</th>
                  <th className="table-header text-left py-3 px-6">Name</th>
                  <th className="table-header text-left py-3 px-6">Email</th>
                  <th className="table-header text-left py-3 px-6">Country</th>
                  <th className="table-header text-right py-3 px-6">
                    {activeTab === "buyers" ? "Lots bought" : "Lots consigned"}
                  </th>
                  <th className="table-header text-right py-3 px-6">
                    {activeTab === "buyers" ? "Total spend" : "Total hammer value"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((person, i) => (
                  <tr
                    key={person.id}
                    className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors"
                  >
                    <td className="table-cell px-6">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0 ? "bg-gold-500 text-[#0e1e38]"
                        : i === 1 ? "bg-[#94aed6] text-[#0e1e38]"
                        : i === 2 ? "bg-[#c99a0f]/50 text-gold-300"
                        : "bg-[#1e3a6b] text-[#6687bc]"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="table-cell px-6 font-medium text-[#f7f4ec]">
                      {person.name ?? "—"}
                    </td>
                    <td className="table-cell px-6 text-[#94aed6]">
                      {person.email ? (
                        
                          href={`mailto:${person.email}`}
                          className="text-gold-400 hover:text-gold-300 transition-colors"
                        >
                          {person.email}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="table-cell px-6 text-[#94aed6]">
                      {person.country ?? "—"}
                    </td>
                    <td className="table-cell text-right px-6">
                      {person.totalLots.toLocaleString()}
                    </td>
                    <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">
                      {formatCurrency(person.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
