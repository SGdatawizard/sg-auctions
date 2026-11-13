"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent, formatDate, getSellThroughBadge } from "@/lib/utils/formatters";
import { Gavel, Plus } from "lucide-react";
import type { Auction } from "@/lib/types/database";
import { AUCTION_CATEGORIES, OFFICES } from "@/lib/types/database";

const pillClass = (active: boolean) =>
  `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
    active ? "bg-gold-500 text-[#0e1e38]" : "bg-[#1e3a6b] text-[#94aed6] hover:text-[#f7f4ec]"
  }`;

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadAuctions() {
      setLoading(true);
      let query = supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: false });

      if (officeFilter !== "all") {
        query = query.eq("office", officeFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("auction_category", categoryFilter);
      }

      const { data } = await query;
      setAuctions(data ?? []);
      setLoading(false);
    }
    loadAuctions();
  }, [officeFilter, categoryFilter]);

  const filtersActive = officeFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Auctions</h1>
          <p className="text-[#6687bc] text-sm mt-1">
            {auctions.length} auction{auctions.length !== 1 ? "s" : ""} on record
          </p>
        </div>
        <Link href="/dashboard/upload" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add auction
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6687bc] w-16">Office</span>
          <button onClick={() => setOfficeFilter("all")} className={pillClass(officeFilter === "all")}>
            All offices
          </button>
          {OFFICES.map((o) => (
            <button key={o} onClick={() => setOfficeFilter(o)} className={pillClass(officeFilter === o)}>
              {o}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6687bc] w-16">Category</span>
          <button onClick={() => setCategoryFilter("all")} className={pillClass(categoryFilter === "all")}>
            All
          </button>
          {AUCTION_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={pillClass(categoryFilter === cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-[#6687bc] text-sm">Loading...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-16">
            <Gavel size={36} className="text-[#2f5597] mx-auto mb-3" />
            <p className="text-[#6687bc] text-sm">No auctions found</p>
            <p className="text-[#2f5597] text-xs mt-1 mb-6">
              {filtersActive
                ? "No auctions on record for this selection yet"
                : "Upload your first file to get started"}
            </p>
            {!filtersActive && (
              <Link href="/dashboard/upload" className="btn-primary">
                Upload data
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a6b]">
                  <th className="table-header text-left py-4 px-6">Sale no.</th>
                  <th className="table-header text-left py-4 px-6">Auction</th>
                  <th className="table-header text-left py-4 px-6">Office</th>
                  <th className="table-header text-left py-4 px-6">Category</th>
                  <th className="table-header text-left py-4 px-6">Date</th>
                  <th className="table-header text-left py-4 px-6">Location</th>
                  <th className="table-header text-right py-4 px-6">Lots</th>
                  <th className="table-header text-right py-4 px-6">Sold</th>
                  <th className="table-header text-right py-4 px-6">Hammer value</th>
                  <th className="table-header text-right py-4 px-6">Sell-through</th>
                  <th className="table-header py-4 px-6"></th>
                </tr>
              </thead>
              <tbody>
                {auctions.map((auction) => {
                  const sellThrough =
                    auction.total_lots > 0
                      ? (auction.lots_sold / auction.total_lots) * 100
                      : 0;

                  return (
                    <tr
                      key={auction.id}
                      className="border-b border-[#1e3a6b]/50 hover:bg-[#1e3a6b]/30 transition-colors"
                    >
                      <td className="table-cell px-6 font-mono text-xs text-[#6687bc]">
                        {auction.sale_number ?? "—"}
                      </td>
                      <td className="table-cell px-6 font-medium text-[#f7f4ec]">
                        {auction.name}
                      </td>
                      <td className="table-cell px-6 text-[#94aed6]">
                        {auction.office ?? "London"}
                      </td>
                      <td className="table-cell px-6">
                        {auction.auction_category ? (
                          <span className="badge badge-amber">
                            {auction.auction_category}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="table-cell px-6">
                        {formatDate(auction.date)}
                      </td>
                      <td className="table-cell px-6">
                        {auction.location ?? "—"}
                      </td>
                      <td className="table-cell text-right px-6">
                        {auction.total_lots.toLocaleString()}
                      </td>
                      <td className="table-cell text-right px-6">
                        {auction.lots_sold.toLocaleString()}
                      </td>
                      <td className="table-cell text-right px-6 font-medium text-[#f7f4ec]">
                        {formatCurrency(auction.total_hammer_value)}
                      </td>
                      <td className="table-cell text-right px-6">
                        <span className={getSellThroughBadge(sellThrough)}>
                          {formatPercent(sellThrough)}
                        </span>
                      </td>
                      <td className="table-cell px-6">
                        <Link
                          href={`/dashboard/auctions/${auction.id}`}
                          className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
