import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  AUCTION_CATEGORIES,
  OFFICES,
  SGD_TO_GBP,
  detectOfficeAndCategory,
  type Office,
} from "@/lib/types/database";

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

// Parses a money value and converts it to GBP using the supplied rate (1 for London)
function money(value: unknown, fxRate: number): number | null {
  const n = num(value);
  if (n === null) return null;
  return Math.round(n * fxRate * 100) / 100;
}

// Keeps the full prefix, e.g. SGS26028, SGE26018, CB26004, S26000
function extractSaleNumber(filename: string): string | null {
  const match = filename.match(/[A-Za-z]{1,4}\d{4,6}/);
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
        raw: true,
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

    // Office + category: use what the upload form sent, otherwise detect from the sale number
    const detected = detectOfficeAndCategory(saleNumber);

    const officeInput = formData.get("office") as string | null;
    const office: Office =
      officeInput && (OFFICES as readonly string[]).includes(officeInput)
        ? (officeInput as Office)
        : detected?.office ?? "London";

    const categoryInput = formData.get("auction_category") as string | null;
    const auctionCategory: string | null =
      categoryInput && (AUCTION_CATEGORIES as readonly string[]).includes(categoryInput)
        ? categoryInput
        : detected?.category ?? null;

    // Singapore sales are in SGD — convert everything to GBP at upload
    const isSingapore = office === "Singapore";
    const fxRate = isSingapore ? SGD_TO_GBP : 1;
    const sourceCurrency = isSingapore ? "SGD" : "GBP";

    // Create auction record
    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .insert({
        sale_number: saleNumber,
        name: auctionName,
        date: auctionDate,
        location: auctionLocation,
        auction_category: auctionCategory,
        office,
        source_currency: sourceCurrency,
        fx_rate: fxRate,
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
      const hammerPrice = money(row["Hammer Price"], fxRate);
      const isSold = hammerPrice !== null && hammerPrice > 0;
      return {
        auction_id: auction.id,
        lot_number: str(row["Lot No"]),
        stock_number: str(row["Stock No"]),
        title: str(row["Title"]) ?? "Untitled",
        description: str(row["Description"]),
        department: str(row["Department"]),
        category: str(row["Category"]),
        item_location: str(row["Item Location"]),
        receipt_no: str(row["Receipt No"]),
        estimate_low: money(row["Low"], fxRate),
        estimate_high: money(row["High"], fxRate),
        start_price: money(row["Start Price"], fxRate),
        reserve: money(row["Reserve"], fxRate),
        hammer_price: hammerPrice,
        hammer_and_bp: money(row["Hammer & BP (VAT incl.)"], fxRate),
        tax_status: str(row["Tax Status"]),
        commission_rate: str(row["Commission Rate"]),
        sold: isSold,
        currency: "GBP",
      };
    });

    // Batch insert lots in chunks of 100
    const chunkSize = 100;
    const insertedLots: {
      id: string;
      sold: boolean;
      hammer_price: number | null;
      lot_number: string | null;
    }[] = [];

    for (let i = 0; i < lotsToInsert.length; i += chunkSize) {
      const chunk = lotsToInsert.slice(i, i + chunkSize);
      const { data: inserted, error: lotsError } = await supabase
        .from("lots")
        .insert(chunk)
        .select("id, sold, hammer_price, lot_number");

      if (lotsError) {
        console.error("Lots insert error:", lotsError);
        await supabase.from("auctions").delete().eq("id", auction.id);
        return NextResponse.json(
          { error: "Failed to insert lots" },
          { status: 500 }
        );
      }

      if (inserted) insertedLots.push(...inserted);
    }

    // Calculate stats
    const soldLots = insertedLots.filter((l) => l.sold);
    const totalHammerValue = soldLots.reduce(
      (sum, l) => sum + (l.hammer_price ?? 0), 0
    );

    // Build lot number -> id map with normalised keys
    const lotMap = new Map(
      insertedLots.map((l) => [String(l.lot_number ?? "").trim(), l.id])
    );

    // ── Vendors ──────────────────────────────────────────────────────
    const vendorMap = new Map<string, { name: string | null; email: string; country: string | null }>();
    for (const row of rows) {
      const vendorEmail = str(row["Vendor Email"]);
      if (vendorEmail && !vendorMap.has(vendorEmail)) {
        vendorMap.set(vendorEmail, {
          name: str(row["Vendor"]),
          email: vendorEmail,
          country: str(row["Vendor Shipping Country"]),
        });
      }
    }

    const vendorEmailToId = new Map<string, string>();
    if (vendorMap.size > 0) {
      const vendorEmails = Array.from(vendorMap.keys());
      const { data: existingVendors } = await supabase
        .from("vendors")
        .select("id, email")
        .in("email", vendorEmails);

      if (existingVendors) {
        for (const v of existingVendors) {
          if (v.email) vendorEmailToId.set(v.email, v.id);
        }
      }

      const newVendors = Array.from(vendorMap.values()).filter(
        (v) => !vendorEmailToId.has(v.email)
      );

      if (newVendors.length > 0) {
        const { data: inserted } = await supabase
          .from("vendors")
          .insert(newVendors)
          .select("id, email");
        if (inserted) {
          for (const v of inserted) {
            if (v.email) vendorEmailToId.set(v.email, v.id);
          }
        }
      }
    }

    // ── Buyers ───────────────────────────────────────────────────────
    const buyerMap = new Map<string, { name: string | null; email: string; country: string | null }>();
    for (const row of rows) {
      const hammerPrice = num(row["Hammer Price"]);
      const isSold = hammerPrice !== null && hammerPrice > 0;
      const buyerEmail = str(row["Buyer Email"]);
      if (isSold && buyerEmail && !buyerMap.has(buyerEmail)) {
        buyerMap.set(buyerEmail, {
          name: str(row["Buyer"]),
          email: buyerEmail,
          country: str(row["Buyer Shipping Country"]),
        });
      }
    }

    const buyerEmailToId = new Map<string, string>();
    if (buyerMap.size > 0) {
      const buyerEmails = Array.from(buyerMap.keys());
      const { data: existingBuyers } = await supabase
        .from("buyers")
        .select("id, email")
        .in("email", buyerEmails);

      if (existingBuyers) {
        for (const b of existingBuyers) {
          if (b.email) buyerEmailToId.set(b.email, b.id);
        }
      }

      const newBuyers = Array.from(buyerMap.values()).filter(
        (b) => !buyerEmailToId.has(b.email)
      );

      if (newBuyers.length > 0) {
        const { data: inserted } = await supabase
          .from("buyers")
          .insert(newBuyers)
          .select("id, email");
        if (inserted) {
          for (const b of inserted) {
            if (b.email) buyerEmailToId.set(b.email, b.id);
          }
        }
      }
    }

    // ── Describers ───────────────────────────────────────────────────
    const describerNames = new Set<string>();
    for (const row of rows) {
      const name = str(row["Lot Created By"] ?? row["Lot created By"] ?? row["Lot created by"]);
      if (name) describerNames.add(name);
    }

    const describerNameToId = new Map<string, string>();
    if (describerNames.size > 0) {
      const names = Array.from(describerNames);

      const { data: existingDescribers } = await supabase
        .from("describers")
        .select("id, name")
        .in("name", names);

      if (existingDescribers) {
        for (const d of existingDescribers) {
          describerNameToId.set(d.name, d.id);
        }
      }

      const newDescribers = names
        .filter((name) => !describerNameToId.has(name))
        .map((name) => ({ name }));

      if (newDescribers.length > 0) {
        const { data: inserted } = await supabase
          .from("describers")
          .insert(newDescribers)
          .select("id, name");
        if (inserted) {
          for (const d of inserted) {
            describerNameToId.set(d.name, d.id);
          }
        }
      }
    }

    // ── Junction tables ──────────────────────────────────────────────
    const lotVendors: { lot_id: string; vendor_id: string }[] = [];
    const lotBuyers: { lot_id: string; buyer_id: string }[] = [];
    const lotDescribers: { lot_id: string; describer_id: string }[] = [];

    for (const row of rows) {
      const lotNo = String(str(row["Lot No"]) ?? "").trim();
      const lotId = lotNo ? lotMap.get(lotNo) : undefined;
      if (!lotId) continue;

      const vendorEmail = str(row["Vendor Email"]);
      if (vendorEmail) {
        const vendorId = vendorEmailToId.get(vendorEmail);
        if (vendorId) lotVendors.push({ lot_id: lotId, vendor_id: vendorId });
      }

      const hammerPrice = num(row["Hammer Price"]);
      const isSold = hammerPrice !== null && hammerPrice > 0;
      const buyerEmail = str(row["Buyer Email"]);
      if (isSold && buyerEmail) {
        const buyerId = buyerEmailToId.get(buyerEmail);
        if (buyerId) lotBuyers.push({ lot_id: lotId, buyer_id: buyerId });
      }

      const describerName = str(row["Lot Created By"] ?? row["Lot created By"] ?? row["Lot created by"]);
      if (describerName) {
        const describerId = describerNameToId.get(describerName);
        if (describerId) lotDescribers.push({ lot_id: lotId, describer_id: describerId });
      }
    }

    // Batch insert junctions
    for (let i = 0; i < lotVendors.length; i += chunkSize) {
      await supabase.from("lot_vendors").insert(lotVendors.slice(i, i + chunkSize));
    }
    for (let i = 0; i < lotBuyers.length; i += chunkSize) {
      await supabase.from("lot_buyers").insert(lotBuyers.slice(i, i + chunkSize));
    }
    for (let i = 0; i < lotDescribers.length; i += chunkSize) {
      await supabase.from("lot_describers").insert(lotDescribers.slice(i, i + chunkSize));
    }

    // Update auction summary stats
    await supabase
      .from("auctions")
      .update({
        total_lots: insertedLots.length,
        lots_sold: soldLots.length,
        total_hammer_value: totalHammerValue,
      })
      .eq("id", auction.id);

    // Log the upload
    await supabase.from("uploads").insert({
      filename: file.name,
      auction_id: auction.id,
      uploaded_by: user.id,
      row_count: insertedLots.length,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      auctionId: auction.id,
      auctionName,
      saleNumber,
      office,
      auctionCategory,
      sourceCurrency,
      fxRate,
      lotsImported: insertedLots.length,
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
