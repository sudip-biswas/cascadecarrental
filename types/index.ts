import type { Database } from "@/lib/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleImage = Database["public"]["Tables"]["vehicle_images"]["Row"];
export type VehicleFeature = Database["public"]["Tables"]["vehicle_features"]["Row"];
export type VehicleAvailability = Database["public"]["Tables"]["vehicle_availability"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

export interface VehicleWithImages extends Vehicle {
  vehicle_images: VehicleImage[];
}

export interface VehicleWithDetails extends Vehicle {
  vehicle_images: VehicleImage[];
  vehicle_features: VehicleFeature[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "host_since">;
  reviews?: Review[];
}

export interface TripWithDetails extends Trip {
  vehicles: VehicleWithImages;
  guest: Pick<Profile, "id" | "full_name" | "avatar_url">;
  host: Pick<Profile, "id" | "full_name" | "avatar_url">;
}

export interface ConversationWithDetails extends Conversation {
  messages: Message[];
  guest: Pick<Profile, "id" | "full_name" | "avatar_url">;
  host: Pick<Profile, "id" | "full_name" | "avatar_url">;
  trips: Pick<Trip, "id" | "status" | "starts_at" | "ends_at"> | null;
}

export interface SearchParams {
  where?: string;
  lat?: string;
  lng?: string;
  from?: string;
  until?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  seats?: string;
  fuel?: string;
  make?: string;
  year?: string;
  sort?: "price_asc" | "price_desc" | "rating" | "newest";
}
