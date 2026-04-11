import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { TeacherCheckoutPlan } from "@/lib/teacher-billing-plans";

function priceIdForPlan(plan: TeacherCheckoutPlan): string | undefined {
  if (plan === "advanced") return process.env.STRIPE_PRICE_ADVANCED_QUARTERLY;
  if (plan === "mastery") return process.env.STRIPE_PRICE_MASTERY_QUARTERLY;
  return undefined;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Le paiement en ligne n’est pas configuré (STRIPE_SECRET_KEY manquant)." },
      { status: 503 },
    );
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const plan = body.plan as TeacherCheckoutPlan | undefined;
  if (plan !== "advanced" && plan !== "mastery") {
    return NextResponse.json(
      { error: "Plan invalide : choisissez « advanced » ou « mastery »." },
      { status: 400 },
    );
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          plan === "advanced"
            ? "STRIPE_PRICE_ADVANCED_QUARTERLY manquant côté serveur."
            : "STRIPE_PRICE_MASTERY_QUARTERLY manquant côté serveur.",
      },
      { status: 503 },
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

  if (profile?.role !== "teacher") {
    return NextResponse.json(
      { error: "Réservé aux comptes enseignant." },
      { status: 403 },
    );
  }

  const { data: teacher, error: teacherErr } = await supabase
    .from("teachers")
    .select("id, is_independent, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherErr || !teacher?.id) {
    return NextResponse.json(
      { error: "Profil enseignant introuvable. Contactez le support." },
      { status: 400 },
    );
  }

  if (teacher.is_independent !== true) {
    return NextResponse.json(
      {
        error:
          "L’abonnement individuel concerne les enseignants en compte libre. Votre établissement gère l’offre collective.",
      },
      { status: 403 },
    );
  }

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const base = origin.replace(/\/$/, "");
  const stripe = new Stripe(secret);

  try {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard/abonnement-enseignant?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/abonnement-enseignant?checkout=cancel`,
      metadata: {
        user_id: user.id,
        teacher_id: teacher.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          teacher_id: teacher.id,
          plan,
        },
      },
    };

    const cust = teacher.stripe_customer_id as string | null | undefined;
    if (cust) {
      params.customer = cust;
    } else {
      params.customer_email = user.email ?? undefined;
    }

    const session = await stripe.checkout.sessions.create(params);

    if (!session.url) {
      return NextResponse.json({ error: "Stripe n’a pas renvoyé d’URL de paiement." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur Stripe";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
