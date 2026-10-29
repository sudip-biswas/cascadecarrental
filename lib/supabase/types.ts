// This file will be replaced by: supabase gen types typescript --project-id <id> > lib/supabase/types.ts
// Placeholder types until Supabase project is configured

/** An extra the guest booked, as it was priced at checkout. */
export interface TripExtra {
  id: string;
  name: string;
  per: "day" | "trip";
  price_cents: number;
  quantity: number;
  total_cents: number;
  unlimited_miles: boolean;
}

export type ChargeKind = "extra_miles" | "fuel" | "tolls" | "cleaning" | "smoking" | "late_return" | "damage" | "other";

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
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          bio: string | null;
          phone: string | null;
          is_host: boolean;
          host_since: string | null;
          stripe_customer_id: string | null;
          stripe_account_id: string | null;
          driving_license_verified: boolean;
          identity_verified: boolean;
          created_at: string;
          updated_at: string;
          date_of_birth: string | null;
          identity_status: "unverified" | "pending" | "verified" | "failed";
          identity_session_id: string | null;
          identity_error: string | null;
          suspended_at: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          phone?: string | null;
          is_host?: boolean;
          host_since?: string | null;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          driving_license_verified?: boolean;
          identity_verified?: boolean;
          created_at?: string;
          updated_at?: string;
          date_of_birth?: string | null;
          identity_status?: "unverified" | "pending" | "verified" | "failed";
          identity_session_id?: string | null;
          identity_error?: string | null;
          suspended_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          phone?: string | null;
          is_host?: boolean;
          host_since?: string | null;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          driving_license_verified?: boolean;
          identity_verified?: boolean;
          updated_at?: string;
          date_of_birth?: string | null;
          identity_status?: "unverified" | "pending" | "verified" | "failed";
          identity_session_id?: string | null;
          identity_error?: string | null;
          suspended_at?: string | null;
        };
        Relationships: [];
      };
      host_personas: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          avatar_url: string | null;
          host_since: string | null;
          bio: string | null;
          trip_count: number;
          rating: number | null;
          rating_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          avatar_url?: string | null;
          host_since?: string | null;
          bio?: string | null;
          trip_count?: number;
          rating?: number | null;
          rating_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          avatar_url?: string | null;
          host_since?: string | null;
          bio?: string | null;
          trip_count?: number;
          rating?: number | null;
          rating_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "host_personas_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicles: {
        Row: {
          id: string;
          host_id: string;
          make: string;
          model: string;
          trim: string | null;
          year: number;
          color: string | null;
          license_plate: string;
          vin: string | null;
          vehicle_type: string;
          fuel_type: string;
          transmission: string;
          seats: number;
          doors: number | null;
          mpg: number | null;
          range_miles: number | null;
          location_name: string;
          location_lat: number;
          location_lng: number;
          location_address: string | null;
          daily_rate_cents: number;
          weekly_discount_pct: number;
          monthly_discount_pct: number;
          three_day_discount_pct: number;
          two_week_discount_pct: number;
          three_week_discount_pct: number;
          last_minute_boost_pct: number;
          auto_pricing: boolean;
          auto_price_min_cents: number | null;
          auto_price_max_cents: number | null;
          distance_included_mi: number;
          extra_mile_fee_cents: number;
          min_trip_days: number;
          max_trip_days: number;
          advance_notice_hours: number;
          instant_book: boolean;
          description: string | null;
          persona_id: string | null;
          status: "listed" | "unlisted" | "suspended";
          rating_avg: number | null;
          trip_count: number;
          created_at: string;
          updated_at: string;
          min_age: number;
          young_driver_fee_cents: number;
          deposit_cents: number;
          delivery_enabled: boolean;
          delivery_radius_mi: number;
          delivery_fee_cents: number;
          delivery_fee_per_mi_cents: number;
          airport_delivery_fee_cents: number | null;
          trip_buffer_hours: number;
          weekend_min_two_days: boolean;
        };
        Insert: {
          id?: string;
          host_id: string;
          make: string;
          model: string;
          trim?: string | null;
          year: number;
          color?: string | null;
          license_plate: string;
          vin?: string | null;
          vehicle_type: string;
          fuel_type: string;
          transmission?: string;
          seats: number;
          doors?: number | null;
          mpg?: number | null;
          range_miles?: number | null;
          location_name: string;
          location_lat: number;
          location_lng: number;
          location_address?: string | null;
          daily_rate_cents: number;
          weekly_discount_pct?: number;
          monthly_discount_pct?: number;
          three_day_discount_pct?: number;
          two_week_discount_pct?: number;
          three_week_discount_pct?: number;
          last_minute_boost_pct?: number;
          auto_pricing?: boolean;
          auto_price_min_cents?: number | null;
          auto_price_max_cents?: number | null;
          distance_included_mi?: number;
          extra_mile_fee_cents?: number;
          min_trip_days?: number;
          max_trip_days?: number;
          advance_notice_hours?: number;
          instant_book?: boolean;
          description?: string | null;
          persona_id?: string | null;
          status?: "listed" | "unlisted" | "suspended";
          rating_avg?: number | null;
          trip_count?: number;
          created_at?: string;
          updated_at?: string;
          min_age?: number;
          young_driver_fee_cents?: number;
          deposit_cents?: number;
          delivery_enabled?: boolean;
          delivery_radius_mi?: number;
          delivery_fee_cents?: number;
          delivery_fee_per_mi_cents?: number;
          airport_delivery_fee_cents?: number | null;
          trip_buffer_hours?: number;
          weekend_min_two_days?: boolean;
        };
        Update: {
          id?: string;
          host_id?: string;
          make?: string;
          model?: string;
          trim?: string | null;
          year?: number;
          color?: string | null;
          license_plate?: string;
          vin?: string | null;
          vehicle_type?: string;
          fuel_type?: string;
          transmission?: string;
          seats?: number;
          doors?: number | null;
          mpg?: number | null;
          range_miles?: number | null;
          location_name?: string;
          location_lat?: number;
          location_lng?: number;
          location_address?: string | null;
          daily_rate_cents?: number;
          weekly_discount_pct?: number;
          monthly_discount_pct?: number;
          three_day_discount_pct?: number;
          two_week_discount_pct?: number;
          three_week_discount_pct?: number;
          last_minute_boost_pct?: number;
          auto_pricing?: boolean;
          auto_price_min_cents?: number | null;
          auto_price_max_cents?: number | null;
          distance_included_mi?: number;
          extra_mile_fee_cents?: number;
          min_trip_days?: number;
          max_trip_days?: number;
          advance_notice_hours?: number;
          instant_book?: boolean;
          description?: string | null;
          persona_id?: string | null;
          status?: "listed" | "unlisted" | "suspended";
          rating_avg?: number | null;
          trip_count?: number;
          updated_at?: string;
          min_age?: number;
          young_driver_fee_cents?: number;
          deposit_cents?: number;
          delivery_enabled?: boolean;
          delivery_radius_mi?: number;
          delivery_fee_cents?: number;
          delivery_fee_per_mi_cents?: number;
          airport_delivery_fee_cents?: number | null;
          trip_buffer_hours?: number;
          weekend_min_two_days?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_persona_id_fkey";
            columns: ["persona_id"];
            isOneToOne: false;
            referencedRelation: "host_personas";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_images: {
        Row: {
          id: string;
          vehicle_id: string;
          storage_path: string;
          url: string;
          position: number;
          is_cover: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          storage_path: string;
          url: string;
          position?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          storage_path?: string;
          url?: string;
          position?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_features: {
        Row: {
          id: string;
          vehicle_id: string;
          category: string;
          feature: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          category: string;
          feature: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          category?: string;
          feature?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_features_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      host_hours: {
        Row: {
          host_id: string;
          always_available: boolean;
          week: Json;
          updated_at: string;
        };
        Insert: {
          host_id: string;
          always_available?: boolean;
          week?: Json;
          updated_at?: string;
        };
        Update: {
          host_id?: string;
          always_available?: boolean;
          week?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "host_hours_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_daily_prices: {
        Row: {
          id: string;
          vehicle_id: string;
          date: string;
          price_cents: number;
          source: "host" | "auto";
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          date: string;
          price_cents: number;
          source?: "host" | "auto";
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          date?: string;
          price_cents?: number;
          source?: "host" | "auto";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_daily_prices_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_availability: {
        Row: {
          id: string;
          vehicle_id: string;
          blocked_from: string;
          blocked_to: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          blocked_from: string;
          blocked_to: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          blocked_from?: string;
          blocked_to?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_availability_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      trips: {
        Row: {
          id: string;
          vehicle_id: string;
          guest_id: string;
          host_id: string;
          starts_at: string;
          ends_at: string;
          pickup_location: string;
          daily_rate_cents: number;
          base_cents: number | null;
          subtotal_cents: number;
          tax_cents: number;
          total_cents: number;
          distance_included_mi: number;
          extra_mile_fee_cents: number;
          rate_type: "refundable" | "non_refundable";
          protection_plan: "basic" | "standard" | "premium" | null;
          protection_cost_cents: number;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          payment_status: "pending" | "authorized" | "captured" | "refunded" | "voided" | "failed";
          pay_later: boolean;
          status: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
          cancellation_reason: string | null;
          cancelled_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
          rental_cents: number | null;
          extras: TripExtra[];
          extras_cents: number;
          delivery_cents: number;
          delivery_address: string | null;
          delivery_lat: number | null;
          delivery_lng: number | null;
          young_driver_cents: number;
          promo_code: string | null;
          promo_cents: number;
          unlimited_miles: boolean;
          stripe_payment_method_id: string | null;
          deposit_cents: number;
          deposit_payment_intent_id: string | null;
          deposit_status: "none" | "held" | "released" | "captured" | "failed";
          pickup_reminded_at: string | null;
          return_reminded_at: string | null;
          completed_at: string | null;
          paid_out_at: string | null;
          pickup_spot_id: string | null;
          pickup_spot_kind: PickupSpotKind | null;
          pickup_spot_name: string | null;
          vehicle_access: VehicleAccess | null;
          handover_note: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          guest_id: string;
          host_id: string;
          starts_at: string;
          ends_at: string;
          pickup_location: string;
          daily_rate_cents: number;
          base_cents?: number | null;
          subtotal_cents: number;
          tax_cents: number;
          total_cents: number;
          distance_included_mi: number;
          extra_mile_fee_cents: number;
          rate_type?: "refundable" | "non_refundable";
          protection_plan?: "basic" | "standard" | "premium" | null;
          protection_cost_cents?: number;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          payment_status?: "pending" | "authorized" | "captured" | "refunded" | "voided" | "failed";
          pay_later?: boolean;
          status?: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
          rental_cents?: number | null;
          extras?: TripExtra[];
          extras_cents?: number;
          delivery_cents?: number;
          delivery_address?: string | null;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          young_driver_cents?: number;
          promo_code?: string | null;
          promo_cents?: number;
          unlimited_miles?: boolean;
          stripe_payment_method_id?: string | null;
          deposit_cents?: number;
          deposit_payment_intent_id?: string | null;
          deposit_status?: "none" | "held" | "released" | "captured" | "failed";
          pickup_reminded_at?: string | null;
          return_reminded_at?: string | null;
          completed_at?: string | null;
          paid_out_at?: string | null;
          pickup_spot_id?: string | null;
          pickup_spot_kind?: PickupSpotKind | null;
          pickup_spot_name?: string | null;
          vehicle_access?: VehicleAccess | null;
          handover_note?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          guest_id?: string;
          host_id?: string;
          starts_at?: string;
          ends_at?: string;
          pickup_location?: string;
          daily_rate_cents?: number;
          base_cents?: number | null;
          subtotal_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          distance_included_mi?: number;
          extra_mile_fee_cents?: number;
          rate_type?: "refundable" | "non_refundable";
          protection_plan?: "basic" | "standard" | "premium" | null;
          protection_cost_cents?: number;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          payment_status?: "pending" | "authorized" | "captured" | "refunded" | "voided" | "failed";
          pay_later?: boolean;
          status?: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          approved_at?: string | null;
          updated_at?: string;
          rental_cents?: number | null;
          extras?: TripExtra[];
          extras_cents?: number;
          delivery_cents?: number;
          delivery_address?: string | null;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          young_driver_cents?: number;
          promo_code?: string | null;
          promo_cents?: number;
          unlimited_miles?: boolean;
          stripe_payment_method_id?: string | null;
          deposit_cents?: number;
          deposit_payment_intent_id?: string | null;
          deposit_status?: "none" | "held" | "released" | "captured" | "failed";
          pickup_reminded_at?: string | null;
          return_reminded_at?: string | null;
          completed_at?: string | null;
          paid_out_at?: string | null;
          pickup_spot_id?: string | null;
          pickup_spot_kind?: PickupSpotKind | null;
          pickup_spot_name?: string | null;
          vehicle_access?: VehicleAccess | null;
          handover_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      conversations: {
        Row: {
          id: string;
          trip_id: string | null;
          guest_id: string;
          host_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id?: string | null;
          guest_id: string;
          host_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string | null;
          guest_id?: string;
          host_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      reviews: {
        Row: {
          id: string;
          trip_id: string;
          vehicle_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating_overall: number;
          rating_cleanliness: number | null;
          rating_accuracy: number | null;
          rating_value: number | null;
          rating_maintenance: number | null;
          rating_communication: number | null;
          rating_convenience: number | null;
          issue_tags: string[];
          body: string | null;
          host_reply: string | null;
          host_replied_at: string | null;
          created_at: string;
          kind: "guest_to_host" | "host_to_guest";
        };
        Insert: {
          id?: string;
          trip_id: string;
          vehicle_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating_overall: number;
          rating_cleanliness?: number | null;
          rating_accuracy?: number | null;
          rating_value?: number | null;
          rating_maintenance?: number | null;
          rating_communication?: number | null;
          rating_convenience?: number | null;
          issue_tags?: string[];
          body?: string | null;
          host_reply?: string | null;
          host_replied_at?: string | null;
          created_at?: string;
          kind?: "guest_to_host" | "host_to_guest";
        };
        Update: {
          id?: string;
          trip_id?: string;
          vehicle_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          rating_overall?: number;
          rating_cleanliness?: number | null;
          rating_accuracy?: number | null;
          rating_value?: number | null;
          rating_maintenance?: number | null;
          rating_communication?: number | null;
          rating_convenience?: number | null;
          issue_tags?: string[];
          body?: string | null;
          host_reply?: string | null;
          host_replied_at?: string | null;
          created_at?: string;
          kind?: "guest_to_host" | "host_to_guest";
        };
        Relationships: [
          {
            foreignKeyName: "reviews_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: true;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_extras: {
        Row: {
          id: string;
          vehicle_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          per: "day" | "trip";
          max_quantity: number;
          unlimited_miles: boolean;
          active: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          name: string;
          description?: string | null;
          price_cents: number;
          per?: "day" | "trip";
          max_quantity?: number;
          unlimited_miles?: boolean;
          active?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          per?: "day" | "trip";
          max_quantity?: number;
          unlimited_miles?: boolean;
          active?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_extras_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      host_locations: {
        Row: {
          id: string;
          host_id: string;
          kind: HostLocationKind;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          fee_cents: number;
          fee_per_mi_cents: number;
          radius_mi: number | null;
          free_from_days: number | null;
          vehicle_access: VehicleAccess;
          handover_note: string | null;
          all_vehicles: boolean;
          enabled: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          kind: HostLocationKind;
          name: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          fee_cents?: number;
          fee_per_mi_cents?: number;
          radius_mi?: number | null;
          free_from_days?: number | null;
          vehicle_access?: VehicleAccess;
          handover_note?: string | null;
          all_vehicles?: boolean;
          enabled?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          kind?: HostLocationKind;
          name?: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          fee_cents?: number;
          fee_per_mi_cents?: number;
          radius_mi?: number | null;
          free_from_days?: number | null;
          vehicle_access?: VehicleAccess;
          handover_note?: string | null;
          all_vehicles?: boolean;
          enabled?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "host_locations_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      host_location_vehicles: {
        Row: {
          location_id: string;
          vehicle_id: string;
          fee_cents: number | null;
        };
        Insert: {
          location_id: string;
          vehicle_id: string;
          fee_cents?: number | null;
        };
        Update: {
          location_id?: string;
          vehicle_id?: string;
          fee_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "host_location_vehicles_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "host_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "host_location_vehicles_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_inspections: {
        Row: {
          id: string;
          vehicle_id: string;
          inspected_on: string;
          odometer_mi: number | null;
          checklist: Record<string, "pass" | "fail" | "na">;
          passed: boolean;
          inspector: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          inspected_on: string;
          odometer_mi?: number | null;
          checklist?: Record<string, "pass" | "fail" | "na">;
          passed: boolean;
          inspector?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          inspected_on?: string;
          odometer_mi?: number | null;
          checklist?: Record<string, "pass" | "fail" | "na">;
          passed?: boolean;
          inspector?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_maintenance: {
        Row: {
          id: string;
          vehicle_id: string;
          done_on: string;
          kind: "oil_change" | "tires" | "brakes" | "battery" | "fluids" | "wipers" | "alignment" | "recall" | "repair" | "cleaning" | "other";
          odometer_mi: number | null;
          cost_cents: number | null;
          notes: string | null;
          next_due_on: string | null;
          next_due_mi: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          done_on: string;
          kind: "oil_change" | "tires" | "brakes" | "battery" | "fluids" | "wipers" | "alignment" | "recall" | "repair" | "cleaning" | "other";
          odometer_mi?: number | null;
          cost_cents?: number | null;
          notes?: string | null;
          next_due_on?: string | null;
          next_due_mi?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          done_on?: string;
          kind?: "oil_change" | "tires" | "brakes" | "battery" | "fluids" | "wipers" | "alignment" | "recall" | "repair" | "cleaning" | "other";
          odometer_mi?: number | null;
          cost_cents?: number | null;
          notes?: string | null;
          next_due_on?: string | null;
          next_due_mi?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicle_guest_instructions: {
        Row: {
          vehicle_id: string;
          check_in_method: "in_person" | "lockbox" | "keyless";
          pickup_instructions: string | null;
          welcome_message: string | null;
          car_guide: string | null;
          faqs: { question: string; answer: string }[];
          updated_at: string;
        };
        Insert: {
          vehicle_id: string;
          check_in_method?: "in_person" | "lockbox" | "keyless";
          pickup_instructions?: string | null;
          welcome_message?: string | null;
          car_guide?: string | null;
          faqs?: { question: string; answer: string }[];
          updated_at?: string;
        };
        Update: {
          vehicle_id?: string;
          check_in_method?: "in_person" | "lockbox" | "keyless";
          pickup_instructions?: string | null;
          welcome_message?: string | null;
          car_guide?: string | null;
          faqs?: { question: string; answer: string }[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_guest_instructions_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      trip_inspections: {
        Row: {
          id: string;
          trip_id: string;
          kind: "pickup" | "return";
          recorded_by: string;
          role: "guest" | "host";
          odometer_mi: number | null;
          fuel_pct: number | null;
          photos: string[];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          kind: "pickup" | "return";
          recorded_by: string;
          role: "guest" | "host";
          odometer_mi?: number | null;
          fuel_pct?: number | null;
          photos?: string[];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          kind?: "pickup" | "return";
          recorded_by?: string;
          role?: "guest" | "host";
          odometer_mi?: number | null;
          fuel_pct?: number | null;
          photos?: string[];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_inspections_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          }
        ];
      };
      trip_charges: {
        Row: {
          id: string;
          trip_id: string;
          host_id: string;
          guest_id: string;
          kind: ChargeKind;
          amount_cents: number;
          description: string;
          photos: string[];
          status: "requested" | "paid" | "disputed" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id: string | null;
          paid_from_deposit: boolean;
          guest_note: string | null;
          resolution_note: string | null;
          created_at: string;
          responded_at: string | null;
          resolved_at: string | null;
          paid_out_at: string | null;
          failure_reason: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          host_id: string;
          guest_id: string;
          kind: ChargeKind;
          amount_cents: number;
          description: string;
          photos?: string[];
          status?: "requested" | "paid" | "disputed" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id?: string | null;
          paid_from_deposit?: boolean;
          guest_note?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          responded_at?: string | null;
          resolved_at?: string | null;
          paid_out_at?: string | null;
          failure_reason?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          host_id?: string;
          guest_id?: string;
          kind?: ChargeKind;
          amount_cents?: number;
          description?: string;
          photos?: string[];
          status?: "requested" | "paid" | "disputed" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id?: string | null;
          paid_from_deposit?: boolean;
          guest_note?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          responded_at?: string | null;
          resolved_at?: string | null;
          paid_out_at?: string | null;
          failure_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_charges_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_charges_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_charges_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      trip_changes: {
        Row: {
          id: string;
          trip_id: string;
          requested_by: string;
          old_starts_at: string;
          old_ends_at: string;
          new_starts_at: string;
          new_ends_at: string;
          pricing: Json;
          difference_cents: number;
          status: "requested" | "accepted" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string | null;
          note: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          requested_by: string;
          old_starts_at: string;
          old_ends_at: string;
          new_starts_at: string;
          new_ends_at: string;
          pricing: Json;
          difference_cents: number;
          status?: "requested" | "accepted" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          note?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          requested_by?: string;
          old_starts_at?: string;
          old_ends_at?: string;
          new_starts_at?: string;
          new_ends_at?: string;
          pricing?: Json;
          difference_cents?: number;
          status?: "requested" | "accepted" | "declined" | "cancelled" | "failed";
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string | null;
          note?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_changes_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          }
        ];
      };
      trip_drivers: {
        Row: {
          id: string;
          trip_id: string;
          added_by: string;
          profile_id: string | null;
          full_name: string;
          email: string;
          date_of_birth: string;
          licence_last4: string;
          licence_state: string;
          licence_expiry: string;
          status: "pending" | "approved" | "declined" | "removed";
          created_at: string;
          updated_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          added_by: string;
          profile_id?: string | null;
          full_name: string;
          email: string;
          date_of_birth: string;
          licence_last4: string;
          licence_state: string;
          licence_expiry: string;
          status?: "pending" | "approved" | "declined" | "removed";
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          added_by?: string;
          profile_id?: string | null;
          full_name?: string;
          email?: string;
          date_of_birth?: string;
          licence_last4?: string;
          licence_state?: string;
          licence_expiry?: string;
          status?: "pending" | "approved" | "declined" | "removed";
          created_at?: string;
          updated_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_drivers_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_drivers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      favorites: {
        Row: {
          user_id: string;
          vehicle_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          vehicle_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          vehicle_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      listing_reports: {
        Row: {
          id: string;
          vehicle_id: string;
          reporter_id: string;
          reason: "inaccurate" | "photos" | "scam" | "unsafe" | "offensive" | "other";
          details: string | null;
          status: "open" | "resolved";
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          reporter_id: string;
          reason: "inaccurate" | "photos" | "scam" | "unsafe" | "offensive" | "other";
          details?: string | null;
          status?: "open" | "resolved";
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          reason?: "inaccurate" | "photos" | "scam" | "unsafe" | "offensive" | "other";
          details?: string | null;
          status?: "open" | "resolved";
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_reports_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      pricing_events: {
        Row: {
          id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          pct: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          starts_on: string;
          ends_on: string;
          pct: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          starts_on?: string;
          ends_on?: string;
          pct?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          percent_off: number | null;
          amount_off_cents: number | null;
          max_redemptions: number | null;
          per_user_limit: number;
          min_days: number;
          first_trip_only: boolean;
          starts_at: string | null;
          expires_at: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          max_redemptions?: number | null;
          per_user_limit?: number;
          min_days?: number;
          first_trip_only?: boolean;
          starts_at?: string | null;
          expires_at?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          max_redemptions?: number | null;
          per_user_limit?: number;
          min_days?: number;
          first_trip_only?: boolean;
          starts_at?: string | null;
          expires_at?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      message_templates: {
        Row: {
          id: string;
          host_id: string;
          name: string;
          body: string;
          event: "booked" | "trip_start" | "three_quarters" | "trip_end";
          offset_minutes: number;
          direction: "before" | "after";
          trip_type: "all" | "any_delivery" | "no_delivery" | "custom_delivery" | "airport_delivery";
          vehicle_ids: string[] | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          name: string;
          body: string;
          event: "booked" | "trip_start" | "three_quarters" | "trip_end";
          offset_minutes?: number;
          direction?: "before" | "after";
          trip_type?: "all" | "any_delivery" | "no_delivery" | "custom_delivery" | "airport_delivery";
          vehicle_ids?: string[] | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          name?: string;
          body?: string;
          event?: "booked" | "trip_start" | "three_quarters" | "trip_end";
          offset_minutes?: number;
          direction?: "before" | "after";
          trip_type?: "all" | "any_delivery" | "no_delivery" | "custom_delivery" | "airport_delivery";
          vehicle_ids?: string[] | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduled_messages: {
        Row: {
          id: string;
          template_id: string | null;
          trip_id: string;
          host_id: string;
          guest_id: string;
          name: string;
          body: string;
          send_at: string;
          status: "scheduled" | "sent" | "skipped" | "cancelled";
          sent_at: string | null;
          message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          trip_id: string;
          host_id: string;
          guest_id: string;
          name: string;
          body: string;
          send_at: string;
          status?: "scheduled" | "sent" | "skipped" | "cancelled";
          sent_at?: string | null;
          message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          trip_id?: string;
          host_id?: string;
          guest_id?: string;
          name?: string;
          body?: string;
          send_at?: string;
          status?: "scheduled" | "sent" | "skipped" | "cancelled";
          sent_at?: string | null;
          message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          href: string | null;
          trip_id: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          emailed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body?: string | null;
          href?: string | null;
          trip_id?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          body?: string | null;
          href?: string | null;
          trip_id?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_auto_prices: {
        Args: { rows: { vehicle_id: string; date: string; price_cents: number }[] };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
};

type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Vehicle = Tables["vehicles"]["Row"];
export type VehicleImage = Tables["vehicle_images"]["Row"];
export type Trip = Tables["trips"]["Row"];
export type TripStatus = Trip["status"];
export type PaymentStatus = Trip["payment_status"];
export type Review = Tables["reviews"]["Row"];
export type Message = Tables["messages"]["Row"];
export type VehicleExtra = Tables["vehicle_extras"]["Row"];
export type GuestInstructions = Tables["vehicle_guest_instructions"]["Row"];
export type TripInspection = Tables["trip_inspections"]["Row"];
export type VehicleInspection = Tables["vehicle_inspections"]["Row"];
export type VehicleMaintenance = Tables["vehicle_maintenance"]["Row"];
export type TripCharge = Tables["trip_charges"]["Row"];
export type TripChange = Tables["trip_changes"]["Row"];
export type TripDriver = Tables["trip_drivers"]["Row"];
export type PromoCode = Tables["promo_codes"]["Row"];
export type ListingReport = Tables["listing_reports"]["Row"];
export type HostLocationKind = "home" | "airport" | "hotel" | "transit" | "other" | "custom";
export type VehicleAccess = "lockbox" | "in_person" | "remote_unlock";
/** Where a trip's handover is: "car" is the car's own spot. */
export type PickupSpotKind = "car" | HostLocationKind;
export type HostLocation = Tables["host_locations"]["Row"];
export type HostLocationVehicle = Tables["host_location_vehicles"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type MessageTemplate = Tables["message_templates"]["Row"];
export type ScheduledMessage = Tables["scheduled_messages"]["Row"];
