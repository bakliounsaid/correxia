import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const stripe = new Stripe(secret);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch {
    return NextResponse.json({ error: "Session de paiement introuvable" }, { status: 400 });
  }

  if (session.status !== "complete") {
    return NextResponse.json({ error: "Paiement non finalisé" }, { status: 400 });
  }

  const schoolId = session.metadata?.school_id;
  const plan = session.metadata?.plan;
  if (!schoolId || plan !== "establishment") {
    return NextResponse.json({ error: "Métadonnées de session invalides" }, { status: 400 });
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const sub = session.subscription;
  const subscriptionId =
    typeof sub === "string" ? sub : sub && typeof sub === "object" && "id" in sub ? sub.id : null;

  const { error } = await supabase
    .from("schools")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_plan: "establishment",
      subscription_status: "active",
      subscription_start_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", schoolId)
    .eq("admin_user_id", user.id);

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message +
          " — Si le paiement a réussi, contactez le support : les règles Supabase peuvent bloquer la mise à jour.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
