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
          lot_number: string;
          title: string;
          artist: string | null;
          category: string | null;
          estimate_low: number | null;
          estimate_high: number | null;
          hammer_price: number | null;
          sold: boolean;
          currency: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          auction_id: string;
          lot_number: string;
          title: string;
          artist?: string | null;
          category?: string | null;
          estimate_low?: number | null;
          estimate_high?: number | null;
          hammer_price?: number | null;
          sold?: boolean;
          currency?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          auction_id?: string;
          lot_number?: string;
          title?: string;
          artist?: string | null;
          category?: string | null;
          estimate_low?: number | null;
          estimate_high?: number | null;
          hammer_price?: number | null;
          sold?: boolean;
          currency?: string;
          notes?: string | null;
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
export type Upload = Database["public"]["Tables"]["uploads"]["Row"];

export type AuctionWithLots = Auction & {
  lots: Lot[];
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
