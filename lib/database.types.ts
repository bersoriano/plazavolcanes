export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      shops: {
        Row: {
          administrative_area_code: string | null;
          country_code: string;
          created_at: string;
          description: string;
          id: number;
          image_path: string | null;
          name: string;
          owner_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          administrative_area_code?: string | null;
          country_code?: string;
          created_at?: string;
          description: string;
          id?: never;
          image_path?: string | null;
          name: string;
          owner_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          administrative_area_code?: string | null;
          country_code?: string;
          created_at?: string;
          description?: string;
          id?: never;
          image_path?: string | null;
          name?: string;
          owner_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          condition: "new" | "used";
          created_at: string;
          description: string;
          id: number;
          image_path: string | null;
          name: string;
          price_mxn: number;
          shop_id: number;
          status: "draft" | "published";
          updated_at: string;
          used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
        };
        Insert: {
          condition?: "new" | "used";
          created_at?: string;
          description: string;
          id?: never;
          image_path?: string | null;
          name: string;
          price_mxn: number;
          shop_id: number;
          status?: "draft" | "published";
          updated_at?: string;
          used_condition?: "mint" | "good" | "fair" | "bad" | "scrap" | null;
        };
        Update: {
          condition?: "new" | "used";
          created_at?: string;
          description?: string;
          id?: never;
          image_path?: string | null;
          name?: string;
          price_mxn?: number;
          shop_id?: number;
          status?: "draft" | "published";
          updated_at?: string;
          used_condition?: "mint" | "good" | "fair" | "bad" | "scrap" | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
