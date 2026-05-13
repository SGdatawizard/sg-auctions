import { createClient } from "@/lib/supabase/server";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import type { YearSummary, CategorySummary } from "@/lib/types/database";

async function getAnalyticsData() {
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .order("date", { ascending: true });

  const { data: lots } = await supabase
    .from("lots")
    .select("*");

  if (!auctions || !lots) return { yearSummaries: [], categorySummaries: [] };

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
      totalLots: existing.totalLots + auction.total_lots,
      totalSold: existing.totalSold + auction.lots_sold,
      totalHammerValue:
        existing.totalHammerValue + auction.total_hammer_value,
      sellThroughRate: 0,
    });
  }
  const yearSummaries = Array.from(yearMap.values()).map((y) => ({
    ...y,
    sellThroughRate:
      y.totalLots > 0 ? (y.totalSold / y.totalLots) * 100 : 0,
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
      totalSold: existing.totalSold + (lot.sold ? 1 : 0),
      totalHammerValue:
        existing.totalHammerValue + (lot.sold ? (lot.hammer_price ?? 0) : 0),
      sellThroughRate: 0,
    });
  }
  const categorySummaries = Array.from(catMap.values())
    .map((c) => ({
      ...c,
      sellThroughRate:
        c.totalLots > 0 ? (c.totalSold / c.totalLots) * 100 : 0,
    }))
    .sort((a, b) => b.totalHammerValue - a.totalHammerValue)
    .slice(0, 10);

  return { yearSummaries, categorySummaries };
}

export default async function AnalyticsPage() {
  const { yearSummaries, categorySummaries } = await getAnalyticsData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Year-on-year performance and category breakdown
        </p>
      </div>
      <AnalyticsCharts
        yearSummaries={yearSummaries}
        categorySummaries={categorySummaries}
      />
    </div>
  );
}
