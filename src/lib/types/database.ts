export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      auctions: {
        Row: {
          id: string;
          created_at: string;
          sale_number: string | null;
          name: string;
          date: string;
          location: string | null;
          description: string | null;
          auction_category: string | null;
          total_lots: number;
          lots_sold: number;
          total_hammer_value: number;
          currency: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          sale_number?: string | null;
          name: string;
          date: string;
          location?: string | null;
          description?: string | null;
          auction_category?: string | null;
          total_lots?: number;
          lots_sold?: number;
          total_hammer_value?: number;
          currency?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          sale_number?: string | null;
          name?: string;
          date?: string;
          location?: string | null;
          description?: string | null;
          auction_category?: string | null;
          total_lots?: number;
          lots_sold?: number;
          total_hammer_value?: number;
          currency?: string;
        };
      };
      lots: {
        Row: {
          id: string;
          created_at: string;
          auction_id: string;
          lot_number: string | null;
          stock_number: string | null;
          title: string;
          description: string | null;
          department: string | null;
          category: string | null;
          item_location: string | null;
          receipt_no: string | null;
          estimate_low: number | null;
          estimate_high: number | null;
          start_price: number | null;
          reserve: number | null;
          hammer_price: number | null;
          hammer_and_bp: number | null;
          tax_status: string | null;
          commission_rate: string | null;
          sold: boolean;
          currency: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          auction_id: string;
          lot_number?: string | null;
          stock_number?: string | null;
          title: string;
          description?: string | null;
          department?: string | null;
          category?: string | null;
          item_location?: string | null;
          receipt_no?: string | null;
          estimate_low?: number | null;
          estimate_high?: number | null;
          start_price?: number | null;
          reserve?: number | null;
          hammer_price?: number | null;
          hammer_and_bp?: number | null;
          tax_status?: string | null;
          commission_rate?: string | null;
          sold?: boolean;
          currency?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          auction_id?: string;
          lot_number?: string | null;
          stock_number?: string | null;
          title?: string;
          description?: string | null;
          department?: string | null;
          category?: string | null;
          item_location?: string | null;
          receipt_no?: string | null;
          estimate_low?: number | null;
          estimate_high?: number | null;
          start_price?: number | null;
          reserve?: number | null;
          hammer_price?: number | null;
          hammer_and_bp?: number | null;
          tax_status?: string | null;
          commission_rate?: string | null;
          sold?: boolean;
          currency?: string;
          notes?: string | null;
        };
      };
      vendors: {
        Row: {
          id: string;
          created_at: string;
          name: string | null;
          email: string | null;
          country: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          country?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          country?: string | null;
        };
      };
      buyers: {
        Row: {
          id: string;
          created_at: string;
          name: string | null;
          email: string | null;
          country: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          country?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          country?: string | null;
        };
      };
      describers: {
        Row: {
          id: string;
          created_at: string;
          name: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
        };
      };
      lot_vendors: {
        Row: {
          id: string;
          lot_id: string;
          vendor_id: string;
        };
        Insert: {
          id?: string;
          lot_id: string;
          vendor_id: string;
        };
        Update: {
          id?: string;
          lot_id?: string;
          vendor_id?: string;
        };
      };
      lot_buyers: {
        Row: {
          id: string;
          lot_id: string;
          buyer_id: string;
        };
        Insert: {
          id?: string;
          lot_id: string;
          buyer_id: string;
        };
        Update: {
          id?: string;
          lot_id?: string;
          buyer_id?: string;
        };
      };
      lot_describers: {
        Row: {
          id: string;
          lot_id: string;
          describer_id: string;
        };
        Insert: {
          id?: string;
          lot_id: string;
          describer_id: string;
        };
        Update: {
          id?: string;
          lot_id?: string;
          describer_id?: string;
        };
      };
      uploads: {
        Row: {
          id: string;
          created_at: string;
          filename: string;
          auction_id: string;
          uploaded_by: string;
          row_count: number;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          filename: string;
          auction_id: string;
          uploaded_by: string;
          row_count?: number;
          status?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          filename?: string;
          auction_id?: string;
          uploaded_by?: string;
          row_count?: number;
          status?: string;
        };
      };
    };
  };
}

export type Auction = Database["public"]["Tables"]["auctions"]["Row"];
export type Lot = Database["public"]["Tables"]["lots"]["Row"];
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type Buyer = Database["public"]["Tables"]["buyers"]["Row"];
export type Describer = Database["public"]["Tables"]["describers"]["Row"];
export type Upload = Database["public"]["Tables"]["uploads"]["Row"];

export type AuctionWithLots = Auction & {
  lots: Lot[];
};

export type LotWithPeople = Lot & {
  vendors: Vendor[];
  buyers: Buyer[];
  describers: Describer[];
};

export type KPISummary = {
  totalAuctions: number;
  totalLots: number;
  totalSold: number;
  totalHammerValue: number;
  sellThroughRate: number;
  averageLotValue: number;
};

export type YearSummary = {
  year: number;
  totalAuctions: number;
  totalLots: number;
  totalSold: number;
  totalHammerValue: number;
  sellThroughRate: number;
};

export type CategorySummary = {
  category: string;
  totalLots: number;
  totalSold: number;
  totalHammerValue: number;
  sellThroughRate: number;
};

export type EstimateRange = {
  label: string;
  min: number;
  max: number | null;
};

export const ESTIMATE_RANGES: EstimateRange[] = [
  { label: "£100–£300",     min: 100,   max: 300   },
  { label: "£301–£500",     min: 301,   max: 500   },
  { label: "£501–£1,000",   min: 501,   max: 1000  },
  { label: "£1,001–£2,500", min: 1001,  max: 2500  },
  { label: "£2,501–£5,000", min: 2501,  max: 5000  },
  { label: "£5,000+",       min: 5001,  max: null  },
];

export const AUCTION_CATEGORIES = ["Stamps", "Coins", "Pop Culture"] as const;
export type AuctionCategory = typeof AUCTION_CATEGORIES[number];

export type DescriberSummary = {
  id: string;
  name: string;
  totalLots: number;
  totalSold: number;
  totalHammerValue: number;
  sellThroughRate: number;
  averageHammerVsEstimate: number;
  estimateRangeBreakdown: {
    range: string;
    totalLots: number;
    totalSold: number;
    sellThroughRate: number;
  }[];
};

export type UnsoldLot = {
  lotId: string;
  lotNumber: string | null;
  stockNumber: string | null;
  receiptNo: string | null;
  title: string;
  description: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  reserve: number | null;
  vendorName: string | null;
  vendorEmail: string | null;
};

export type TopBuyer = {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  totalLots: number;
  totalSpend: number;
};

export type TopVendor = {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  totalLots: number;
  totalHammerValue: number;
};
