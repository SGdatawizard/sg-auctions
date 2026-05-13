import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type RawRow = Record<string, string | number | null | undefined>;

function normaliseHeaders(row: RawRow): RawRow {
  const normalised: RawRow = {};
  for (const key of Object.keys(row)) {
    normalised[key.toLowerCase().trim().replace(/\s+/g, "_")] = row[key];
  }
  return normalised;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[£$€,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase().trim();
  return ["yes", "true", "sold", "1"].includes(str);
}

function parseRows(rows: RawRow[], auctionId: string) {
  return rows
    .filter((row) => {
      const n = normaliseHeaders(row);
      return n.lot_number || n.lot || n.title;
    })
    .map((row) => {
      const n = normaliseHeaders(row);
      return {
        auction_id: auctionId,
        lot_number: String(n.lot_number ?? n.lot ?? ""),
        title: String(n.title ?? n.description ?? n.item ?? "Untitled"),
        artist: n.artist ? String(n.artist) : null,
        category: n.category ?? n.type ?? n.department
          ? String(n.category ?? n.type ?? n.department)
          : null,
        estimate_low: parseNumber(n.estimate_low ?? n.low_estimate ?? n.estimate),
        estimate_high: parseNumber(n.estimate_high ?? n.high_estimate ?? null),
        hammer_price: parseNumber(n.hammer_price ?? n.hammer ?? n.price ?? n.sold_price ?? null),
        sold: parseBool(n.sold ?? n.status ?? n.result ?? false),
        currency: String(n.currency ?? "GBP"),
        notes: n.notes ? String(n.notes) : null,
      };
    });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const auctionName = formData.get("auction_name") as string | null;
    const auctionDate = formData.get("auction_date") as string | null;
    const auctionLocation = formData.get("auction_location") as string | null;

    if (!file || !auctionName || !auctionDate) {
      return NextResponse.json(
        { error: "File, auction name and date are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        { error: "Only CSV and Excel files are supported" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      );
    }

    // Parse file
    let rows: RawRow[] = [];
    const buffer = await file.arrayBuffer();

    if (isCSV) {
      const text = new TextDecoder().decode(buffer);
      const result = Papa.parse<RawRow>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      rows = result.data;
    } else {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in file" },
        { status: 400 }
      );
    }

    // Create auction record
    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .insert({
        name: auctionName,
        date: auctionDate,
        location: auctionLocation ?? null,
        total_lots: 0,
        lots_sold: 0,
        total_hammer_value: 0,
        currency: "GBP",
      })
      .select()
      .single();

    if (auctionError || !auction) {
      return NextResponse.json(
        { error: "Failed to create auction record" },
        { status: 500 }
      );
    }

    // Parse and insert lots
    const lots = parseRows(rows, auction.id);

    const { error: lotsError } = await supabase
      .from("lots")
      .insert(lots);

    if (lotsError) {
      // Roll back auction if lots fail
      await supabase.from("auctions").delete().eq("id", auction.id);
      return NextResponse.json(
        { error: "Failed to insert lots" },
        { status: 500 }
      );
    }

    // Calculate and update auction summary stats
    const soldLots = lots.filter((l) => l.sold);
    const totalHammerValue = soldLots.reduce(
      (sum, l) => sum + (l.hammer_price ?? 0),
      0
    );

    await supabase
      .from("auctions")
      .update({
        total_lots: lots.length,
        lots_sold: soldLots.length,
        total_hammer_value: totalHammerValue,
      })
      .eq("id", auction.id);

    // Log the upload
    await supabase.from("uploads").insert({
      filename: file.name,
      auction_id: auction.id,
      uploaded_by: user.id,
      row_count: lots.length,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      auctionId: auction.id,
      lotsImported: lots.length,
      lotsSold: soldLots.length,
      totalHammerValue,
    });

  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
