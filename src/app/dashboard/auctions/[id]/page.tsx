"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatMultiplier,
  getSellThroughBadge,
} from "@/lib/utils/formatters";
import {
  ArrowLeft,
  TrendingUp,
  PackageCheck,
  Gavel,
  BarChart3,
} from "lucide-react";
import type { Auction, Lot, TopBuyer, TopVendor } from "@/lib/types/database";

export default function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [topBuyers, setTopBuyers] = useState<TopBuyer[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lots" | "buyers" | "vendors">("lots");
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: auctionData } = await supabase
        .from("auctions")
        .select("*")
        .eq("id", id)
        .single();

      if (!auctionData) {
        setLoading(false);
        return;
      }

      const { data: lotsData } = await supabase
        .from("lots")
        .select("*")
        .eq("auction_id", id)
        .order("lot_number", { ascending: true });

      setAuction(auctionData);
      const allLots = lotsData ?? [];
      setLots(allLots);

      // Get lot ids for this auction
      const lotIds = allLots.map((l) => l.id);

      if (lotIds.length > 0) {
        // Top buyers — get lot_buyers for these lots
        const { data: lotBuyers } = await supabase
          .from("lot_buyers")
          .select("lot_id, buyer_id")
          .in("lot_id", lotIds);

        if (lotBuyers && lotBuyers.length > 0) {
          const buyerIds = [...new Set(lotBuyers.map((lb) => lb.buyer_id))];

          const { data: buyerDetails } = await supabase
            .from("buyers")
            .select("id, name, email, country")
            .in("id", buyerIds);

          if (buyerDetails) {
            // Calculate spend per buyer
            const soldLots = allLots.filter((l) => l.sold);
            const buyerSpend = new Map<string, { lots: number; spend: number }>();

            for (const lb of lotBuyers) {
              const lot = soldLots.find((l) => l.id === lb.lot_id);
              if (lot) {
                const existing = buyerSpend.get(lb.buyer_id) ?? { lots: 0, spend: 0 };
                buyerSpend.set(lb.buyer_id, {
                  lots: existing.lots + 1,
                  spend: existing.spend + (lot.hammer_price ?? 0),
                });
              }
            }

            const buyers: TopBuyer[] = buyerDetails
              .map((b) => ({
                id: b.id,
                name: b.name,
                email: b.email,
                country: b.country,
                totalLots: buyerSpend.get(b.id)?.lots ?? 0,
                totalSpend: buyerSpend.get(b.id)?.spend ?? 0,
              }))
              .sort((a, b) => b.totalSpend - a.totalSpend)
              .slice(0, 10);

            setTopBuyers(buyers);
          }
        }

        // Top vendors — get lot_vendors for these lots
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
              const lot = allLots.find((l) => l.id === lv.lot_id);
              if (lot) {
                const existing = vendorStats.get(lv.vendor_id) ?? { lots: 0, value: 0 };
                vendorStats.set(lv.vendor_id, {
                  lots: existing.lots + 1,
                  value: existing.value + (lot.sold ? (lot.hammer_price ?? 0) : 0),
                });
              }
            }

            const vendors: TopVendor[] = vendorDetails
              .map((v) => ({
                id: v.id,
                name: v.name,
                email: v.email,
                country: v.country,
                totalLots: vendorStats.get(v.id)?.lots ?? 0,
                totalHammerValue: vendorStats.get(v.id)?.value ?? 0,
              }))
              .sort((a, b) => b.totalHammerValue - a.totalHammerValue)
              .slice(0, 10);

            setTopVendors(vendors);
          }
        }
      }

      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Loading...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Auction not found</p>
      </div>
    );
  }

  const sellThrough =
    auction.total_lots > 0
      ? (auction.lots_sold / auction.total_lots) * 100
      : 0;

  const avgHammer =
    auction.lots_sold > 0
      ? auction.total_hammer_value / auction.lots_sold
      : 0;

  const soldLots = lots.filter((l) => l.sold);
  const unsoldLots = lots.filter((l) => !l.sold);

  const topLots = [...soldLots]
    .sort((a, b) => (b.hammer_price ?? 0) - (a.hammer_price ?? 0))
    .slice(0, 5);

  const categoryMap = new Map<string, { sold: number; total: number; value: number }>();
  for (const lot of lots) {
    const cat = lot.category ?? "Uncategorised";
    const existing = categoryMap.get(cat) ?? { sold: 0, total: 0, value: 0 };
    categoryMap.set(cat, {
      total: existing.total + 1,
      sold: existing.sold + (lot.sold ? 1 : 0),
      value: existing.value + (lot.sold ? (lot.hammer_price ?? 0) : 0),
    });
  }
  const categories = Array.from(categoryMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.value - a.value);

  const stats = [
    {
      label: "Total hammer value",
      value: formatCurrency(auction.total_hammer_value),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Sell-through rate",
      value: formatPercent(sellThrough),
      icon: PackageCheck,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Lots offered",
      value: auction.total_lots.toLocaleString(),
      icon: Gavel,
      color: "text-gold-400",
      bg: "bg-gold-500/10",
      border: "border-gold-500/20",
    },
    {
      label: "Average lot value",
      value: formatCurrency(avgHammer),
      icon: BarChart3,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <Link
          href="/dashboard/auctions"
          className="inline-flex items-center gap-1.5 text-[#6
