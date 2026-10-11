import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HeroSearchBar } from "@/components/home/HeroSearchBar";
import { CategoryTabs } from "@/components/home/CategoryTabs";
import { VehicleCard } from "@/components/search/VehicleCard";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";
import type { VehicleWithImages } from "@/types";

export const instant = false;

async function FeaturedVehicles() {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .eq("status", "listed")
    .order("trip_count", { ascending: false })
    .limit(6);

  if (!vehicles?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No vehicles available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {(vehicles as VehicleWithImages[]).map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[480px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-cascade-900 via-cascade-700 to-cascade-500" />
          {/* Decorative mountain shapes */}
          <svg
            className="absolute bottom-0 left-0 right-0 text-white"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0,80 L0,40 L360,10 L720,50 L1080,15 L1440,45 L1440,80 Z"
              fill="currentColor"
              opacity="0.08"
            />
            <path
              d="M0,80 L0,60 L480,25 L960,55 L1440,30 L1440,80 Z"
              fill="currentColor"
              opacity="0.06"
            />
          </svg>
        </div>

        <div className="relative z-10 text-center px-4 py-16 w-full max-w-4xl mx-auto space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Rent a car,{" "}
              <span className="text-cascade-300">not a rental car</span>
            </h1>
            <p className="text-lg text-cascade-100 max-w-xl mx-auto">
              Find the exact car you want, exactly where you need it — from
              local hosts in the Pacific Northwest.
            </p>
          </div>

          <Suspense>
            <HeroSearchBar />
          </Suspense>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Suspense>
          <CategoryTabs />
        </Suspense>
      </section>

      {/* Featured Vehicles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-cascade-900">Popular cars</h2>
          <Link
            href="/search"
            className="text-sm text-cascade-700 font-medium hover:underline"
          >
            View all
          </Link>
        </div>

        <Suspense fallback={<VehicleGridSkeleton />}>
          <FeaturedVehicles />
        </Suspense>
      </section>

      {/* Host CTA Banner */}
      <section className="bg-cascade-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Earn with your car
          </h2>
          <p className="text-cascade-300 text-lg max-w-xl mx-auto">
            List your car on Cascade and start earning. We handle the hard
            parts so you can focus on the rewards.
          </p>
          <Link
            href="/host/vehicles/new"
            className="inline-flex items-center gap-2 bg-cascade-500 hover:bg-cascade-300 text-white px-8 py-3 rounded-full font-semibold transition-colors"
          >
            List your car →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-cascade-900 text-center mb-10">
          How Cascade works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Search",
              desc: "Enter your location and dates to find available cars near you.",
            },
            {
              step: "2",
              title: "Book",
              desc: "Choose your car, select protection, and pay securely online.",
            },
            {
              step: "3",
              title: "Drive",
              desc: "Pick up from the host or have it delivered. Return when done.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-cascade-100 text-cascade-700 font-bold text-xl flex items-center justify-center mx-auto">
                {step}
              </div>
              <h3 className="font-semibold text-cascade-900 text-lg">{title}</h3>
              <p className="text-muted-foreground text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
