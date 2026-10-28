import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List, Plus, SearchX } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState, PageTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { ListingsToolbar } from "@/components/host/listings/ListingsToolbar";
import { ListingGrid, ListingList } from "@/components/host/listings/ListingViews";
import { loadListings } from "@/components/host/listings/load";
import { listingsHref, matches, readQuery, type ListingsQuery } from "@/components/host/listings/query";

export const instant = false;
export const metadata = { title: "Cars" };

function ViewToggle({ query }: { query: ListingsQuery }) {
  const options = [
    { id: "grid", label: "Grid", icon: LayoutGrid },
    { id: "list", label: "List", icon: List },
  ] as const;
  return (
    <nav aria-label="View" className="flex shrink-0 gap-1 rounded-[14px] bg-white p-1">
      {options.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={listingsHref(query, { view: id })}
          scroll={false}
          aria-current={query.view === id ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[15px] font-semibold transition-colors",
            query.view === id ? "bg-ink text-white" : "text-ink hover:bg-board"
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default async function HostCarsPage({ searchParams }: PageProps<"/host/vehicles">) {
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host/vehicles");

  const [cars, query] = await Promise.all([loadListings(user.id), searchParams.then(readQuery)]);
  const shown = cars.filter((car) => matches(car, query));
  const filtered = !!(query.q || query.trip || query.listing);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title="Cars"
        action={
          <Button asChild size="lg" className="text-base">
            <Link href="/host/vehicles/new">
              <Plus /> List your car
            </Link>
          </Button>
        }
      />

      {cars.length > 0 && (
        <>
          <ListingsToolbar query={query} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="figures text-[26px] leading-none">
                {filtered ? `${shown.length} of ${pluralize(cars.length, "listing")}` : pluralize(cars.length, "listing")}
              </h2>
              {filtered && (
                <Link
                  href={listingsHref({ q: "", trip: null, listing: null, view: query.view })}
                  scroll={false}
                  className="rounded-[10px] px-2 py-1 text-[15px] font-bold text-slate underline-offset-4 hover:text-ink hover:underline"
                >
                  Clear filters
                </Link>
              )}
            </div>
            <ViewToggle query={query} />
          </div>
        </>
      )}

      {cars.length === 0 ? (
        <EmptyState
          icon={<Plus />}
          title="List your first car"
          body="All it takes is the car, a few photos and a daily price."
          action={
            <Button asChild size="lg">
              <Link href="/host/vehicles/new">List your car</Link>
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No cars match that"
          body="Try another make, model or plate, or loosen a filter."
          action={
            <Button asChild variant="secondary">
              <Link href={listingsHref({ q: "", trip: null, listing: null, view: query.view })} scroll={false}>
                Clear filters
              </Link>
            </Button>
          }
        />
      ) : query.view === "list" ? (
        <ListingList cars={shown} />
      ) : (
        <ListingGrid cars={shown} />
      )}
    </div>
  );
}
