import Link from "next/link";
import { Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";
import { EmptyState, PageTitle, Tag, Tile, type Tone } from "@/components/kit";
import { emailsFor, isAdmin, requireAdminPage, usersByEmail } from "../_lib/admin";
import { FilterLinks, SearchBox } from "../_components/bits";
import { UserActions } from "./user-actions";

export const instant = false;
export const metadata = { title: "Users · Admin", ...NO_INDEX };

type Row = Pick<
  Profile,
  "id" | "full_name" | "is_host" | "driving_license_verified" | "identity_verified" | "identity_status" | "identity_error" | "suspended_at" | "created_at" | "date_of_birth"
> & { vehicles: { status: string }[] };

const FIELDS =
  "id, full_name, is_host, driving_license_verified, identity_verified, identity_status, identity_error, suspended_at, created_at, date_of_birth, vehicles:vehicles!host_id(status)";

const ID_TONE: Record<Profile["identity_status"], Tone> = { unverified: "board", pending: "butter", verified: "mint", failed: "peach" };

/** "pending" and "suspended" are lists; anything else matches email or name. */
async function findUsers(q: string): Promise<Row[]> {
  const admin = createAdminClient();
  const base = () => admin.from("profiles").select(FIELDS).order("created_at", { ascending: false }).limit(50);
  const rows = async (query: ReturnType<typeof base>) => ((await query).data ?? []) as unknown as Row[];

  if (!q) return rows(base().limit(30));
  if (q === "pending") return rows(base().eq("identity_status", "pending"));
  if (q === "suspended") return rows(base().not("suspended_at", "is", null));

  const name = q.replace(/[%,()*]/g, " ").trim();
  const [byEmail, byName] = await Promise.all([usersByEmail(q), name ? rows(base().ilike("full_name", `%${name}%`)) : []]);
  const missing = byEmail.map((u) => u.id).filter((id) => !byName.some((r) => r.id === id));
  const extra = missing.length ? await rows(base().in("id", missing)) : [];
  return [...byName, ...extra];
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/host/admin/users">) {
  const me = await requireAdminPage("/host/admin/users");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const users = await findUsers(q);
  const emails = await emailsFor(users.map((u) => u.id));
  const preset = q === "pending" || q === "suspended" ? q : q ? "search" : "all";

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Users" lead="Look someone up, check their licence and ID by hand, or suspend an account." />
      <SearchBox action="/host/admin/users" q={preset === "search" ? q : ""} placeholder="Email or name" />
      <FilterLinks
        current={preset}
        options={[
          { value: "all", label: "Newest", href: "/host/admin/users" },
          { value: "pending", label: "ID pending", href: "/host/admin/users?q=pending" },
          { value: "suspended", label: "Suspended", href: "/host/admin/users?q=suspended" },
        ]}
      />

      {users.length === 0 && <EmptyState icon={<Users />} title="Nobody found." body="Try part of their email or name." />}

      {users.map((u) => {
        const email = emails[u.id] ?? "";
        const listed = u.vehicles.filter((v) => v.status === "listed").length;
        return (
          <Tile key={u.id} tone={u.suspended_at ? "peach" : "white"} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[19px] font-extrabold">{u.full_name || "No name"}</span>
                <span className="truncate text-[14px] opacity-75">
                  {email} · joined {formatDate(u.created_at)}
                  {u.date_of_birth ? ` · born ${formatDate(`${u.date_of_birth}T12:00:00Z`)}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.suspended_at && <Tag tone="ink">Suspended {formatDate(u.suspended_at)}</Tag>}
                {isAdmin(u) && <Tag tone="lilac">Admin</Tag>}
                {u.is_host && <Tag tone="sky">Host, {listed}/{u.vehicles.length} cars listed</Tag>}
                <Tag tone={u.driving_license_verified ? "mint" : "board"}>{u.driving_license_verified ? "Licence checked" : "Licence not checked"}</Tag>
                <Tag tone={ID_TONE[u.identity_status]}>ID {u.identity_status}</Tag>
              </div>
            </div>
            {u.identity_error && <p className="text-[14px]">Last ID check: {u.identity_error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <UserActions
                userId={u.id}
                name={u.full_name?.split(" ")[0] || "this person"}
                licenceVerified={u.driving_license_verified}
                identityVerified={u.identity_verified}
                suspended={!!u.suspended_at}
                cars={u.vehicles.filter((v) => v.status !== "suspended").length}
                self={u.id === me.id}
              />
              {email && (
                <Link href={`/host/admin/trips?q=${encodeURIComponent(email)}`} className="text-[14px] font-bold hover:text-cobalt">
                  Their trips
                </Link>
              )}
            </div>
          </Tile>
        );
      })}
    </div>
  );
}
