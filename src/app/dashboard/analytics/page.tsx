"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import type { YearSummary, CategorySummary } from "@/lib/types/database";

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[£$€,\s]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export default function AnalyticsPage() {
  const [yearSummaries, setYearSummaries] = useState<YearSummary[]>([]);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: auctions } = await supabase
        .from("auctions")
        .select("*")
        .order("date", { ascending: true });

      // Paginated lots fetch
      const lots: { category: string | null; sold: boolean; hammer_price: number | null }[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("lots")
          .select("category, sold, hammer_price")
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        lots.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      if (!auctions) {
        setLoading(false);
        return;
      }

      // Year on year summaries
      const yearMap = new Map<number, YearSummary>();
      for (const auction of auctions) {
        const year = new Date(auction.date).getFullYear();
        const existing = yearMap.get(year) ?? {
          year,
          totalAuctions: 0,
          totalLots: 0,
          totalSold: 0,
          totalHammerValue: 0,
          sellThroughRate: 0,
        };
        yearMap.set(year, {
          year,
          totalAuctions: existing.totalAuctions + 1,
          totalLots: existing.totalLots + (auction.total_lots ?? 0),
          totalSold: existing.totalSold + (auction.lots_sold ?? 0),
          totalHammerValue: existing.totalHammerValue + toNum(auction.total_hammer_value),
          sellThroughRate: 0,
        });
      }

      const yearSummaries = Array.from(yearMap.values()).map((y) => ({
        ...y,
        sellThroughRate: y.totalLots > 0 ? (y.totalSold / y.totalLots) * 100 : 0,
      }));

      // Category summaries
      const catMap = new Map<string, CategorySummary>();
      for (const lot of lots) {
        const cat = lot.category ?? "Uncategorised";
        const existing = catMap.get(cat) ?? {
          category: cat,
          totalLots: 0,
          totalSold: 0,
          totalHammerValue: 0,
          sellThroughRate: 0,
        };
        catMap.set(cat, {
          category: cat,
          totalLots: existing.totalLots + 1,
          totalSold: existing.totalSold + (lot.sold === true ? 1 : 0),
          totalHammerValue: existing.totalHammerValue + (lot.sold === true ? toNum(lot.hammer_price) : 0),
          sellThroughRate: 0,
        });
      }

      const categorySummaries = Array.from(catMap.values())
        .map((c) => ({
          ...c,
          sellThroughRate: c.totalLots > 0 ? (c.totalSold / c.totalLots) * 100 : 0,
        }))
        .sort((a, b) => b.totalHammerValue - a.totalHammerValue)
        .slice(0, 10);

      setYearSummaries(yearSummaries);
      setCategorySummaries(categorySummaries);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#6687bc] text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="text-[#6687bc] text-sm mt-1">Year-on-year performance and category breakdown</p>
      </div>
      <AnalyticsCharts
        yearSummaries={yearSummaries}
        categorySummaries={categorySummaries}
      />
    </div>
  );
}
