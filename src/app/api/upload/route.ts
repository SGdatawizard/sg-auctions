import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type RawRow = Record<string, string | number | null | undefined>;

function str(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[£$€,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function extractSaleNumber(filename: string): string | null {
  const match = filename.match(/[Ss]\d{4,6}/);
  return match ? match[0].toUpperCase() : null;
}

function parseDate(rows: RawRow[]): string {
  for (const row of rows) {
    const val = row["Lot created At"] ?? row["Lot Created At"] ?? row["Item Created At"];
    if (val) {
      const d = new Date(String(val));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    }
  }
  return new Date().toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        { error: "Only CSV and Excel files are supported" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      );
    }

    // Parse file into rows
    let rows: RawRow[] = [];
    const buffer = await file.arrayBuffer();

    if (isCSV) {
      const text = new TextDecoder().decode(buffer);
      const result = Papa.parse<RawRow>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      rows = result.data;
    } else {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
        defval: null,
        raw: false,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in file" },
        { status: 400 }
      );
    }

    // Extract auction metadata
    const firstRow = rows[0];
    const auctionName = str(firstRow["Auction"]) ?? "Unnamed Auction";
    const saleNumber = extractSaleNumber(file.name);
    const auctionDate = (formData.get("auction_date") as string | null) ?? parseDate(rows);
    const auctionLocation = str(firstRow["Item Location"]) ?? null;

    // Create auction record
    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .insert({
        sale_number: saleNumber,
        name: auctionName,
        date: auctionDate,
        location: auctionLocation,
        total_lots: 0,
        lots_sold: 0,
        total_hammer_value: 0,
        currency: "GBP",
      })
      .select()
      .single();

    if (auctionError || !auction) {
      console.error("Auction insert error:", auctionError);
      return NextResponse.json(
        { error: "Failed to create auction record" },
        { status: 500 }
      );
    }

    // Build lots array for batch insert
    const lotsToInsert = rows.map((row) => {
      const hammerPrice = num(row["Hammer Price"]);
      const isSold = hammerPrice !== null && hammerPrice > 0;
      return {
        auction_id: auction.id,
        lot_number: str(row["Lot No"]),
        stock_number: str(row["Stock No"]),
        title: str(row["Title"]) ?? "Untitled",
        department: str(row["Department"]),
        category: str(row["Category"]),
        item_location: str(row["Item Location"]),
        receipt_no: str(row["Receipt No"]),
        estimate_low: num(row["Low"]),
        estimate_high: num(row["High"]),
        start_price: num(row["Start Price"]),
        reserve: num(row["Reserve"]),
        hammer_price: hammerPrice,
        hammer_and_bp: num(row["Hammer & BP (VAT incl.)"]),
        tax_status: str(row["Tax Status"]),
        commissi
