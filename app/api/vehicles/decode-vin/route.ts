import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Map NHTSA values to our schema enums
function mapFuelType(nhtsaFuel: string): string {
  const f = nhtsaFuel.toLowerCase();
  if (f.includes("electric") && f.includes("gas")) return "hybrid";
  if (f.includes("hybrid")) return "hybrid";
  if (f.includes("electric")) return "electric";
  if (f.includes("diesel")) return "diesel";
  return "gasoline";
}

function mapTransmission(nhtsaTx: string): string {
  return nhtsaTx.toLowerCase().includes("manual") ? "manual" : "automatic";
}

function mapVehicleType(bodyClass: string): string {
  const b = bodyClass.toLowerCase();
  if (b.includes("suv") || b.includes("sport utility")) return "suv";
  if (b.includes("pickup") || b.includes("truck")) return "truck";
  if (b.includes("van") || b.includes("minivan")) return "van";
  if (b.includes("convertible") || b.includes("coupe") || b.includes("sport")) return "sports";
  if (b.includes("luxury") || b.includes("limousine")) return "luxury";
  return "sedan";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vin = searchParams.get("vin")?.trim().toUpperCase();

  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "VIN must be 17 characters" }, { status: 400 });
  }

  // Check for duplicate in our DB
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("vehicles")
    .select("id")
    .eq("vin", vin)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A vehicle with this VIN is already listed on Cascade" }, { status: 409 });
  }

  // Call NHTSA free API
  const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`;
  let nhtsaRes: Response;
  try {
    nhtsaRes = await fetch(nhtsaUrl, { next: { revalidate: 86400 } });
  } catch {
    return NextResponse.json({ error: "Could not reach NHTSA API" }, { status: 502 });
  }

  if (!nhtsaRes.ok) {
    return NextResponse.json({ error: "NHTSA decode failed" }, { status: 502 });
  }

  const { Results } = await nhtsaRes.json();
  const get = (variable: string): string =>
    Results?.find((r: any) => r.Variable === variable)?.Value?.trim() ?? "";

  const make = get("Make");
  const model = get("Model");
  const yearStr = get("Model Year");
  const trim = get("Trim") || get("Trim Level");
  const fuelRaw = get("Fuel Type - Primary");
  const txRaw = get("Transmission Style");
  const seatsRaw = get("Number of Seats");
  const bodyClass = get("Body Class");
  const doorsRaw = get("Doors");

  if (!make || !model || !yearStr) {
    return NextResponse.json({ error: "VIN not recognized — please fill in details manually" }, { status: 422 });
  }

  return NextResponse.json({
    make: make.charAt(0).toUpperCase() + make.slice(1).toLowerCase(),
    model,
    year: parseInt(yearStr),
    trim: trim || null,
    fuelType: fuelRaw ? mapFuelType(fuelRaw) : null,
    transmission: txRaw ? mapTransmission(txRaw) : null,
    seats: seatsRaw ? parseInt(seatsRaw) || null : null,
    vehicleType: bodyClass ? mapVehicleType(bodyClass) : null,
    doors: doorsRaw ? parseInt(doorsRaw) || null : null,
  });
}
