export function formatCurrency(
  value: number,
  currency: string = "GBP",
  locale: string = "en-GB"
): string {
  if (isNaN(value) || value === null || value === undefined) return "—";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(
  value: number,
  decimals: number = 1
): string {
  if (isNaN(value) || value === null || value === undefined) return "—";

  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return "—";

  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("en-GB", options);
}

export function formatMultiplier(
  hammerPrice: number,
  estimateLow: number,
  estimateHigh: number
): string {
  if (!hammerPrice || !estimateLow || !estimateHigh) return "—";

  const midEstimate = (estimateLow + estimateHigh) / 2;
  if (midEstimate === 0) return "—";

  const multiplier = hammerPrice / midEstimate;
  return `${multiplier.toFixed(2)}x`;
}

export function getSellThroughColor(rate: number): string {
  if (rate >= 80) return "text-emerald-400";
  if (rate >= 60) return "text-amber-400";
  return "text-red-400";
}

export function getSellThroughBadge(rate: number): string {
  if (rate >= 80) return "badge-green";
  if (rate >= 60) return "badge-amber";
  return "badge-red";
}
