import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { cardHeldBy, customerOf, listCards, ownedCard } from "@/lib/cards";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in person's saved cards. */
export async function GET() {
  const user = await signedIn();
  if (!user) return fail("Log in to see your cards.", 401);

  try {
    const cards = await listCards(await customerOf(user.id));
    return NextResponse.json({ cards }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[account] cards failed", user.id, err);
    return fail("Couldn't load your cards. Try again.", 500);
  }
}

/** Removes a saved card (?id=pm_...), unless a trip still depends on it. */
export async function DELETE(req: Request) {
  const user = await signedIn();
  if (!user) return fail("Log in to remove a card.", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Pick a card to remove.", 400);

  try {
    const card = await ownedCard(await customerOf(user.id), id);
    if (!card) return fail("We couldn't find that card.", 404);

    const held = await cardHeldBy(user.id, card.id);
    if (held) return fail(held, 409);

    await stripe.paymentMethods.detach(card.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account] card removal failed", user.id, err);
    return fail("Couldn't remove that card. Try again.", 500);
  }
}
