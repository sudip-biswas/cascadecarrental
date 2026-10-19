// This file will be replaced by: supabase gen types typescript --project-id <id> > lib/supabase/types.ts
// Placeholder types until Supabase project is configured

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
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          avatar_url?: string | null;
          host_since?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          avatar_url?: string | null;
          host_since?: string | null;
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
          body: string | null;
          host_reply: string | null;
          host_replied_at: string | null;
          created_at: string;
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
          body?: string | null;
          host_reply?: string | null;
          host_replied_at?: string | null;
          created_at?: string;
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
          body?: string | null;
          host_reply?: string | null;
          host_replied_at?: string | null;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
