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

export type LegalDocumentStatus = "draft" | "approved" | "published" | "retired";

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
      conversations: {
        Row: { id: number; shop_id: number; buyer_id: string; order_id: number | null; product_id: number | null; type: "pre_sale" | "order"; created_at: string; updated_at: string };
        Insert: { id?: never; shop_id: number; buyer_id: string; order_id?: number | null; product_id?: number | null; type: "pre_sale" | "order"; created_at?: string; updated_at?: string };
        Update: { id?: never; shop_id?: number; buyer_id?: string; order_id?: number | null; product_id?: number | null; type?: "pre_sale" | "order"; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      conversation_reads: {
        Row: { conversation_id: number; user_id: string; last_read_message_id: number; updated_at: string };
        Insert: { conversation_id: number; user_id: string; last_read_message_id: number; updated_at?: string };
        Update: { conversation_id?: number; user_id?: string; last_read_message_id?: number; updated_at?: string };
        Relationships: [];
      };
      user_display_names: {
        Row: { user_id: string; display_name: string; updated_at: string };
        Insert: { user_id: string; display_name: string; updated_at?: string };
        Update: { user_id?: string; display_name?: string; updated_at?: string };
        Relationships: [];
      };
      admin_read_events: {
        Row: { id: number; admin_id: string; conversation_id: number; reason: string; created_at: string };
        Insert: { id?: never; admin_id: string; conversation_id: number; reason: string; created_at?: string };
        Update: { id?: never; admin_id?: string; conversation_id?: number; reason?: string; created_at?: string };
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
      product_images: {
        Row: {
          id: number;
          product_id: number;
          storage_path: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: never;
          product_id: number;
          storage_path: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: never;
          product_id?: number;
          storage_path?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
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
          is_admin_enabled: boolean;
          name: string;
          price_mxn: number;
          search_document: unknown;
          shop_id: number;
          slug: string;
          status: "draft" | "published" | "expired" | "deleted";
          units_available: number;
          expires_at: string | null;
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
          is_admin_enabled?: boolean;
          name: string;
          price_mxn: number;
          shop_id: number;
          slug: string;
          status?: "draft" | "published" | "expired" | "deleted";
          units_available?: number;
          expires_at?: string | null;
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
          is_admin_enabled?: boolean;
          name?: string;
          price_mxn?: number;
          shop_id?: number;
          slug?: string;
          status?: "draft" | "published" | "expired" | "deleted";
          units_available?: number;
          expires_at?: string | null;
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
          administrative_area_codes: string[] | null;
          country_code: string;
          created_at: string;
          description: string;
          id: number;
          image_path: string | null;
          is_publishing_approved: boolean;
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
          administrative_area_codes?: string[] | null;
          country_code?: string;
          created_at?: string;
          description: string;
          id?: never;
          image_path?: string | null;
          is_publishing_approved?: boolean;
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
          administrative_area_codes?: string[] | null;
          country_code?: string;
          created_at?: string;
          description?: string;
          id?: never;
          image_path?: string | null;
          is_publishing_approved?: boolean;
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
      shop_pickup_points: {
        Row: { shop_id: number; address_line1: string; locality: string; administrative_area_code: string; postal_code: string; notes: string | null; created_at: string; updated_at: string };
        Insert: { shop_id: number; address_line1: string; locality: string; administrative_area_code: string; postal_code: string; notes?: string | null; created_at?: string; updated_at?: string };
        Update: { shop_id?: number; address_line1?: string; locality?: string; administrative_area_code?: string; postal_code?: string; notes?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      shop_trust_evaluation_queue: {
        Row: { shop_id: number; dirty_at: string; next_attempt_at: string; attempt_count: number; last_error: string | null; locked_at: string | null; last_success_at: string | null };
        Insert: { shop_id: number; dirty_at?: string; next_attempt_at?: string; attempt_count?: number; last_error?: string | null; locked_at?: string | null; last_success_at?: string | null };
        Update: { shop_id?: number; dirty_at?: string; next_attempt_at?: string; attempt_count?: number; last_error?: string | null; locked_at?: string | null; last_success_at?: string | null };
        Relationships: [];
      };
      shop_trust_evaluations: {
        Row: { id: number; shop_id: number; average_reply_time_minutes: number | null; response_rate: number | null; description_accuracy: number | null; on_time_shipping_rate: number | null; order_completion_rate: number | null; dispute_rate: number | null; total_orders: number | null; average_rating: number | null; review_count: number | null; last_active_days_ago: number | null; open_dispute_count: number; metric_qualified_tier: "standard" | "reliable" | "top_rated"; effective_tier: "standard" | "reliable" | "top_rated"; free_listing_limit: number; reasons: Json; next_tier_requirements: Json; summary: string; evaluator_policy_version: string; evaluated_at: string };
        Insert: { id?: never; shop_id: number; average_reply_time_minutes?: number | null; response_rate?: number | null; description_accuracy?: number | null; on_time_shipping_rate?: number | null; order_completion_rate?: number | null; dispute_rate?: number | null; total_orders?: number | null; average_rating?: number | null; review_count?: number | null; last_active_days_ago?: number | null; open_dispute_count: number; metric_qualified_tier: "standard" | "reliable" | "top_rated"; effective_tier: "standard" | "reliable" | "top_rated"; free_listing_limit: number; reasons: Json; next_tier_requirements: Json; summary: string; evaluator_policy_version?: string; evaluated_at?: string };
        Update: { id?: never; shop_id?: number; average_reply_time_minutes?: number | null; response_rate?: number | null; description_accuracy?: number | null; on_time_shipping_rate?: number | null; order_completion_rate?: number | null; dispute_rate?: number | null; total_orders?: number | null; average_rating?: number | null; review_count?: number | null; last_active_days_ago?: number | null; open_dispute_count?: number; metric_qualified_tier?: "standard" | "reliable" | "top_rated"; effective_tier?: "standard" | "reliable" | "top_rated"; free_listing_limit?: number; reasons?: Json; next_tier_requirements?: Json; summary?: string; evaluator_policy_version?: string; evaluated_at?: string };
        Relationships: [];
      };
      order_addresses: {
        Row: { order_id: number; recipient: string | null; address_line1: string | null; address_line2: string | null; locality: string | null; administrative_area: string | null; postal_code: string | null; country_code: string | null; delivery_instructions: string | null; redacted_at: string | null; created_at: string };
        Insert: { order_id: number; recipient?: string | null; address_line1?: string | null; address_line2?: string | null; locality?: string | null; administrative_area?: string | null; postal_code?: string | null; country_code?: string | null; delivery_instructions?: string | null; redacted_at?: string | null; created_at?: string };
        Update: { order_id?: number; recipient?: string | null; address_line1?: string | null; address_line2?: string | null; locality?: string | null; administrative_area?: string | null; postal_code?: string | null; country_code?: string | null; delivery_instructions?: string | null; redacted_at?: string | null; created_at?: string };
        Relationships: [];
      };
      legal_documents: {
        Row: { type: string; is_required: boolean; public_path: string | null; sort_order: number };
        Insert: { type: string; is_required?: boolean; public_path?: string | null; sort_order?: number };
        Update: { type?: string; is_required?: boolean; public_path?: string | null; sort_order?: number };
        Relationships: [];
      };
      legal_document_versions: {
        Row: { id: string; document_type: string; version: number; status: LegalDocumentStatus; locale: string; title: string; body: Json; issuer_identity: Json | null; content_hash: string | null; change_summary: string; is_material: boolean; effective_at: string | null; published_at: string | null; retired_at: string | null; approved_by: string | null; approved_at: string | null; supersedes_version_id: string | null; created_at: string };
        Insert: { id?: string; document_type: string; version: number; status?: LegalDocumentStatus; locale?: string; title: string; body?: Json; issuer_identity?: Json | null; content_hash?: string | null; change_summary: string; is_material?: boolean; effective_at?: string | null; published_at?: string | null; retired_at?: string | null; approved_by?: string | null; approved_at?: string | null; supersedes_version_id?: string | null; created_at?: string };
        Update: { id?: string; document_type?: string; version?: number; status?: LegalDocumentStatus; locale?: string; title?: string; body?: Json; issuer_identity?: Json | null; content_hash?: string | null; change_summary?: string; is_material?: boolean; effective_at?: string | null; published_at?: string | null; retired_at?: string | null; approved_by?: string | null; approved_at?: string | null; supersedes_version_id?: string | null; created_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: number; conversation_id: number; sender_id: string; body: string; idempotency_key: string; created_at: string };
        Insert: { id?: never; conversation_id: number; sender_id: string; body: string; idempotency_key: string; created_at?: string };
        Update: { id?: never; conversation_id?: number; sender_id?: string; body?: string; idempotency_key?: string; created_at?: string };
        Relationships: [];
      };
      order_events: {
        Row: { id: number; order_id: number; actor_id: string | null; actor_type: "buyer" | "seller" | "admin" | "system"; event_type: string; previous_status: string | null; next_status: string; metadata: Json; idempotency_key: string | null; created_at: string };
        Insert: { id?: never; order_id: number; actor_id?: string | null; actor_type: "buyer" | "seller" | "admin" | "system"; event_type: string; previous_status?: string | null; next_status: string; metadata?: Json; idempotency_key?: string | null; created_at?: string };
        Update: { id?: never; order_id?: number; actor_id?: string | null; actor_type?: "buyer" | "seller" | "admin" | "system"; event_type?: string; previous_status?: string | null; next_status?: string; metadata?: Json; idempotency_key?: string | null; created_at?: string };
        Relationships: [];
      };
      order_disputes: {
        Row: { id: number; order_id: number; shop_id: number; buyer_id: string; reason: "item_not_received" | "item_not_as_described" | "damaged_item" | "other"; status: "open" | "seller_responded" | "resolved"; buyer_statement: string; buyer_evidence: Json; seller_response: string | null; seller_evidence: Json; admin_resolver_id: string | null; resolution: "buyer_favor" | "seller_favor" | "dismissed" | null; resolution_notes: string | null; seller_fault: boolean | null; opened_at: string; responded_at: string | null; resolved_at: string | null };
        Insert: { id?: never; order_id: number; shop_id: number; buyer_id: string; reason: "item_not_received" | "item_not_as_described" | "damaged_item" | "other"; status?: "open" | "seller_responded" | "resolved"; buyer_statement: string; buyer_evidence?: Json; seller_response?: string | null; seller_evidence?: Json; admin_resolver_id?: string | null; resolution?: "buyer_favor" | "seller_favor" | "dismissed" | null; resolution_notes?: string | null; seller_fault?: boolean | null; opened_at?: string; responded_at?: string | null; resolved_at?: string | null };
        Update: { id?: never; order_id?: number; shop_id?: number; buyer_id?: string; reason?: "item_not_received" | "item_not_as_described" | "damaged_item" | "other"; status?: "open" | "seller_responded" | "resolved"; buyer_statement?: string; buyer_evidence?: Json; seller_response?: string | null; seller_evidence?: Json; admin_resolver_id?: string | null; resolution?: "buyer_favor" | "seller_favor" | "dismissed" | null; resolution_notes?: string | null; seller_fault?: boolean | null; opened_at?: string; responded_at?: string | null; resolved_at?: string | null };
        Relationships: [];
      };
      order_items: {
        Row: { id: number; order_id: number; product_id: number | null; product_name: string; unit_price: number; currency_code: string; quantity: number; line_total: number; handling_days: number; created_at: string };
        Insert: { id?: never; order_id: number; product_id?: number | null; product_name: string; unit_price: number; currency_code: string; quantity: number; line_total: number; handling_days: number; created_at?: string };
        Update: { id?: never; order_id?: number; product_id?: number | null; product_name?: string; unit_price?: number; currency_code?: string; quantity?: number; line_total?: number; handling_days?: number; created_at?: string };
        Relationships: [];
      };
      order_reviews: {
        Row: { id: number; order_id: number; buyer_id: string; shop_id: number; rating: number; matched_description: boolean; comment: string | null; created_at: string };
        Insert: { id?: never; order_id: number; buyer_id: string; shop_id: number; rating: number; matched_description: boolean; comment?: string | null; created_at?: string };
        Update: { id?: never; order_id?: number; buyer_id?: string; shop_id?: number; rating?: number; matched_description?: boolean; comment?: string | null; created_at?: string };
        Relationships: [];
      };
      orders: {
        Row: { id: number; buyer_id: string; shop_id: number; status: OrderStatus; idempotency_key: string; currency_code: string; subtotal: number; buyer_note: string | null; handling_days: number; handling_time_zone: string; payment_confirmation_required: boolean; payment_completed_at: string | null; payment_confirmed_by: string | null; seller_cancellation_reason: "buyer_non_payment" | "inventory_unavailable" | "seller_unavailable" | "other" | null; accepted_at: string | null; ship_by_at: string | null; shipped_at: string | null; delivered_at: string | null; buyer_confirmed_at: string | null; auto_completed_at: string | null; completed_at: string | null; canceled_at: string | null; canceled_by: string | null; tracking_text: string | null; created_at: string; updated_at: string; fulfillment_method: "pickup" | "shipping"; alt_contact_name: string | null; alt_contact_phone: string | null; alt_contact_note: string | null };
        Insert: { id?: never; buyer_id: string; shop_id: number; status?: OrderStatus; idempotency_key: string; currency_code: string; subtotal: number; buyer_note?: string | null; handling_days: number; handling_time_zone: string; payment_confirmation_required?: boolean; payment_completed_at?: string | null; payment_confirmed_by?: string | null; seller_cancellation_reason?: "buyer_non_payment" | "inventory_unavailable" | "seller_unavailable" | "other" | null; accepted_at?: string | null; ship_by_at?: string | null; shipped_at?: string | null; delivered_at?: string | null; buyer_confirmed_at?: string | null; auto_completed_at?: string | null; completed_at?: string | null; canceled_at?: string | null; canceled_by?: string | null; tracking_text?: string | null; created_at?: string; updated_at?: string; fulfillment_method: "pickup" | "shipping"; alt_contact_name?: string | null; alt_contact_phone?: string | null; alt_contact_note?: string | null };
        Update: { id?: never; buyer_id?: string; shop_id?: number; status?: OrderStatus; idempotency_key?: string; currency_code?: string; subtotal?: number; buyer_note?: string | null; handling_days?: number; handling_time_zone?: string; payment_confirmation_required?: boolean; payment_completed_at?: string | null; payment_confirmed_by?: string | null; seller_cancellation_reason?: "buyer_non_payment" | "inventory_unavailable" | "seller_unavailable" | "other" | null; accepted_at?: string | null; ship_by_at?: string | null; shipped_at?: string | null; delivered_at?: string | null; buyer_confirmed_at?: string | null; auto_completed_at?: string | null; completed_at?: string | null; canceled_at?: string | null; canceled_by?: string | null; tracking_text?: string | null; created_at?: string; updated_at?: string; fulfillment_method?: "pickup" | "shipping"; alt_contact_name?: string | null; alt_contact_phone?: string | null; alt_contact_note?: string | null };
        Relationships: [];
      };
      seller_activity_events: {
        Row: { id: number; shop_id: number; actor_id: string; activity_type: string; related_entity_type: string | null; related_entity_id: number | null; created_at: string };
        Insert: { id?: never; shop_id: number; actor_id: string; activity_type: string; related_entity_type?: string | null; related_entity_id?: number | null; created_at?: string };
        Update: { id?: never; shop_id?: number; actor_id?: string; activity_type?: string; related_entity_type?: string | null; related_entity_id?: number | null; created_at?: string };
        Relationships: [];
      };
      buyer_activity_events: {
        Row: { id: number; buyer_id: string; order_id: number; activity_type: "checkout" | "payment_completed" | "buyer_message" | "receipt_confirmed" | "order_completed" | "review_submitted" | "claim_submitted" | "accepted_order_canceled"; related_entity_type: "order" | "message" | "review" | "dispute"; related_entity_id: number; created_at: string };
        Insert: { id?: never; buyer_id: string; order_id: number; activity_type: "checkout" | "payment_completed" | "buyer_message" | "receipt_confirmed" | "order_completed" | "review_submitted" | "claim_submitted" | "accepted_order_canceled"; related_entity_type: "order" | "message" | "review" | "dispute"; related_entity_id: number; created_at?: string };
        Update: { id?: never; buyer_id?: string; order_id?: number; activity_type?: "checkout" | "payment_completed" | "buyer_message" | "receipt_confirmed" | "order_completed" | "review_submitted" | "claim_submitted" | "accepted_order_canceled"; related_entity_type?: "order" | "message" | "review" | "dispute"; related_entity_id?: number; created_at?: string };
        Relationships: [];
      };
      buyer_response_events: {
        Row: { id: number; conversation_id: number; order_id: number; buyer_id: string; triggering_seller_message_id: number; closing_buyer_message_id: number | null; clock_started_at: string; replied_at: string | null; elapsed_minutes: number | null; answered_within_24_hours: boolean | null; created_at: string };
        Insert: { id?: never; conversation_id: number; order_id: number; buyer_id: string; triggering_seller_message_id: number; closing_buyer_message_id?: number | null; clock_started_at: string; replied_at?: string | null; elapsed_minutes?: number | null; answered_within_24_hours?: boolean | null; created_at?: string };
        Update: { id?: never; conversation_id?: number; order_id?: number; buyer_id?: string; triggering_seller_message_id?: number; closing_buyer_message_id?: number | null; clock_started_at?: string; replied_at?: string | null; elapsed_minutes?: number | null; answered_within_24_hours?: boolean | null; created_at?: string };
        Relationships: [];
      };
      buyer_trust_evaluations: {
        Row: { id: number; buyer_id: string; input: Json; output: Json; evaluator_policy_version: string; evaluated_at: string };
        Insert: { id?: never; buyer_id: string; input: Json; output: Json; evaluator_policy_version?: string; evaluated_at?: string };
        Update: { id?: never; buyer_id?: string; input?: Json; output?: Json; evaluator_policy_version?: string; evaluated_at?: string };
        Relationships: [];
      };
      buyer_trust_profiles: {
        Row: { buyer_id: string; buyer_trust_tier: "new" | "reliable" | "top_buyer"; output: Json | null; evaluated_at: string | null; created_at: string; updated_at: string };
        Insert: { buyer_id: string; buyer_trust_tier?: "new" | "reliable" | "top_buyer"; output?: Json | null; evaluated_at?: string | null; created_at?: string; updated_at?: string };
        Update: { buyer_id?: string; buyer_trust_tier?: "new" | "reliable" | "top_buyer"; output?: Json | null; evaluated_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      seller_response_events: {
        Row: { id: number; conversation_id: number; shop_id: number; triggering_buyer_message_id: number; closing_seller_message_id: number | null; clock_started_at: string; replied_at: string | null; elapsed_minutes: number | null; answered_within_24_hours: boolean | null; created_at: string };
        Insert: { id?: never; conversation_id: number; shop_id: number; triggering_buyer_message_id: number; closing_seller_message_id?: number | null; clock_started_at: string; replied_at?: string | null; elapsed_minutes?: number | null; answered_within_24_hours?: boolean | null; created_at?: string };
        Update: { id?: never; conversation_id?: number; shop_id?: number; triggering_buyer_message_id?: number; closing_seller_message_id?: number | null; clock_started_at?: string; replied_at?: string | null; elapsed_minutes?: number | null; answered_within_24_hours?: boolean | null; created_at?: string };
        Relationships: [];
      };
      user_activity: {
        Row: { user_id: string; last_seen_at: string };
        Insert: { user_id: string; last_seen_at?: string };
        Update: { user_id?: string; last_seen_at?: string };
        Relationships: [];
      };
      user_contact_details: {
        Row: {
          created_at: string;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
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
      accept_order: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      add_cart_item: {
        Args: { p_product_id: number; p_quantity?: number };
        Returns: number;
      };
      checkout_cart_v2: {
        Args: { p_shop_id: number; p_address: Json; p_buyer_note: string | null; p_idempotency_key: string };
        Returns: number;
      };
      checkout_cart_v3: {
        Args: { p_shop_id: number; p_fulfillment_method: "pickup" | "shipping"; p_address: Json | null; p_alt_contact: Json | null; p_buyer_note: string | null; p_idempotency_key: string };
        Returns: number;
      };
      confirm_order_payment: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      cancel_order_by_buyer: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      cancel_order_by_seller: { Args: { p_order_id: number; p_reason: string; p_idempotency_key: string }; Returns: undefined };
      confirm_order_received: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      confirm_order_satisfied: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      create_order_review: { Args: { p_order_id: number; p_rating: number; p_matched_description: boolean; p_comment: string | null }; Returns: number };
      current_legal_document: { Args: { p_type: string }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
      is_current_user_admin: { Args: Record<never, never>; Returns: boolean };
      set_shop_publishing_approval: {
        Args: { p_shop_id: number; p_enabled: boolean };
        Returns: { shop_id: number; shop_slug: string; product_slugs: string[] }[];
      };
      list_admin_marketplace_users: {
        Args: Record<never, never>;
        Returns: {
          user_id: string;
          email: string | null;
          user_created_at: string;
          display_name: string | null;
          shop_id: number | null;
          shop_name: string | null;
          shop_slug: string | null;
          shop_created_at: string | null;
          shop_is_publishing_approved: boolean | null;
          product_id: number | null;
          product_name: string | null;
          product_slug: string | null;
          product_status: string | null;
          product_is_admin_enabled: boolean | null;
          product_expires_at: string | null;
          product_created_at: string | null;
          product_updated_at: string | null;
        }[];
      };
      mark_order_shipped: { Args: { p_order_id: number; p_tracking_text: string | null; p_idempotency_key: string }; Returns: undefined };
      open_order_dispute: { Args: { p_order_id: number; p_reason: string; p_statement: string; p_evidence: Json }; Returns: number };
      publish_legal_version: { Args: { p_version_id: string; p_issuer_identity: Json }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
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
      reject_order: { Args: { p_order_id: number; p_idempotency_key: string }; Returns: undefined };
      resolve_order_dispute: { Args: { p_dispute_id: number; p_resolution: string; p_seller_fault: boolean; p_notes: string }; Returns: undefined };
      respond_to_dispute: { Args: { p_dispute_id: number; p_response: string; p_evidence: Json }; Returns: undefined };
      send_conversation_message: { Args: { p_conversation_id: number; p_body: string; p_idempotency_key: string }; Returns: number };
      catalog_state_counts: {
        Args: { p_country_code: string | null };
        Returns: {
          administrative_area_code: string;
          product_count: number;
        }[];
      };
      touch_user_activity: { Args: Record<string, never>; Returns: undefined };
      shop_pickup_point: { Args: { p_shop_id: number }; Returns: Json };
      shop_seller_display_name: { Args: { p_shop_id: number }; Returns: string | null };
      shop_public_trust_metrics: {
        Args: { p_shop_id: number };
        Returns: {
          average_reply_time_minutes: number | null;
          response_rate: number | null;
          description_accuracy: number | null;
          on_time_shipping_rate: number | null;
          order_completion_rate: number | null;
          dispute_rate: number | null;
          total_orders: number | null;
          average_rating: number | null;
          review_count: number | null;
          last_active_days_ago: number | null;
          seller_active_days_ago: number | null;
          evaluated_at: string | null;
        }[];
      };
      search_product_ids: {
        Args: {
          p_administrative_area_code: string | null;
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
      start_pre_sale_conversation: { Args: { p_shop_id: number; p_product_id?: number | null }; Returns: number };
      set_display_name: { Args: { p_display_name: string }; Returns: undefined };
      my_display_name: { Args: Record<string, never>; Returns: string | null };
      mark_conversation_read: { Args: { p_conversation_id: number; p_last_message_id: number }; Returns: undefined };
      unread_message_count: { Args: Record<string, never>; Returns: number };
      list_conversations: {
        Args: { p_role: string };
        Returns: {
          conversation_id: number;
          type: "pre_sale" | "order";
          order_id: number | null;
          shop_id: number;
          shop_name: string;
          shop_slug: string;
          counterpart_label: string;
          product_id: number | null;
          product_name: string | null;
          product_slug: string | null;
          product_image_path: string | null;
          product_price: number | null;
          product_currency_code: string | null;
          product_status: "draft" | "published" | "expired" | "deleted" | null;
          product_is_public: boolean | null;
          product_units_available: number | null;
          last_message_body: string | null;
          last_message_at: string | null;
          last_message_sender_id: string | null;
          unread_count: number;
        }[];
      };
      admin_conversation_for_order: { Args: { p_order_id: number }; Returns: number | null };
      read_conversation_as_admin: {
        Args: { p_conversation_id: number; p_reason: string };
        Returns: { id: number; sender_id: string; sender_label: string; body: string; created_at: string }[];
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
export type LegalDocument = Database["public"]["Tables"]["legal_documents"]["Row"];
export type LegalDocumentVersion = Database["public"]["Tables"]["legal_document_versions"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductTranslation = Database["public"]["Tables"]["product_translations"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderAddress = Database["public"]["Tables"]["order_addresses"]["Row"];
export type OrderEvent = Database["public"]["Tables"]["order_events"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type SearchEvent = Database["public"]["Tables"]["search_events"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type UserTrustProfile = Database["public"]["Tables"]["user_trust_profiles"]["Row"];
