"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent, formatDate, getSellThroughBadge } from "@/lib/utils/formatters";
import { Gavel, Plus } from "lucide-react";
import type { Auction } from "@/lib/types/database";

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadAuctions() {
      const { data } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: false });
      setAuctions(data ?? []);
      setLoading(false);
    }
    loadAuctions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Auctions</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {auctions.length} auction{auctions.length !== 1 ? "s" : ""} on record
          </p>
        </div>
        <Link href="/dashboard/upload" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add auction
        </Link>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {auctions.length === 0 ? (
          <div className="text-center py-16">
            <Gavel size={36} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No auctions yet</p>
            <p className="text-zinc-600 text-xs mt-1 mb-6">
              Upload your first CSV to get started
            </p>
            <Link href="/dashboard/upload" className="btn-primary">
              Upload data
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="table-header text-left py-4 px-6">Sale no.</th>
                  <th className="table-header text-left py-4 px-6">Auction</th>
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
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="table-cell px-6 font-mono text-xs text-zinc-500">
                        {auction.sale_number ?? "—"}
                      </td>
                      <td className="table-cell px-6 font-medium text-zinc-100">
                        {auction.name}
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
                      <td className="table-cell text-right px-6 font-medium text-zinc-100">
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
                          className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
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
