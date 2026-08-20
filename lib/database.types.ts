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
      categories: {
        Row: {
          created_at: string;
          id: number;
          is_active: boolean;
          listing_type: "product" | "service" | "restaurant";
          parent_id: number | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          is_active?: boolean;
          listing_type: "product" | "service" | "restaurant";
          parent_id?: number | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          is_active?: boolean;
          listing_type?: "product" | "service" | "restaurant";
          parent_id?: number | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_aliases: {
        Row: {
          alias: string;
          category_id: number;
          locale: "es-MX" | "en-US";
        };
        Insert: {
          alias: string;
          category_id: number;
          locale: "es-MX" | "en-US";
        };
        Update: {
          alias?: string;
          category_id?: number;
          locale?: "es-MX" | "en-US";
        };
        Relationships: [
          {
            foreignKeyName: "category_aliases_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_suggestions: {
        Row: {
          context: string | null;
          created_at: string;
          id: number;
          locale: "es-MX" | "en-US";
          reviewed_at: string | null;
          root_category_id: number | null;
          seller_id: string;
          status: "pending" | "approved" | "rejected";
          suggested_name: string;
        };
        Insert: {
          context?: string | null;
          created_at?: string;
          id?: never;
          locale: "es-MX" | "en-US";
          reviewed_at?: string | null;
          root_category_id?: number | null;
          seller_id: string;
          status?: "pending" | "approved" | "rejected";
          suggested_name: string;
        };
        Update: {
          context?: string | null;
          created_at?: string;
          id?: never;
          locale?: "es-MX" | "en-US";
          reviewed_at?: string | null;
          root_category_id?: number | null;
          seller_id?: string;
          status?: "pending" | "approved" | "rejected";
          suggested_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_suggestions_root_category_id_fkey";
            columns: ["root_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_translations: {
        Row: {
          category_id: number;
          description: string | null;
          locale: "es-MX" | "en-US";
          name: string;
        };
        Insert: {
          category_id: number;
          description?: string | null;
          locale: "es-MX" | "en-US";
          name: string;
        };
        Update: {
          category_id?: number;
          description?: string | null;
          locale?: "es-MX" | "en-US";
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_translations: {
        Row: {
          created_at: string;
          description: string;
          locale: "es-MX" | "en-US";
          name: string;
          product_id: number;
          review_status: "draft" | "approved";
          search_document: unknown;
          source: "manual" | "ai";
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          locale: "es-MX" | "en-US";
          name: string;
          product_id: number;
          review_status?: "draft" | "approved";
          source?: "manual" | "ai";
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          locale?: "es-MX" | "en-US";
          name?: string;
          product_id?: number;
          review_status?: "draft" | "approved";
          source?: "manual" | "ai";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: number | null;
          condition: "new" | "used";
          content_locale: "es-MX" | "en-US";
          created_at: string;
          currency_code: string;
          description: string;
          id: number;
          image_path: string | null;
          name: string;
          price_mxn: number;
          search_document: unknown;
          shop_id: number;
          status: "draft" | "published";
          updated_at: string;
          used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
        };
        Insert: {
          category_id?: number | null;
          condition?: "new" | "used";
          content_locale?: "es-MX" | "en-US";
          created_at?: string;
          currency_code?: string;
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
          category_id?: number | null;
          condition?: "new" | "used";
          content_locale?: "es-MX" | "en-US";
          created_at?: string;
          currency_code?: string;
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
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      search_events: {
        Row: {
          category_id: number | null;
          country_code: string;
          created_at: string;
          id: string;
          locale: "es-MX" | "en-US";
          normalized_query: string;
          result_count: number;
          selected_at: string | null;
          selected_position: number | null;
          selected_product_id: number | null;
        };
        Insert: {
          category_id?: number | null;
          country_code: string;
          created_at?: string;
          id?: string;
          locale: "es-MX" | "en-US";
          normalized_query: string;
          result_count: number;
          selected_at?: string | null;
          selected_position?: number | null;
          selected_product_id?: number | null;
        };
        Update: {
          category_id?: number | null;
          country_code?: string;
          created_at?: string;
          id?: string;
          locale?: "es-MX" | "en-US";
          normalized_query?: string;
          result_count?: number;
          selected_at?: string | null;
          selected_position?: number | null;
          selected_product_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "search_events_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "search_events_selected_product_id_fkey";
            columns: ["selected_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
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
      user_trust_profiles: {
        Row: {
          joined_on: string;
          user_id: string;
          verification_level:
            | "unverified"
            | "basic"
            | "verified"
            | "highly_verified";
        };
        Insert: {
          joined_on: string;
          user_id: string;
          verification_level?:
            | "unverified"
            | "basic"
            | "verified"
            | "highly_verified";
        };
        Update: {
          joined_on?: string;
          user_id?: string;
          verification_level?:
            | "unverified"
            | "basic"
            | "verified"
            | "highly_verified";
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      record_catalog_search: {
        Args: {
          p_category_id: number | null;
          p_country_code: string;
          p_locale: string;
          p_query: string;
          p_result_count: number;
        };
        Returns: string;
      };
      record_search_selection: {
        Args: {
          p_event_id: string;
          p_position: number;
          p_product_id: number;
        };
        Returns: undefined;
      };
      search_product_ids: {
        Args: {
          p_category_id: number | null;
          p_country_code: string | null;
          p_limit: number;
          p_locale: string;
          p_query: string;
        };
        Returns: {
          product_id: number;
          rank: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryAlias = Database["public"]["Tables"]["category_aliases"]["Row"];
export type CategorySuggestion = Database["public"]["Tables"]["category_suggestions"]["Row"];
export type CategoryTranslation = Database["public"]["Tables"]["category_translations"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductTranslation = Database["public"]["Tables"]["product_translations"]["Row"];
export type SearchEvent = Database["public"]["Tables"]["search_events"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type UserTrustProfile = Database["public"]["Tables"]["user_trust_profiles"]["Row"];
