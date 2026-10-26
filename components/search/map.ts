import { roughPrice, type ListedVehicle } from "./vehicle";

/** A price bubble on the search map. */
export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** "$64": the daily price. */
  label: string;
  title: string;
};

/** Up to ~350 m each way, so a pin shows the neighborhood, not the driveway. */
const FUZZ_DEG = { lat: 0.003, lng: 0.0045 };

/** Two stable numbers in [-1, 1] from a car id, so a pin doesn't jump between visits. */
function jitter(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return [((h & 0xffff) / 0xffff) * 2 - 1, (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Pins for the cars that have a location, nudged and rounded off the exact spot. */
export function mapPins(cars: ListedVehicle[]): MapPin[] {
  return cars.flatMap((car) => {
    if (car.location_lat == null || car.location_lng == null) return [];
    const [dLat, dLng] = jitter(car.id);
    return [
      {
        id: car.id,
        lat: round3(car.location_lat + dLat * FUZZ_DEG.lat),
        lng: round3(car.location_lng + dLng * FUZZ_DEG.lng),
        label: roughPrice(car.daily_rate_cents),
        title: `${car.year} ${car.make} ${car.model}`,
      },
    ];
  });
}
