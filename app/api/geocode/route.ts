import { NextResponse } from "next/server";

export interface GeocodeSuggestion {
  label: string;    // full display name for the dropdown
  shortName: string; // short public name for locationName
  lat: number;
  lng: number;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ suggestions: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "CascadeCarRental/1.0 (contact@cascadecarrental.com)",
      "Accept-Language": "en",
    },
  }).catch(() => null);

  if (!res?.ok) return NextResponse.json({ suggestions: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const places: any[] = await res.json().catch(() => []);

  const suggestions: GeocodeSuggestion[] = places.map((place) => {
    const a = place.address ?? {};
    const poi = a.aerodrome ?? a.amenity ?? a.shop ?? a.tourism ?? a.leisure;
    const area = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district;
    const city = a.city ?? a.town ?? a.village ?? a.municipality;
    const state = a.state_code ?? a.state;

    let shortName = poi ?? area ?? city ?? place.display_name.split(",")[0];
    if (city && shortName !== city) shortName = `${shortName}, ${city}`;
    if (state) shortName = `${shortName}, ${state}`;

    return {
      label: place.display_name,
      shortName: shortName.trim(),
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
    };
  });

  return NextResponse.json({ suggestions });
}
