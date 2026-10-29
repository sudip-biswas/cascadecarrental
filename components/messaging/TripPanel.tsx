import Image from "next/image";
import Link from "next/link";
import { ExternalLink, MapPin, Phone, ReceiptText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostEarningsCents } from "@/lib/pricing";
import { tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDate, formatDay, formatPrice, formatTime, pluralize } from "@/lib/utils";
import { Fact, Tag } from "@/components/kit";
import { CarPhoto, Initial, coverUrl } from "@/components/host/bits";
import type { ConversationDetail } from "./inbox";

type Viewer = "guest" | "host";

interface PanelCar {
  id: string;
  name: string;
  photo: string | null;
  dailyCents?: number;
}

export interface PanelData {
  viewer: Viewer;
  other: {
    id: string;
    name: string;
    avatar: string | null;
    joined: string | null;
    /** Only for a host, once the trip is confirmed. */
    phone: string | null;
    licenceChecked: boolean;
  };
  trip: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: NonNullable<ConversationDetail["trip"]>["status"];
    payment_status: NonNullable<ConversationDetail["trip"]>["payment_status"];
    pickupPlace: string;
    /** The exact spot, once the guest may see it. */
    address: string | null;
    delivered: boolean;
    total_cents: number;
    subtotal_cents: number;
  } | null;
  car: PanelCar | null;
  /** No trip yet: the host's cars the guest might be asking about. */
  cars: PanelCar[];
}

const CONFIRMED = new Set(["approved", "active", "completed"]);

/**
 * What the side panel shows for a conversation. Reads private columns (exact
 * address, phone) with the admin client, so only call it for someone already
 * known to be in the conversation.
 */
export async function loadPanel(conversation: ConversationDetail): Promise<PanelData> {
  const admin = createAdminClient();
  const viewer = conversation.role;
  const [{ data: person }, { data: trip }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, avatar_url, created_at, phone, driving_license_verified")
      .eq("id", conversation.other.id)
      .maybeSingle(),
    conversation.trip
      ? admin
          .from("trips")
          .select(
            "id, starts_at, ends_at, status, payment_status, pickup_location, delivery_address, total_cents, subtotal_cents, vehicle:vehicles(id, make, model, year, location_address, vehicle_images(url, is_cover, position))"
          )
          .eq("id", conversation.trip.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const confirmed = !!trip && CONFIRMED.has(trip.status);
  const other: PanelData["other"] = {
    id: conversation.other.id,
    name: person?.full_name || conversation.other.full_name,
    avatar: person?.avatar_url ?? null,
    joined: person?.created_at ?? null,
    // Hosts can call the guest about a confirmed trip, as on the trip page.
    phone: viewer === "host" && confirmed ? (person?.phone ?? null) : null,
    licenceChecked: !!person?.driving_license_verified,
  };

  if (trip) {
    const v = trip.vehicle as unknown as {
      id: string;
      make: string;
      model: string;
      year: number;
      location_address: string | null;
      vehicle_images: { url: string; is_cover: boolean; position: number }[];
    } | null;
    // The guest sees the exact spot once the host has said yes; the host always knows it.
    const address = trip.delivery_address ?? (viewer === "host" || confirmed ? (v?.location_address ?? null) : null);
    return {
      viewer,
      other,
      trip: {
        id: trip.id,
        starts_at: trip.starts_at,
        ends_at: trip.ends_at,
        status: trip.status,
        payment_status: trip.payment_status,
        pickupPlace: trip.pickup_location,
        address,
        delivered: !!trip.delivery_address,
        total_cents: trip.total_cents,
        subtotal_cents: trip.subtotal_cents,
      },
      car: v ? { id: v.id, name: `${v.make} ${v.model} ${v.year}`, photo: coverUrl(v.vehicle_images) } : null,
      cars: [],
    };
  }

  // Before a booking, a guest is asking a host about one of their cars.
  let cars: PanelCar[] = [];
  if (viewer === "guest") {
    const { data } = await admin
      .from("vehicles")
      .select("id, make, model, year, daily_rate_cents, vehicle_images(url, is_cover, position)")
      .eq("host_id", conversation.other.id)
      .eq("status", "listed")
      .order("created_at", { ascending: true })
      .limit(3);
    cars = (data ?? []).map((v) => ({
      id: v.id,
      name: `${v.make} ${v.model} ${v.year}`,
      photo: coverUrl(v.vehicle_images),
      dailyCents: v.daily_rate_cents,
    }));
  }
  return { viewer, other, trip: null, car: null, cars };
}

/** "Sat Oct 24" over "10:00", so neither breaks in a narrow column. */
function When({ iso }: { iso: string }) {
  return (
    <>
      <span className="block whitespace-nowrap">{formatDay(iso)}</span>
      <span className="figures block font-semibold">{formatTime(iso)}</span>
    </>
  );
}

function QuickLink({ href, icon, children, external }: { href: string; icon: React.ReactNode; children: React.ReactNode; external?: boolean }) {
  const className =
    "flex h-11 items-center gap-2 rounded-[14px] bg-board px-3.5 text-[15px] font-bold transition-colors hover:bg-line [&_svg]:size-[18px] [&_svg]:flex-none";
  return external ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={className}>
      {icon}
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {icon}
      {children}
    </Link>
  );
}

function PersonCard({ data }: { data: PanelData }) {
  const { other, viewer } = data;
  const role = viewer === "guest" ? "Host" : "Guest";
  const body = (
    <>
      {other.avatar ? (
        <Image src={other.avatar} alt="" width={44} height={44} className="size-11 flex-none rounded-[14px] object-cover" />
      ) : (
        <Initial name={other.name} seed={other.id} className="size-11 rounded-[14px] text-[18px]" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-extrabold">{other.name}</span>
        <span className="truncate text-sm text-slate">
          {role}
          {other.joined && ` · joined ${formatDate(other.joined, { day: undefined })}`}
        </span>
      </span>
      {viewer === "host" && other.licenceChecked && <Tag tone="mint">Licence checked</Tag>}
    </>
  );
  return viewer === "guest" ? (
    <Link href={`/hosts/${other.id}`} className="flex items-center gap-3 rounded-[18px] bg-board p-2.5 transition-colors hover:bg-line">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-[18px] bg-board p-2.5">{body}</div>
  );
}

/** The trip (or the host's cars) beside a conversation, with the links people reach for while chatting. */
export function TripPanel({ data, className }: { data: PanelData; className?: string }) {
  const { trip, car, viewer } = data;

  if (!trip) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <PersonCard data={data} />
        {viewer === "guest" ? (
          data.cars.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-slate">{pluralize(data.cars.length, "car")} from this host</span>
              {data.cars.map((c) => (
                <Link key={c.id} href={`/cars/${c.id}`} className="flex items-center gap-3 rounded-[18px] bg-board p-2.5 transition-colors hover:bg-line">
                  <CarPhoto src={c.photo} alt="" sizes="64px" className="h-[50px] w-16 flex-none rounded-[12px]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-extrabold">{c.name}</span>
                    {c.dailyCents != null && <span className="text-sm text-slate">from {formatPrice(c.dailyCents)}/day</span>}
                  </span>
                </Link>
              ))}
            </div>
          )
        ) : (
          <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">Not booked yet. They&apos;re asking before they book.</p>
        )}
      </div>
    );
  }

  const status = tripStatus(trip, viewer);
  const tripHref = viewer === "guest" ? `/trips/${trip.id}` : `/host/trips/${trip.id}`;
  const paid = trip.payment_status === "captured" || trip.payment_status === "authorized" || trip.payment_status === "refunded";
  const directions = trip.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.address)}` : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Link href={tripHref} className="group flex flex-col gap-2.5">
        <CarPhoto src={car?.photo ?? null} alt="" sizes="320px" className="aspect-[16/10] w-full rounded-[20px]" />
        <span className="flex items-start justify-between gap-2">
          <span className="text-lg leading-tight font-extrabold group-hover:text-cobalt">{car?.name ?? "Trip"}</span>
          <Tag tone={status.tone}>{status.label}</Tag>
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-1.5">
        <Fact label="Pick-up" value={<When iso={trip.starts_at} />} />
        <Fact label="Return" value={<When iso={trip.ends_at} />} />
        <Fact
          className="col-span-2"
          label={trip.delivered ? "Delivered to" : "Pick-up place"}
          value={trip.address ?? trip.pickupPlace}
        />
        <Fact
          className="col-span-2"
          label={viewer === "guest" ? "Trip total" : "Your earnings"}
          value={formatCurrency(viewer === "guest" ? trip.total_cents : hostEarningsCents(trip.subtotal_cents))}
        />
      </div>

      <PersonCard data={data} />

      <div className="flex flex-col gap-1.5">
        <QuickLink href={tripHref} icon={<ExternalLink />}>
          Trip page
        </QuickLink>
        {viewer === "guest" && paid && (
          <QuickLink href={`/trips/${trip.id}/receipt`} icon={<ReceiptText />}>
            Receipt
          </QuickLink>
        )}
        {viewer === "host" && (
          <QuickLink href={`/host/trips/${trip.id}#earnings`} icon={<ReceiptText />}>
            Earnings
          </QuickLink>
        )}
        {directions && (viewer === "guest" || trip.delivered) && (
          <QuickLink href={directions} icon={<MapPin />} external>
            Directions
          </QuickLink>
        )}
        {data.other.phone && (
          <QuickLink href={`tel:${data.other.phone}`} icon={<Phone />} external>
            Call {data.other.name.split(" ")[0]}
          </QuickLink>
        )}
      </div>
    </div>
  );
}
