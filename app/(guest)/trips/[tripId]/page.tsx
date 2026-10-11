import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar, MessageCircle, Phone } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { TripWithDetails } from "@/types";

export const instant = false;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending confirmation",
  approved: "Confirmed",
  active: "In progress",
  completed: "Completed",
  cancelled_guest: "Cancelled",
  cancelled_host: "Cancelled by host",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-summit-500/10 text-summit-500 border-summit-500/30",
  approved: "bg-cascade-500/10 text-cascade-700 border-cascade-300",
  active: "bg-alpine-500/10 text-alpine-500 border-alpine-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled_guest: "bg-ember-500/10 text-ember-500 border-ember-500/30",
  cancelled_host: "bg-ember-500/10 text-ember-500 border-ember-500/30",
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select(
      "*, vehicles(*, vehicle_images(*)), guest:profiles!guest_id(id, full_name, avatar_url), host:profiles!host_id(id, full_name, avatar_url, phone)"
    )
    .eq("id", tripId)
    .eq("guest_id", user.id)
    .single();

  if (!trip) notFound();

  const t = trip as any;
  const cover =
    t.vehicles?.vehicle_images?.find((i: any) => i.is_cover)?.url ??
    t.vehicles?.vehicle_images?.[0]?.url;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/trips"
          className="text-sm text-cascade-700 font-medium hover:underline"
        >
          ← Back to trips
        </Link>
        <Badge
          className={`text-xs border ${STATUS_COLORS[t.status]}`}
          variant="outline"
        >
          {STATUS_LABELS[t.status] ?? t.status}
        </Badge>
      </div>

      {/* Vehicle */}
      <div className="border border-border rounded-2xl overflow-hidden bg-white">
        {cover && (
          <div className="relative h-48">
            <Image src={cover} alt="Vehicle" fill className="object-cover" sizes="100vw" />
          </div>
        )}
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-bold text-cascade-900">
            {t.vehicles?.make} {t.vehicles?.model} {t.vehicles?.year}
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cascade-500 shrink-0" />
              <span>
                {formatDate(t.starts_at)} – {formatDate(t.ends_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cascade-500 shrink-0" />
              <span>{t.pickup_location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Host */}
      <div className="border border-border rounded-2xl p-5 bg-white">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Your host
        </h3>
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={t.host?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-cascade-100 text-cascade-700 font-semibold">
              {t.host?.full_name?.[0]?.toUpperCase() ?? "H"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-cascade-900">{t.host?.full_name}</p>
          </div>
          <Button size="sm" variant="outline" asChild className="gap-2">
            <Link href={`/messages?host=${t.host?.id}`}>
              <MessageCircle className="w-3.5 h-3.5" />
              Message
            </Link>
          </Button>
        </div>
      </div>

      {/* Pricing */}
      <div className="border border-border rounded-2xl p-5 bg-white space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Price details
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Daily rate</span>
            <span>{formatCurrency(t.daily_rate_cents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(t.subtotal_cents)}</span>
          </div>
          {t.protection_cost_cents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protection ({t.protection_plan})</span>
              <span>{formatCurrency(t.protection_cost_cents)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxes</span>
            <span>{formatCurrency(t.tax_cents)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-cascade-900">
            <span>Total</span>
            <span>{formatCurrency(t.total_cents)}</span>
          </div>
        </div>
      </div>

      {/* Cancel button */}
      {["pending", "approved"].includes(t.status) && (
        <Button variant="outline" className="w-full text-ember-500 border-ember-500/30 hover:bg-ember-500/10">
          Cancel trip
        </Button>
      )}
    </div>
  );
}
