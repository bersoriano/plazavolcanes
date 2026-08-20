export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus =
  | "requested"
  | "accepted"
  | "shipped"
  | "delivered"
  | "completed"
  | "rejected"
  | "canceled_by_buyer"
  | "canceled_by_seller"
  | "canceled_by_admin";

export type Database = {
  public: {
    Tables: {
      cart_items: {
        Row: { id: number; cart_id: number; product_id: number; quantity: number; created_at: string; updated_at: string };
        Insert: { id?: never; cart_id: number; product_id: number; quantity: number; created_at?: string; updated_at?: string };
        Update: { id?: never; cart_id?: number; product_id?: number; quantity?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      carts: {
        Row: { id: number; buyer_id: string; shop_id: number; created_at: string; updated_at: string };
        Insert: { id?: never; buyer_id: string; shop_id: number; created_at?: string; updated_at?: string };
        Update: { id?: never; buyer_id?: string; shop_id?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
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
          handling_days: number;
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
          handling_days?: number;
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
          handling_days?: number;
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
          listing_limit: number;
          name: string;
          owner_id: string;
          slug: string;
          time_zone: string;
          trust_evaluated_at: string | null;
          trust_tier: "standard" | "reliable" | "top_rated";
          updated_at: string;
        };
        Insert: {
          administrative_area_code?: string | null;
          country_code?: string;
          created_at?: string;
          description: string;
          id?: never;
          image_path?: string | null;
          listing_limit?: number;
          name: string;
          owner_id: string;
          slug: string;
          time_zone?: string;
          trust_evaluated_at?: string | null;
          trust_tier?: "standard" | "reliable" | "top_rated";
          updated_at?: string;
        };
        Update: {
          administrative_area_code?: string | null;
          country_code?: string;
          created_at?: string;
          description?: string;
          id?: never;
          image_path?: string | null;
          listing_limit?: number;
          name?: string;
          owner_id?: string;
          slug?: string;
          time_zone?: string;
          trust_evaluated_at?: string | null;
          trust_tier?: "standard" | "reliable" | "top_rated";
          updated_at?: string;
        };
        Relationships: [];
      };
      order_addresses: {
        Row: { order_id: number; recipient: string | null; address_line1: string | null; address_line2: string | null; locality: string | null; administrative_area: string | null; postal_code: string | null; country_code: string | null; delivery_instructions: string | null; redacted_at: string | null; created_at: string };
        Insert: { order_id: number; recipient?: string | null; address_line1?: string | null; address_line2?: string | null; locality?: string | null; administrative_area?: string | null; postal_code?: string | null; country_code?: string | null; delivery_instructions?: string | null; redacted_at?: string | null; created_at?: string };
        Update: { order_id?: number; recipient?: string | null; address_line1?: string | null; address_line2?: string | null; locality?: string | null; administrative_area?: string | null; postal_code?: string | null; country_code?: string | null; delivery_instructions?: string | null; redacted_at?: string | null; created_at?: string };
        Relationships: [];
      };
      order_events: {
        Row: { id: number; order_id: number; actor_id: string | null; actor_type: "buyer" | "seller" | "admin" | "system"; event_type: string; previous_status: string | null; next_status: string; metadata: Json; idempotency_key: string | null; created_at: string };
        Insert: { id?: never; order_id: number; actor_id?: string | null; actor_type: "buyer" | "seller" | "admin" | "system"; event_type: string; previous_status?: string | null; next_status: string; metadata?: Json; idempotency_key?: string | null; created_at?: string };
        Update: { id?: never; order_id?: number; actor_id?: string | null; actor_type?: "buyer" | "seller" | "admin" | "system"; event_type?: string; previous_status?: string | null; next_status?: string; metadata?: Json; idempotency_key?: string | null; created_at?: string };
        Relationships: [];
      };
      order_items: {
        Row: { id: number; order_id: number; product_id: number | null; product_name: string; unit_price: number; currency_code: string; quantity: number; line_total: number; handling_days: number; created_at: string };
        Insert: { id?: never; order_id: number; product_id?: number | null; product_name: string; unit_price: number; currency_code: string; quantity: number; line_total: number; handling_days: number; created_at?: string };
        Update: { id?: never; order_id?: number; product_id?: number | null; product_name?: string; unit_price?: number; currency_code?: string; quantity?: number; line_total?: number; handling_days?: number; created_at?: string };
        Relationships: [];
      };
      orders: {
        Row: { id: number; buyer_id: string; shop_id: number; status: OrderStatus; idempotency_key: string; currency_code: string; subtotal: number; buyer_note: string | null; handling_days: number; handling_time_zone: string; accepted_at: string | null; ship_by_at: string | null; shipped_at: string | null; delivered_at: string | null; buyer_confirmed_at: string | null; auto_completed_at: string | null; completed_at: string | null; canceled_at: string | null; canceled_by: string | null; tracking_text: string | null; created_at: string; updated_at: string };
        Insert: { id?: never; buyer_id: string; shop_id: number; status?: OrderStatus; idempotency_key: string; currency_code: string; subtotal: number; buyer_note?: string | null; handling_days: number; handling_time_zone: string; accepted_at?: string | null; ship_by_at?: string | null; shipped_at?: string | null; delivered_at?: string | null; buyer_confirmed_at?: string | null; auto_completed_at?: string | null; completed_at?: string | null; canceled_at?: string | null; canceled_by?: string | null; tracking_text?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: never; buyer_id?: string; shop_id?: number; status?: OrderStatus; idempotency_key?: string; currency_code?: string; subtotal?: number; buyer_note?: string | null; handling_days?: number; handling_time_zone?: string; accepted_at?: string | null; ship_by_at?: string | null; shipped_at?: string | null; delivered_at?: string | null; buyer_confirmed_at?: string | null; auto_completed_at?: string | null; completed_at?: string | null; canceled_at?: string | null; canceled_by?: string | null; tracking_text?: string | null; created_at?: string; updated_at?: string };
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
      add_cart_item: {
        Args: { p_product_id: number; p_quantity?: number };
        Returns: number;
      };
      checkout_cart: {
        Args: { p_shop_id: number; p_address: Json; p_buyer_note: string | null; p_idempotency_key: string };
        Returns: number;
      };
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
      remove_cart_item: {
        Args: { p_cart_item_id: number };
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
      set_cart_item_quantity: {
        Args: { p_cart_item_id: number; p_quantity: number };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Cart = Database["public"]["Tables"]["carts"]["Row"];
export type CartItem = Database["public"]["Tables"]["cart_items"]["Row"];
export type CategoryAlias = Database["public"]["Tables"]["category_aliases"]["Row"];
export type CategorySuggestion = Database["public"]["Tables"]["category_suggestions"]["Row"];
export type CategoryTranslation = Database["public"]["Tables"]["category_translations"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductTranslation = Database["public"]["Tables"]["product_translations"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderAddress = Database["public"]["Tables"]["order_addresses"]["Row"];
export type OrderEvent = Database["public"]["Tables"]["order_events"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type SearchEvent = Database["public"]["Tables"]["search_events"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type UserTrustProfile = Database["public"]["Tables"]["user_trust_profiles"]["Row"];
