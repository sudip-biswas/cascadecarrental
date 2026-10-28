import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  Cog,
  Fuel,
  Gauge,
  MapPin,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { loadDailyPrices, unavailableRanges } from "@/lib/trips";
import { loadTripRules } from "@/lib/trip-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPickupSpots, publicOption } from "@/lib/locations";
import { rentalPageFor } from "@/lib/rentals";
import { NO_INDEX, OPEN_GRAPH, absoluteUrl, carIdFromSlug, carPath } from "@/lib/site";
import { VEHICLE_PUBLIC, type PublicVehicle } from "@/lib/supabase/columns";
import type { VehicleImage } from "@/lib/supabase/types";
import { HANDOVER_TIME, cn, formatDate, formatPrice, pluralize, toDateKey } from "@/lib/utils";
import { Tag, Tile, TileTitle, toneClass, type Tone } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/JsonLd";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { CarBooking } from "@/components/vehicle/BookingSidebar";
import { FavoriteButton } from "@/components/vehicle/FavoriteButton";
import { HostCard } from "@/components/vehicle/HostCard";
import { IncludedWithTrip } from "@/components/vehicle/IncludedWithTrip";
import { RulesOfTheRoad } from "@/components/vehicle/RulesOfTheRoad";
import { ShareReport } from "@/components/vehicle/ShareReport";
import { SimilarCars } from "@/components/vehicle/SimilarCars";
import { CategoryBars } from "@/components/reviews/CategoryBars";
import { fuelLabel, typeLabel } from "@/components/search/categories";
import { daysBetween, readDates } from "@/components/search/dates";
import { coverImage, firstName } from "@/components/search/vehicle";

export const instant = false;

type CarRow = PublicVehicle & {
  vehicle_images: VehicleImage[];
  vehicle_features: { category: string; feature: string }[];
  vehicle_extras: { name: string; active: boolean; position: number }[];
  host: { id: string; full_name: string; avatar_url: string | null; host_since: string | null } | null;
  persona: { id: string; name: string; avatar_url: string | null; host_since: string | null; bio: string | null; trip_count: number; rating: number | null; rating_count: number } | null;
};

type ReviewRow = {
  id: string;
  created_at: string;
  rating_overall: number;
  body: string | null;
  host_reply: string | null;
  reviewer: { full_name: string } | null;
};

const CAR_SELECT =
  `${VEHICLE_PUBLIC}, min_age, young_driver_fee_cents, delivery_enabled, airport_delivery_fee_cents, vehicle_images(*), vehicle_features(category, feature), vehicle_extras(name, active, position), host:profiles!host_id(id, full_name, avatar_url, host_since), persona:host_personas!persona_id(id, name, avatar_url, host_since, bio, trip_count, rating, rating_count)`;

/** Shared by the page and its metadata, so the car is read once per request. */
const getCar = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select(CAR_SELECT).eq("id", id).neq("status", "suspended").maybeSingle();
  return data as unknown as CarRow | null;
});

/** "5 seats, gas, automatic, 200 mi a day included. $50 a day, instant book." */
function summary(car: CarRow) {
  const specs = [
    `${car.seats} seats`,
    fuelLabel(car.fuel_type).toLowerCase(),
    car.transmission === "manual" ? "manual" : "automatic",
    `${car.distance_included_mi} mi a day included`,
  ].join(", ");
  const price = `${formatPrice(car.daily_rate_cents)} a day${car.instant_book ? ", instant book" : ""}`;
  return `${specs}. ${price}.`;
}

export async function generateMetadata({ params }: PageProps<"/cars/[vehicleId]">): Promise<Metadata> {
  const id = carIdFromSlug((await params).vehicleId);
  const car = id ? await getCar(id) : null;
  if (!car) return { title: "Car not found", ...NO_INDEX };

  const title = `${car.year} ${car.make} ${car.model} for rent in ${car.location_name}`;
  const host = firstName(car.host?.full_name);
  const description = `Rent this ${car.year} ${car.make} ${car.model}${host ? ` from ${host}` : ""} in ${car.location_name}. ${summary(car)}`;
  const cover = coverImage(car.vehicle_images);
  return {
    title,
    description,
    alternates: { canonical: carPath(car) },
    openGraph: { ...OPEN_GRAPH, title, description, url: carPath(car), ...(cover && { images: [{ url: cover.url, alt: title }] }) },
    // Unlisted cars are only visible to their owner.
    ...(car.status === "listed" ? {} : NO_INDEX),
  };
}

function Spec({ icon: Icon, tone, title, body }: { icon: LucideIcon; tone: Tone; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-[22px] bg-white p-[18px]">
      <span className={cn("flex size-11 items-center justify-center rounded-[13px]", toneClass[tone])}>
        <Icon className="size-[22px]" strokeWidth={1.75} />
      </span>
      <span>
        <span className="mb-1.5 block font-display text-[24px] leading-tight font-extrabold sm:text-[26px]">{title}</span>
        <span className="text-sm text-slate">{body}</span>
      </span>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-4", i < value ? "fill-ink" : "fill-line")} strokeWidth={0} />
      ))}
    </span>
  );
}

export default async function CarPage({ params, searchParams }: PageProps<"/cars/[vehicleId]">) {
  const slug = (await params).vehicleId;
  const vehicleId = carIdFromSlug(slug);
  if (!vehicleId) notFound();
  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dates = readDates(one(query.from), one(query.until));
  const rate = one(query.rate) === "refundable" ? "refundable" : "non_refundable";
  const fromTime = one(query.fromTime);
  const untilTime = one(query.untilTime);

  const supabase = await createClient();
  const [car, user] = await Promise.all([getCar(vehicleId), getUser()]);
  if (!car) notFound();

  // Old links used the bare id, and a car's name or place can change.
  const path = carPath(car);
  if (`/cars/${slug}` !== path) {
    const qs = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    permanentRedirect(qs ? `${path}?${qs}` : path);
  }
  const isOwner = user?.id === car.host_id;
  const { data: favorite } = user
    ? await supabase.from("favorites").select("vehicle_id").eq("user_id", user.id).eq("vehicle_id", vehicleId).maybeSingle()
    : { data: null };

  const [{ data: reviewData, count: reviewCount }, { count: hostCars }, unavailable, dailyPrices, tripRules, spots] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, created_at, rating_overall, body, host_reply, reviewer:profiles!reviewer_id(full_name)", { count: "exact" })
      .eq("vehicle_id", vehicleId)
      .eq("kind", "guest_to_host")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("host_id", car.host_id)
      .eq("status", "listed"),
    unavailableRanges(vehicleId),
    loadDailyPrices(vehicleId, toDateKey(new Date())),
    loadTripRules(supabase, vehicleId),
    // Spot addresses are private until booking: read server-side, send names and prices.
    loadPickupSpots(createAdminClient(), car),
  ]);
  const pickup = spots.map(publicOption);
  const reviews = (reviewData ?? []) as unknown as ReviewRow[];
  // Category bars average every guest rating, not just the ten listed.
  const { data: categoryRatings } = reviews.length
    ? await supabase
        .from("reviews")
        .select("rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy")
        .eq("vehicle_id", vehicleId)
        .eq("kind", "guest_to_host")
    : { data: null };

  const name = `${car.make} ${car.model}`;
  const displayName = car.persona?.name ?? car.host?.full_name;
  const host = firstName(displayName) ?? "the host";
  const hostSince = car.persona?.host_since ?? car.host?.host_since;
  const hostAvatar = car.persona?.avatar_url ?? car.host?.avatar_url ?? null;
  const hostBio = car.persona?.bio ?? null;
  const hostProfileHref = car.persona?.id ? `/hosts/${car.persona.id}` : null;
  const days = dates ? daysBetween(dates.from, dates.until) : null;
  const backParams = new URLSearchParams(dates ?? {}).toString();
  const backHref = backParams ? `/search?${backParams}` : "/search";

  const isElectric = car.fuel_type === "electric";
  const fuelNote = isElectric ? "Return it as charged as you got it" : "Return it as full as you got it";

  const rentalPage = rentalPageFor(car);
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": ["Product", "Car"],
      name: `${car.year} ${name}${car.trim ? ` ${car.trim}` : ""}`,
      description: car.description || summary(car),
      url: absoluteUrl(path),
      image: [...car.vehicle_images].sort((a, b) => a.position - b.position).map((img) => img.url),
      brand: { "@type": "Brand", name: car.make },
      model: car.model,
      vehicleModelDate: String(car.year),
      color: car.color || undefined,
      bodyType: typeLabel(car.vehicle_type),
      fuelType: fuelLabel(car.fuel_type),
      vehicleTransmission: car.transmission === "manual" ? "Manual" : "Automatic",
      seatingCapacity: car.seats,
      numberOfDoors: car.doors || undefined,
      offers: {
        "@type": "Offer",
        url: absoluteUrl(path),
        price: (car.daily_rate_cents / 100).toFixed(2),
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: (car.daily_rate_cents / 100).toFixed(2),
          priceCurrency: "USD",
          unitCode: "DAY",
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "DAY" },
        },
        businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
        availability: car.status === "listed" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        areaServed: { "@type": "City", name: "Seattle" },
        availableAtOrFrom: { "@type": "Place", name: car.location_name },
      },
      ...(reviewCount && car.rating_avg
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: car.rating_avg.toFixed(2),
              reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
            // Google wants a named author, so unnamed reviews stay out of the markup.
            review: reviews
              .filter((r) => firstName(r.reviewer?.full_name))
              .map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: firstName(r.reviewer?.full_name) },
                datePublished: r.created_at.slice(0, 10),
                reviewRating: { "@type": "Rating", ratingValue: r.rating_overall, bestRating: 5, worstRating: 1 },
                reviewBody: r.body || undefined,
              })),
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Cascade", path: "/" },
        { name: "Car rental in Seattle", path: "/seattle" },
        ...(rentalPage ? [{ name: rentalPage.h1, path: `/seattle/${rentalPage.slug}` }] : []),
        { name: `${car.year} ${name}`, path },
      ].map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: absoluteUrl(crumb.path) })),
    },
  ];

  const features = Object.entries(
    car.vehicle_features.reduce<Record<string, string[]>>((acc, f) => {
      (acc[f.category] ??= []).push(f.feature);
      return acc;
    }, {})
  );

  const details = (
    <>
      <div className="flex flex-col gap-2.5 py-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="headline text-[clamp(40px,6vw,88px)] leading-none">{name}</h1>
          {!isOwner && <FavoriteButton vehicleId={car.id} userId={user?.id ?? null} saved={!!favorite} size="lg" />}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[15px] text-slate sm:text-lg">
          {car.year}
          {car.trim ? ` ${car.trim}` : ""} · {car.location_name}
          {car.trip_count === 0 ? (
            <Tag tone="mint" className="text-sm">New, no trips yet</Tag>
          ) : car.rating_avg ? (
            <span className="flex items-center gap-1 font-bold text-ink">
              <Star className="size-4 fill-ink" strokeWidth={0} />
              {car.rating_avg.toFixed(2)}
              <span className="font-medium text-slate">· {pluralize(car.trip_count, "trip")}</span>
            </span>
          ) : (
            <span>{pluralize(car.trip_count, "trip")}</span>
          )}
        </div>
      </div>

      {car.status !== "listed" && (
        <Tile tone="butter" className="rounded-[22px] py-4 text-[15px]">
          This car is unlisted, so guests can&apos;t find or book it. Only you can see this page.
        </Tile>
      )}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Spec
          icon={Users}
          tone="sky"
          title={`${car.seats} seats`}
          body={[typeLabel(car.vehicle_type), car.doors ? `${car.doors} doors` : null].filter(Boolean).join(", ")}
        />
        <Spec
          icon={isElectric ? Zap : Fuel}
          tone="butter"
          title={fuelLabel(car.fuel_type)}
          body={
            car.range_miles
              ? `${car.range_miles} mi range`
              : car.mpg
                ? `${car.mpg} MPG. ${fuelNote}.`
                : fuelNote
          }
        />
        <Spec icon={Cog} tone="lilac" title={car.transmission === "manual" ? "Manual" : "Automatic"} body="Gearbox" />
        <Spec
          icon={Gauge}
          tone="mint"
          title={`${car.distance_included_mi} mi/day`}
          body={`Then ${car.extra_mile_fee_cents}¢ a mile`}
        />
      </div>

      <div className="grid gap-2.5">
        <IncludedWithTrip
          host={host}
          days={days}
          distanceIncludedMi={car.distance_included_mi}
          extraMileFeeCents={car.extra_mile_fee_cents}
          instantBook={car.instant_book}
          delivery={car.delivery_enabled}
        />
        <Tile tone="sky" className="flex flex-col gap-3.5 rounded-[26px] sm:p-6">
          <TileTitle className="tracking-[-0.02em] text-ink">Where it is</TileTitle>
          <span className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5 text-ink">
            <MapPin className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="text-base font-bold">{car.location_name}</span>
          </span>
          <p className="text-[15px]">
            Pick-up and return are at the same spot, at {HANDOVER_TIME}. You&apos;ll sort out the exact place with {host} once
            the trip is booked.
          </p>
        </Tile>
      </div>

      {car.description && (
        <Tile className="flex flex-col gap-2 rounded-[24px]">
          <TileTitle>About this car</TileTitle>
          <p className="text-base leading-[1.5] whitespace-pre-line text-slate">{car.description}</p>
        </Tile>
      )}

      {features.length > 0 && (
        <Tile className="flex flex-col gap-3 rounded-[24px]">
          <TileTitle>Features</TileTitle>
          <div className="flex flex-wrap gap-1.5">
            {features.flatMap(([, list]) => list).map((feature) => (
              <Tag key={feature} className="px-2.5 py-1.5 text-sm font-semibold">
                {feature}
              </Tag>
            ))}
          </div>
        </Tile>
      )}

      {reviews.length ? (
        <Tile className="flex flex-col gap-4 rounded-[24px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <TileTitle>Reviews</TileTitle>
            {car.rating_avg && (
              <span className="flex items-center gap-1.5 text-base font-bold">
                <Star className="size-4 fill-ink" strokeWidth={0} />
                {car.rating_avg.toFixed(2)}
                <span className="font-medium text-slate">· {pluralize(reviews.length, "review")}</span>
              </span>
            )}
          </div>
          <CategoryBars reviews={categoryRatings ?? []} />
          <ul className="flex flex-col gap-2">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-2 rounded-[18px] bg-board p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-bold">
                    {firstName(review.reviewer?.full_name) ?? "A guest"}
                    <span className="font-medium text-slate"> · {formatDate(review.created_at, { day: undefined, month: "long" })}</span>
                  </span>
                  <Stars value={review.rating_overall} />
                </div>
                {review.body && <p className="text-[15px] leading-[1.5]">{review.body}</p>}
                {review.host_reply && (
                  <p className="rounded-[14px] bg-white px-3.5 py-2.5 text-sm text-slate">
                    <span className="font-bold text-ink">{host}: </span>
                    {review.host_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Tile>
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-[24px] bg-white p-5 sm:p-[22px]">
          <span className="flex size-[52px] items-center justify-center rounded-[15px] bg-butter">
            <Star className="size-6" strokeWidth={1.75} />
          </span>
          <span className="flex-[1_1_240px]">
            <span className="mb-1.5 block font-display text-[24px] font-extrabold">No reviews yet</span>
            <span className="text-[15px] text-slate">The first trip writes the first one.</span>
          </span>
        </div>
      )}

      <HostCard
        hostId={car.host_id}
        name={host}
        avatarUrl={hostAvatar}
        bio={hostBio}
        hostSince={hostSince ?? null}
        profileHref={hostProfileHref}
        persona={
          car.persona
            ? { tripCount: car.persona.trip_count, rating: car.persona.rating, ratingCount: car.persona.rating_count }
            : null
        }
        messageHref={!isOwner && car.host ? `/messages/new?host=${car.host.id}` : null}
        cars={hostCars}
      />
      <RulesOfTheRoad
        host={host}
        electric={isElectric}
        distanceIncludedMi={car.distance_included_mi}
        extraMileFeeCents={car.extra_mile_fee_cents}
      />
      <ShareReport vehicleId={car.id} title={`${car.year} ${name}`} path={path} userId={user?.id ?? null} isOwner={isOwner} />
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 pt-0 sm:px-6 sm:pt-5 lg:pb-16">
      <JsonLd data={structured} />
      <PhotoGallery images={car.vehicle_images} vehicleName={`${car.year} ${name}`} backHref={backHref} />

      {isOwner ? (
        <div className="flex flex-wrap items-start gap-5 pb-16">
          <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">{details}</div>
          <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 rounded-[30px] bg-white p-[22px] lg:sticky lg:top-4">
            <span className="font-display text-[28px] font-extrabold">This is your car</span>
            <p className="text-[15px] text-slate">This is how guests see it. You can&apos;t book your own car.</p>
            <Button asChild size="lg">
              <Link href={`/host/vehicles/${car.id}`}>Manage this car</Link>
            </Button>
          </aside>
        </div>
      ) : (
        <CarBooking
          vehicle={{
            id: car.id,
            daily_rate_cents: car.daily_rate_cents,
            weekly_discount_pct: car.weekly_discount_pct,
            monthly_discount_pct: car.monthly_discount_pct,
            three_day_discount_pct: car.three_day_discount_pct,
            two_week_discount_pct: car.two_week_discount_pct,
            three_week_discount_pct: car.three_week_discount_pct,
            last_minute_boost_pct: car.last_minute_boost_pct,
            min_trip_days: car.min_trip_days,
            max_trip_days: car.max_trip_days,
            advance_notice_hours: car.advance_notice_hours,
            instant_book: car.instant_book,
          }}
          hostName={host}
          unavailable={unavailable}
          dailyPrices={dailyPrices}
          initialFrom={dates?.from}
          initialUntil={dates?.until}
          initialFromTime={fromTime}
          initialUntilTime={untilTime}
          initialRate={rate}
          isLoggedIn={!!user}
          tripRules={tripRules ?? undefined}
          pickup={pickup}
          perks={{
            minAge: car.min_age,
            youngDriverFeeCents: car.young_driver_fee_cents,
            delivery: pickup.length > 1,
            extras: car.vehicle_extras.filter((e) => e.active).sort((a, b) => a.position - b.position).map((e) => e.name),
          }}
        >
          {details}
        </CarBooking>
      )}

      <SimilarCars vehicleId={car.id} vehicleType={car.vehicle_type} dailyRateCents={car.daily_rate_cents} dates={dates} />
    </div>
  );
}
