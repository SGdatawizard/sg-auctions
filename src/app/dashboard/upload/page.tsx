"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";

type UploadState = "idle" | "uploading" | "success" | "error";

type UploadResult = {
  auctionId: string;
  lotsImported: number;
  lotsSold: number;
  totalHammerValue: number;
};

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [auctionName, setAuctionName] = useState("");
  const [auctionDate, setAuctionDate] = useState("");
  const [auctionLocation, setAuctionLocation] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      const name = dropped.name.toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        setError("Only CSV and Excel files are supported");
        return;
      }
      setFile(dropped);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !auctionName || !auctionDate) return;

    setState("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("auction_name", auctionName);
    formData.append("auction_date", auctionDate);
    formData.append("auction_location", auctionLocation);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
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
    setAuctionName("");
    setAuctionDate("");
    setAuctionLocation("");
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
          <CheckCircle2
            size={48}
            className="text-emerald-400 mx-auto mb-4"
          />
          <h2 className="section-title mb-2">Upload successful</h2>
          <p className="text-zinc-500 text-sm mb-6">
            Your auction data has been imported
          </p>

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
        {/* Auction details */}
        <div className="card space-y-4">
          <h2 className="section-title">Auction details</h2>

          <div>
            <label className="label">Auction name *</label>
            <input
              type="text"
              value={auctionName}
              onChange={(e) => setAuctionName(e.target.value)}
              className="input"
              placeholder="e.g. Spring Fine Art Sale 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Auction date *</label>
              <input
                type="date"
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                type="text"
                value={auctionLocation}
                onChange={(e) => setAuctionLocation(e.target.value)}
                className="input"
                placeholder="e.g. London"
              />
            </div>
          </div>
        </div>

        {/* File upload */}
        <div className="card space-y-4">
          <h2 className="section-title">File</h2>

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
              <Upload
                size={32}
                className="text-zinc-600 mx-auto mb-3"
              />
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Drag and drop your file here
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
                onClick={() => setFile(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Expected format */}
        <div className="card-sm bg-zinc-900/50">
          <p className="text-xs font-medium text-zinc-400 mb-2">
            Expected CSV columns
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "lot_number",
              "title",
              "artist",
              "category",
              "estimate_low",
              "estimate_high",
              "hammer_price",
              "sold",
              "currency",
              "notes",
            ].map((col) => (
              <span
                key={col}
                className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono"
              >
                {col}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Column names are flexible — the parser will match common variations
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
          disabled={!file || !auctionName || !auctionDate || state === "uploading"}
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
