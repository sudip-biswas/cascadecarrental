import { NextResponse } from "next/server";

export interface GeocodeSuggestion {
  label: string;    // full display name for the dropdown
  shortName: string; // short public name for locationName
  lat: number;
  lng: number;
}

// ─── Curated airport list ────────────────────────────────────────────────────
// Airports are the #1 pickup spot on car-rental platforms.
// Nominatim ranks them poorly for short/partial queries, so we check this
// list first and surface any match at the top of results.
interface Airport { iata: string; name: string; city: string; lat: number; lng: number }

const AIRPORTS: Airport[] = [
  { iata: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle, WA",       lat: 47.4502,  lng: -122.3088 },
  { iata: "PDX", name: "Portland International Airport",       city: "Portland, OR",       lat: 45.5898,  lng: -122.5951 },
  { iata: "SFO", name: "San Francisco International Airport",  city: "San Francisco, CA",  lat: 37.6213,  lng: -122.3790 },
  { iata: "OAK", name: "Oakland International Airport",        city: "Oakland, CA",         lat: 37.7213,  lng: -122.2208 },
  { iata: "SJC", name: "San Jose International Airport",       city: "San Jose, CA",        lat: 37.3626,  lng: -121.9290 },
  { iata: "LAX", name: "Los Angeles International Airport",    city: "Los Angeles, CA",     lat: 33.9425,  lng: -118.4081 },
  { iata: "BUR", name: "Hollywood Burbank Airport",            city: "Burbank, CA",         lat: 34.2007,  lng: -118.3585 },
  { iata: "LGB", name: "Long Beach Airport",                   city: "Long Beach, CA",      lat: 33.8177,  lng: -118.1516 },
  { iata: "SAN", name: "San Diego International Airport",      city: "San Diego, CA",       lat: 32.7338,  lng: -117.1933 },
  { iata: "PHX", name: "Phoenix Sky Harbor International Airport", city: "Phoenix, AZ",    lat: 33.4373,  lng: -112.0078 },
  { iata: "LAS", name: "Harry Reid International Airport",     city: "Las Vegas, NV",       lat: 36.0840,  lng: -115.1537 },
  { iata: "DEN", name: "Denver International Airport",         city: "Denver, CO",          lat: 39.8561,  lng: -104.6737 },
  { iata: "DFW", name: "Dallas/Fort Worth International Airport", city: "Dallas, TX",       lat: 32.8998,  lng: -97.0403  },
  { iata: "IAH", name: "George Bush Intercontinental Airport", city: "Houston, TX",         lat: 29.9902,  lng: -95.3368  },
  { iata: "MDW", name: "Chicago Midway International Airport", city: "Chicago, IL",         lat: 41.7868,  lng: -87.7522  },
  { iata: "ORD", name: "O'Hare International Airport",         city: "Chicago, IL",         lat: 41.9742,  lng: -87.9073  },
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta, GA", lat: 33.6407, lng: -84.4277 },
  { iata: "MIA", name: "Miami International Airport",          city: "Miami, FL",           lat: 25.7959,  lng: -80.2870  },
  { iata: "MCO", name: "Orlando International Airport",        city: "Orlando, FL",         lat: 28.4312,  lng: -81.3081  },
  { iata: "TPA", name: "Tampa International Airport",          city: "Tampa, FL",           lat: 27.9755,  lng: -82.5332  },
  { iata: "BOS", name: "Boston Logan International Airport",   city: "Boston, MA",          lat: 42.3656,  lng: -71.0096  },
  { iata: "JFK", name: "John F. Kennedy International Airport", city: "New York, NY",       lat: 40.6413,  lng: -73.7781  },
  { iata: "LGA", name: "LaGuardia Airport",                    city: "New York, NY",        lat: 40.7769,  lng: -73.8740  },
  { iata: "EWR", name: "Newark Liberty International Airport", city: "Newark, NJ",          lat: 40.6895,  lng: -74.1745  },
  { iata: "DCA", name: "Ronald Reagan Washington National Airport", city: "Washington, DC", lat: 38.8512,  lng: -77.0402  },
  { iata: "IAD", name: "Washington Dulles International Airport", city: "Washington, DC",   lat: 38.9531,  lng: -77.4565  },
  { iata: "BWI", name: "Baltimore/Washington International Airport", city: "Baltimore, MD", lat: 39.1754,  lng: -76.6683  },
  { iata: "PHL", name: "Philadelphia International Airport",   city: "Philadelphia, PA",    lat: 39.8744,  lng: -75.2424  },
  { iata: "DTW", name: "Detroit Metropolitan Wayne County Airport", city: "Detroit, MI",    lat: 42.2162,  lng: -83.3554  },
  { iata: "MSP", name: "Minneapolis-Saint Paul International Airport", city: "Minneapolis, MN", lat: 44.8848, lng: -93.2223 },
  { iata: "STL", name: "St. Louis Lambert International Airport", city: "St. Louis, MO",   lat: 38.7487,  lng: -90.3700  },
  { iata: "CLT", name: "Charlotte Douglas International Airport", city: "Charlotte, NC",    lat: 35.2140,  lng: -80.9431  },
  { iata: "RDU", name: "Raleigh-Durham International Airport", city: "Raleigh, NC",         lat: 35.8776,  lng: -78.7875  },
  { iata: "HNL", name: "Daniel K. Inouye International Airport", city: "Honolulu, HI",      lat: 21.3245,  lng: -157.9251 },
  { iata: "ANC", name: "Ted Stevens Anchorage International Airport", city: "Anchorage, AK", lat: 61.1743, lng: -149.9963 },
];

/** Returns airports whose IATA code, name, or city contains the query. */
function matchAirports(q: string): GeocodeSuggestion[] {
  const lower = q.toLowerCase();
  return AIRPORTS
    .filter((a) =>
      a.iata.toLowerCase().startsWith(lower) ||
      a.name.toLowerCase().includes(lower) ||
      a.city.toLowerCase().includes(lower)
    )
    .slice(0, 3)
    .map((a) => ({
      label: `${a.name} (${a.iata}) — ${a.city}`,
      shortName: `${a.name}, ${a.city}`,
      lat: a.lat,
      lng: a.lng,
    }));
}

// ─── Nominatim fallback ───────────────────────────────────────────────────────
async function nominatim(q: string): Promise<GeocodeSuggestion[]> {
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

  if (!res?.ok) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const places: any[] = await res.json().catch(() => []);

  return places.map((place) => {
    const a = place.address ?? {};
    const poi   = a.aerodrome ?? a.amenity ?? a.shop ?? a.tourism ?? a.leisure;
    const area  = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district;
    const city  = a.city ?? a.town ?? a.village ?? a.municipality;
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
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });

  const airports = matchAirports(q);
  // Only call Nominatim if we need more results to fill the dropdown.
  const nominatimResults = airports.length < 3 ? await nominatim(q) : [];

  // Merge: airports first, then Nominatim results (deduplicated by proximity).
  const airportCoords = new Set(airports.map((a) => `${a.lat},${a.lng}`));
  const merged = [
    ...airports,
    ...nominatimResults.filter((r) => !airportCoords.has(`${r.lat},${r.lng}`)),
  ].slice(0, 6);

  return NextResponse.json({ suggestions: merged });
}
