"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { ESTIMATE_RANGES, type DescriberSummary } from "@/lib/types/database";
import { Users } from "lucide-react";

export default function DescribersPage() {
  const [describers, setDescribers] = useState<DescriberSummary[]>([]);
  const [selected, setSelected] = useState<DescriberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // Load all describers
      const { data: describerRows } = await supabase
        .from("describers")
        .select("id, name")
        .order("name");

      if (!describerRows || describerRows.length === 0) {
        setLoading(false);
        return;
      }

      // Load all lots with their describer junctions
      const { data: lotDescribers } = await supabase
        .from("lot_describers")
        .select("lot_id, describer_id");

      const { data: lots } = await supabase
        .from("lots")
        .select("id, sold, hammer_price, estimate_low, estimate_high");

      if (!lotDescribers || !lots) {
        setLoading(false);
        return;
      }

      // Build lot id -> lot map
      const lotMap = new Map(lots.map((l) => [l.id, l]));

      // Build describer summaries
      const summaries: DescriberSummary[] = describerRows.map((describer) => {
        // Get all lot ids for this describer
        const lotIds = lotDescribers
          .filter((ld) => ld.describer_id === describer.id)
          .map((ld) => ld.lot_id);

        const describerLots = lotIds
          .map((id) => lotMap.get(id))
          .filter(Boolean) as typeof lots;

        const totalLots = describerLots.length;
        const soldLots = describerLots.filter((l) => l.sold);
        const totalSold = soldLots.length;
        const totalHammerValue = soldLots.reduce(
          (sum, l) => sum + (l.hammer_price ?? 0), 0
        );
        const sellThroughRate = totalLots > 0
          ? (totalSold / totalLots) * 100
          : 0;

        // Average hammer vs mid estimate
        const lotsWithEstimates = soldLots.filter(
          (l) => l.estimate_low && l.estimate_high && l.hammer_price
        );
        const avgHammerVsEstimate = lotsWithEstimates.length > 0
          ? lotsWithEstimates.reduce((sum, l) => {
              const mid = ((l.estimate_low ?? 0) + (l.estimate_high ?? 0)) / 2;
              return sum + (mid > 0 ? (l.hammer_price ?? 0) / mid : 0);
            }, 0) / lotsWithEstimates.length
          : 0;

        // Estimate range breakdown
        const estimateRangeBreakdown = ESTIMATE_RANGES.map((range) => {
          const rangeLots = describerLots.filter((l) => {
            const mid = ((l.estimate_low ?? 0) + (l.estimate_high ?? 0)) / 2;
            if (mid === 0) return false;
            if (mid < range.min) return false;
            if (range.max !== null && mid > range.max) return false;
            return true;
          });

          const rangeSold = rangeLots.filter((l) => l.sold).length;
          return {
            range: range.label,
            totalLots: rangeLots.length,
            totalSold: rangeSold,
            sellThroughRate: rangeLots.length > 0
              ? (rangeSold / rangeLots.length) * 100
              : 0,
          };
        });

        return {
          id: describer.id,
          name: describer.name,
          totalLots,
          totalSold,
          totalHammerValue,
          sellThroughRate,
          averageHammerVsEstimate: avgHammerVsEstimate,
          estimateRangeBreakdown,
        };
      });

      // Sort by total hammer value desc
      summaries.sort((a, b) => b.totalHammerValue - a.totalHammerValue);
      setDescribers(summaries);
      if (summaries.length > 0) setSelected(summaries[0]);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (describers.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="page-title">Describers</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Performance breakdown by describer
          </p>
        </div>
        <div className="card text-center py-16">
          <Users size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No describer data yet</p>
          <p className="text-zinc-600 text-xs mt-1">
            Upload auction data to see describer analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="page-title">Describers</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Performance breakdown by describer across all auctions
        </p>
      </div>

      {/* Summary table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="section-title">All describers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header text-left py-3 px-6">Describer</th>
                <th className="table-header text-right py-3 px-6">Lots</th>
                <th className="table-header text-right py-3 px-6">Sold</th>
                <th className="table-header text-right py-3 px-6">Hammer value</th>
                <th className="table-header text-right py-3 px-6">Sell-through</th>
                <th className="table-header text-right py-3 px-6">Avg vs estimate</th>
                <th className="table-header py-3 px-6"></th>
              </tr>
            </thead>
            <tbody>
              {describers.map((d) => (
                <tr
                  key={d.id}
                  className={`border-b border-zinc-800/50 transition-colors cursor-pointer ${
                    selected?.id === d.id
                      ? "bg-brand-500/5 border-l-2 border-l-brand-500"
                      : "hover:bg-zinc-800/20"
                  }`}
                  onClick={() => setSelected(d)}
                >
                  <td className="table-cell px-6 font-medium text-zinc-100">
                    {d.name}
                  </td>
                  <td className="table-cell text-right px-6">
                    {d.totalLots.toLocaleString()}
                  </td>
                  <td className="table-cell text-right px-6">
                    {d.totalSold.toLocaleString()}
                  </td>
                  <td className="table-cell text-right px-6 font-medium text-zinc-100">
                    {formatCurrency(d.totalHammerValue)}
                  </td>
                  <td className="table-cell text-right px-6">
                    <span
                      className={
                        d.sellThroughRate >= 80
                          ? "badge-green"
                          : d.sellThroughRate >= 60
                          ? "badge-amber"
                          : "badge-red"
                      }
                    >
                      {formatPercent(d.sellThroughRate)}
                    </span>
                  </td>
                  <td className="table-cell text-right px-6">
                    <span
                      className={
                        d.averageHammerVsEstimate >= 1.2
                          ? "text-emerald-400"
                          : d.averageHammerVsEstimate >= 0.9
                          ? "text-zinc-300"
                          : "text-red-400"
                      }
                    >
                      {d.averageHammerVsEstimate > 0
                        ? `${d.averageHammerVsEstimate.toFixed(2)}x`
                        : "—"}
                    </span>
                  </td>
                  <td className="table-cell px-6">
                    <span className="text-brand-400 text-sm">
                      {selected?.id === d.id ? "Selected" : "View →"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected describer detail */}
      {selected && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="section-title text-xl">{selected.name}</h2>
            <span className="badge badge-amber">Estimate range breakdown</span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <p className="stat-label">Total lots</p>
              <p className="stat-value mt-1">{selected.totalLots.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="stat-label">Total sold</p>
              <p className="stat-value mt-1">{selected.totalSold.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="stat-label">Total hammer value</p>
              <p className="stat-value mt-1">{formatCurrency(selected.totalHammerValue)}</p>
            </div>
            <div className="card">
              <p className="stat-label">Sell-through rate</p>
              <p className="stat-value mt-1">{formatPercent(selected.sellThroughRate)}</p>
            </div>
          </div>

          {/* Estimate range breakdown */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="section-title">Sell-through by estimate range</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="table-header text-left py-3 px-6">
                      Estimate range
                    </th>
                    <th className="table-header text-right py-3 px-6">
                      Lots
                    </th>
                    <th className="table-header text-right py-3 px-6">
                      Sold
                    </th>
                    <th className="table-header text-right py-3 px-6">
                      Unsold
                    </th>
                    <th className="table-header text-right py-3 px-6">
                      Sell-through
                    </th>
                    <th className="table-header py-3 px-6 w-48">
                      Visual
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.estimateRangeBreakdown.map((r) => (
                    <tr
                      key={r.range}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="table-cell px-6 font-medium text-zinc-100">
                        {r.range}
                      </td>
                      <td className="table-cell text-right px-6">
                        {r.totalLots}
                      </td>
                      <td className="table-cell text-right px-6 text-emerald-400">
                        {r.totalSold}
                      </td>
                      <td className="table-cell text-right px-6 text-red-400">
                        {r.totalLots - r.totalSold}
                      </td>
                      <td className="table-cell text-right px-6">
                        {r.totalLots > 0 ? (
                          <span
                            className={
                              r.sellThroughRate >= 80
                                ? "badge-green"
                                : r.sellThroughRate >= 60
                                ? "badge-amber"
                                : "badge-red"
                            }
                          >
                            {formatPercent(r.sellThroughRate)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {r.totalLots > 0 ? (
                          <div className="w-full bg-zinc-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                r.sellThroughRate >= 80
                                  ? "bg-emerald-500"
                                  : r.sellThroughRate >= 60
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${r.sellThroughRate}%` }}
                            />
                          </div>
                        ) : (
                          <div className="w-full bg-zinc-800 rounded-full h-2" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
