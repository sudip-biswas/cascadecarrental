import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, IdCard } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Container, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { LicenceCheck } from "@/components/profile/LicenceCheck";
import { GuestRecord } from "@/components/host/GuestRecord";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { cn, formatDate, pluralize } from "@/lib/utils";
import { NO_INDEX } from "@/lib/site";

export const instant = false;
export const metadata = { title: "Your profile", ...NO_INDEX };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const { verify } = await searchParams;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/profile");

  const [{ data: profile }, { count: carCount }] = await Promise.all([
    // Phone is a private column, so read your own profile with the admin client.
    createAdminClient()
      .from("profiles")
      .select("id, full_name, bio, phone, is_host, driving_license_verified, identity_verified, identity_status, identity_error, date_of_birth, created_at")
      .eq("id", user.id)
      .single(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("host_id", user.id),
  ]);

  const name = profile?.full_name || user.email || "You";
  const cars = carCount ?? 0;
  const checklist = [
    { label: "Email", done: !!user.email_confirmed_at, todo: "Email not confirmed" },
    { label: "Phone", done: !!profile?.phone, todo: "Add phone", href: "#phone" },
    { label: "Driver's licence", done: !!profile?.driving_license_verified, todo: "Licence not checked", href: "#licence" },
    { label: "ID", done: !!profile?.identity_verified, todo: "ID not checked", href: "#licence" },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <Container className="grid items-start gap-4 pt-6 pb-12 sm:pt-8 md:grid-cols-2">
      <Tile tone="peach" className="flex flex-wrap items-center gap-7 p-6 sm:p-7 md:col-span-2">
        <span
          aria-hidden
          className="flex size-24 items-center justify-center rounded-[30px] bg-white font-display text-[46px] font-extrabold sm:size-[120px] sm:rounded-[36px] sm:text-[56px]"
        >
          {name[0].toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
          <h1 className="headline truncate text-[clamp(44px,5vw,76px)]">{name}</h1>
          <p className="text-base text-peach-ink">
            On Cascade since {formatDate(profile?.created_at ?? user.created_at, { day: undefined, month: "long" })}
            {" · "}
            {profile?.is_host ? "renting and hosting" : "renting"}
          </p>
          <GuestRecord guestId={user.id} variant="line" className="text-base text-peach-ink" />
        </div>
        <div className="flex flex-[1_1_340px] flex-col gap-3 rounded-[24px] bg-white p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[22px] font-extrabold">Ready to drive</span>
            <span className="figures text-[15px] font-bold">
              {done} of {checklist.length}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {checklist.map((c, i) => (
              <span key={c.label} className={cn("h-2.5 rounded-[5px]", i < done ? "bg-ink" : "bg-line")} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-sm">
            {checklist.map((c) =>
              c.done ? (
                <li key={c.label} className="flex items-center gap-1.5">
                  <Check className="size-4" strokeWidth={2.5} />
                  {c.label}
                </li>
              ) : c.href ? (
                <li key={c.label}>
                  <a href={c.href} className="font-bold text-cobalt hover:underline">
                    {c.todo}
                  </a>
                </li>
              ) : (
                <li key={c.label} className="text-slate">
                  {c.todo}
                </li>
              )
            )}
          </ul>
        </div>
      </Tile>

      <Tile className="flex flex-col gap-2.5 p-6">
        <TileTitle className="mb-1.5">About you</TileTitle>
        <ProfileForm
          profile={{
            id: user.id,
            full_name: profile?.full_name ?? "",
            phone: profile?.phone ?? null,
            bio: profile?.bio ?? null,
            date_of_birth: profile?.date_of_birth ?? null,
          }}
          dobLocked={!!profile?.identity_verified}
          email={user.email ?? ""}
        />
      </Tile>

      <div className="flex flex-col gap-4">
        <Tile id="licence" tone="sky" className="flex flex-wrap items-start gap-[18px] p-6">
          <span className="flex size-16 items-center justify-center rounded-[18px] bg-white">
            <IdCard className="size-[30px]" strokeWidth={1.75} />
          </span>
          <span className="flex-[1_1_200px]">
            <span className="mb-1.5 block font-display text-[24px] font-extrabold">Driver&apos;s licence</span>
            <LicenceCheck
              status={profile?.driving_license_verified ? "verified" : (profile?.identity_status ?? "unverified")}
              error={profile?.identity_error ?? null}
              returned={verify === "done"}
            />
          </span>
        </Tile>

        <Tile tone="ink" className="flex flex-wrap items-center gap-4 p-6">
          <span className="flex-[1_1_200px]">
            <span className="mb-1.5 block font-display text-[24px] font-extrabold">
              {cars > 0 ? `You host ${pluralize(cars, "car")}` : "Got a car you don't use every day?"}
            </span>
            <span className="text-[15px] text-[#c9ccd3]">
              {cars > 0 ? "Same login, the host side is one click away." : "List it and earn when it's parked."}
            </span>
          </span>
          <Button asChild className="bg-butter text-ink hover:bg-[#ffdf80]">
            <Link href={cars > 0 ? "/host" : "/host/vehicles/new"}>{cars > 0 ? "Open hosting" : "List your car"}</Link>
          </Button>
        </Tile>

        <SignOutButton />
      </div>
    </Container>
  );
}
