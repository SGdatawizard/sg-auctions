"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Tag,
  Building2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils/formatters";
import { AUCTION_CATEGORIES, OFFICES, detectOfficeAndCategory } from "@/lib/types/database";

type UploadState = "idle" | "uploading" | "success" | "error";

type UploadResult = {
  auctionId: string;
  auctionName: string;
  saleNumber: string | null;
  office: string;
  auctionCategory: string | null;
  sourceCurrency: string;
  fxRate: number;
  lotsImported: number;
  lotsSold: number;
  totalHammerValue: number;
};

function getAccessToken(): string | null {
  try {
    const storageKey = "sg-auctions-auth";
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.access_token ?? null;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase") || key.includes("auth"))) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed?.access_token) return parsed.access_token;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

// Same rule as the server: keep the full prefix, e.g. SGS26028, CB26004, S26000
function extractSaleNumber(filename: string): string | null {
  const match = filename.match(/[A-Za-z]{1,4}\d{4,6}/);
  return match ? match[0].toUpperCase() : null;
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [auctionDate, setAuctionDate] = useState("");
  const [office, setOffice] = useState("");
  const [auctionCategory, setAuctionCategory] = useState("");
  const [detectionNote, setDetectionNote] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Picks the file, then pre-fills office + category from the file name
  // (and the Department column, because comics are sometimes numbered as e-sales)
  async function selectFile(selected: File | null) {
    setFile(selected);
    setError(null);

    if (!selected) {
      setDetectionNote(null);
      return;
    }

    const detected = detectOfficeAndCategory(extractSaleNumber(selected.name));
    let detectedOffice: string = detected ? detected.office : "";
    let detectedCategory: string = detected ? detected.category : "";
    let note: string = detected
      ? `Detected from the file name: ${detected.office} · ${detected.category}`
      : "";

    const lower = selected.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      try {
        const buffer = await selected.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
          raw: true,
        });
        const departments = rows
          .map((r) => r["Department"])
          .filter((d) => d !== null && d !== undefined && d !== "");
        if (
          departments.length > 0 &&
          departments.every((d) => String(d).trim().toLowerCase() === "comics")
        ) {
          detectedCategory = "Comics";
          note = `Detected: ${detectedOffice || "office unknown"} · Comics (every lot is in the Comics department)`;
        }
      } catch {
        // Ignore — the file name detection (or manual choice) still applies
      }
    }

    setOffice(detectedOffice);
    setAuctionCategory(detectedCategory);
    setDetectionNote(
      note || "Couldn't detect the office and category from this file — please choose them below."
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    selectFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      const name = dropped.name.toLowerCase();
      if (
        !name.endsWith(".csv") &&
        !name.endsWith(".xlsx") &&
        !name.endsWith(".xls")
      ) {
        setError("Only CSV and Excel files are supported");
        return;
      }
      selectFile(dropped);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !auctionDate || !auctionCategory || !office) return;

    setState("uploading");
    setError(null);

    const accessToken = getAccessToken();
    if (!accessToken) {
      setError("Not authenticated — please log in again");
      setState("error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("auction_date", auctionDate);
    formData.append("office", office);
    formData.append("auction_category", auctionCategory);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setError(data.error ?? "Upload failed");
        return;
      }

      setState("success");
      setResult(data);
    } catch {
      setState("error");
      setError("Network error — please try again");
    }
  }

  function handleReset() {
    setFile(null);
    setAuctionDate("");
    setOffice("");
    setAuctionCategory("");
    setDetectionNote(null);
    setState("idle");
    setError(null);
    setResult(null);
  }

  if (state === "success" && result) {
    return (
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="page-title">Upload data</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Import auction results from CSV or Excel
          </p>
        </div>

        <div className="card text-center py-10">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="section-title mb-1">Upload successful</h2>
          <div className="flex items-center justify-center gap-2 mb-1">
            {result.saleNumber && (
              <span className="badge badge-amber">{result.saleNumber}</span>
            )}
            {result.office && (
              <span className="badge badge-green">{result.office}</span>
            )}
            {result.auctionCategory && (
              <span className="badge badge-green">{result.auctionCategory}</span>
            )}
          </div>
          <p className="text-zinc-500 text-sm mb-2">{result.auctionName}</p>
          {result.sourceCurrency === "SGD" && (
            <p className="text-gold-400 text-xs mb-4">
              Converted from SGD at 1 SGD = £{result.fxRate}
            </p>
          )}
          <div className="mb-4" />

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card-sm text-center">
              <p className="stat-value">{result.lotsImported}</p>
              <p className="stat-label">Lots imported</p>
            </div>
            <div className="card-sm text-center">
              <p className="stat-value">{result.lotsSold}</p>
              <p className="stat-label">Lots sold</p>
            </div>
            <div className="card-sm text-center">
              <p className="stat-value text-xl">
                {formatCurrency(result.totalHammerValue)}
              </p>
              <p className="stat-label">Hammer value</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() =>
                router.push(`/dashboard/auctions/${result.auctionId}`)
              }
              className="btn-primary"
            >
              View auction
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Upload another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="page-title">Upload data</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Import auction results from CSV or Excel
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* File upload */}
        <div className="card space-y-4">
          <h2 className="section-title">Select file</h2>
          <p className="text-zinc-500 text-xs -mt-2">
            Auction name and sale number will be read from the file automatically
          </p>

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors duration-150 ${
                dragOver
                  ? "border-brand-500 bg-brand-500/5"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <Upload size={32} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Drag and drop your export file here
              </p>
              <p className="text-zinc-600 text-xs mb-4">
                CSV or Excel (.xlsx, .xls) — max 10MB
              </p>
              <label className="btn-secondary cursor-pointer text-sm">
                Browse files
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-zinc-800 rounded-lg px-4 py-3">
              <FileSpreadsheet
                size={20}
                className="text-brand-400 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setDetectionNote(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Auction details */}
        <div className="card space-y-4">
          <h2 className="section-title">Auction details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Auction date *</label>
              <div className="relative">
                <Calendar
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <input
                  type="date"
                  value={auctionDate}
                  onChange={(e) => setAuctionDate(e.target.value)}
                  className="input pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Office *</label>
              <div className="relative">
                <Building2
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <select
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
                  className="input pl-9 appearance-none"
                  required
                >
                  <option value="">Select office...</option>
                  {OFFICES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Auction category *</label>
              <div className="relative">
                <Tag
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <select
                  value={auctionCategory}
                  onChange={(e) => setAuctionCategory(e.target.value)}
                  className="input pl-9 appearance-none"
                  required
                >
                  <option value="">Select category...</option>
                  {AUCTION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {detectionNote && (
            <p className="text-gold-400 text-xs">{detectionNote}</p>
          )}

          {office === "Singapore" && (
            <p className="text-zinc-500 text-xs">
              Singapore sales are uploaded in SGD and converted to GBP at 1 SGD = £0.59
            </p>
          )}

          <p className="text-zinc-600 text-xs">
            The date, office and category are used for year-on-year comparisons and filtering
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            <AlertCircle
              size={16}
              className="text-red-400 flex-shrink-0 mt-0.5"
            />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || !auctionDate || !auctionCategory || !office || state === "uploading"}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {state === "uploading" ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z"
                />
              </svg>
              Importing...
            </>
          ) : (
            <>
              <Upload size={16} />
              Import auction data
            </>
          )}
        </button>

      </form>
    </div>
  );
}
