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
export type Upload = Database["public"]["Tables"]["uploads"]["Row"];

export type AuctionWithLots = Auction & {
  lots: Lot[];
};

export type LotWithPeople = Lot & {
  vendors: Vendor[];
  buyers: Buyer[];
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
