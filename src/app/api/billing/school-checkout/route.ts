import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ESTABLISHMENT_QUARTERLY;
  if (!secret || !priceId) {
    return NextResponse.json(
      {
        error:
          "Le paiement en ligne n’est pas configuré (STRIPE_SECRET_KEY ou STRIPE_PRICE_ESTABLISHMENT_QUARTERLY manquant).",
      },
      { status: 503 },
    );
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (body.plan !== "establishment") {
    return NextResponse.json(
      { error: "Seul le pack Établissement peut être réglé en ligne pour le moment." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "school_admin") {
    return NextResponse.json({ error: "Accès réservé à l’administrateur établissement" }, { status: 403 });
  }

  const { data: school, error: schoolErr } = await supabase
    .from("schools")
    .select("id, email")
    .eq("admin_user_id", user.id)
    .maybeSingle();

  if (schoolErr || !school?.id) {
    return NextResponse.json(
      { error: "Aucun établissement n’est lié à votre compte." },
      { status: 400 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, "")}/dashboard/abonnement?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.replace(/\/$/, "")}/dashboard/abonnement?checkout=cancel`,
      customer_email: (school.email as string | null) ?? user.email ?? undefined,
      metadata: {
        user_id: user.id,
        school_id: school.id,
        plan: "establishment",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          school_id: school.id,
          plan: "establishment",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe n’a pas renvoyé d’URL de paiement." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur Stripe";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
