import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
  // Matches patterns like S26000 in the filename
  const match = filename.match(/[Ss]\d{4,6}/);
  return match ? match[0].toUpperCase() : null;
}

function parseDate(rows: RawRow[]): string {
  // Try to extract a date from the lot created at field
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
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    // Extract auction metadata from the file itself
    const firstRow = rows[0];
    const auctionName = str(firstRow["Auction"]) ?? "Unnamed Auction";
    const saleNumber = extractSaleNumber(file.name);
    const auctionDate = parseDate(rows);
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

    // Process each row
    let lotsInserted = 0;
    let lotsSold = 0;
    let totalHammerValue = 0;

    for (const row of rows) {
      const hammerPrice = num(row["Hammer Price"]);
      const isSold = hammerPrice !== null && hammerPrice > 0;

      // Insert lot
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .insert({
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
          commission_rate: str(row["Commission Rate"]),
          sold: isSold,
          currency: "GBP",
        })
        .select()
        .single();

      if (lotError || !lot) {
        console.error("Lot insert error:", lotError);
        continue;
      }

      lotsInserted++;
      if (isSold) {
        lotsSold++;
        totalHammerValue += hammerPrice ?? 0;
      }

      // Handle vendor (name, email, country only)
      const vendorName = str(row["Vendor"]);
      const vendorEmail = str(row["Vendor Email"]);
      const vendorCountry = str(row["Vendor Shipping Country"]);

      if (vendorName || vendorEmail) {
        // Check if vendor already exists by email
        let vendorId: string | null = null;

        if (vendorEmail) {
          const { data: existing } = await supabase
            .from("vendors")
            .select("id")
            .eq("email", vendorEmail)
            .single();

          if (existing) {
            vendorId = existing.id;
          }
        }

        if (!vendorId) {
          const { data: newVendor } = await supabase
            .from("vendors")
            .insert({
              name: vendorName,
              email: vendorEmail,
              country: vendorCountry,
            })
            .select()
            .single();

          if (newVendor) vendorId = newVendor.id;
        }

        if (vendorId) {
          await supabase.from("lot_vendors").insert({
            lot_id: lot.id,
            vendor_id: vendorId,
          });
        }
      }

      // Handle buyer (name, email, country only)
      const buyerName = str(row["Buyer"]);
      const buyerEmail = str(row["Buyer Email"]);
      const buyerCountry = str(row["Buyer Shipping Country"]);

      if (isSold && (buyerName || buyerEmail)) {
        let buyerId: string | null = null;

        if (buyerEmail) {
          const { data: existing } = await supabase
            .from("buyers")
            .select("id")
            .eq("email", buyerEmail)
            .single();

          if (existing) {
            buyerId = existing.id;
          }
        }

        if (!buyerId) {
          const { data: newBuyer } = await supabase
            .from("buyers")
            .insert({
              name: buyerName,
              email: buyerEmail,
              country: buyerCountry,
            })
            .select()
            .single();

          if (newBuyer) buyerId = newBuyer.id;
        }

        if (buyerId) {
          await supabase.from("lot_buyers").insert({
            lot_id: lot.id,
            buyer_id: buyerId,
          });
        }
      }
    }

    // Update auction summary stats
    await supabase
      .from("auctions")
      .update({
        total_lots: lotsInserted,
        lots_sold: lotsSold,
        total_hammer_value: totalHammerValue,
      })
      .eq("id", auction.id);

    // Log the upload
    await supabase.from("uploads").insert({
      filename: file.name,
      auction_id: auction.id,
      uploaded_by: user.id,
      row_count: lotsInserted,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      auctionId: auction.id,
      auctionName,
      saleNumber,
      lotsImported: lotsInserted,
      lotsSold,
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
