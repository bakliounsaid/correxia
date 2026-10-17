import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendFetch: vi.fn(), swal: vi.fn() }));
vi.mock("@/lib/backend", () => ({ backendFetch: mocks.backendFetch }));
vi.mock("sweetalert2", () => ({ default: { fire: mocks.swal } }));

import plansJson from "../../../backend/app/plans.json";
import { PricingSection } from "@/components/landing/PricingSection";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let location: { href: string };

beforeEach(() => {
  location = { href: "http://localhost/" };
  vi.stubGlobal("location", location);
  Object.defineProperty(window, "location", { value: location, configurable: true });
});

describe("PricingSection", () => {
  it("affiche les prix de plans.json", () => {
    render(<PricingSection />);
    expect(screen.getByText(plansJson.teacher.advanced.name)).toBeInTheDocument();
    expect(screen.getByText(`${plansJson.teacher.advanced.price_cents / 100}€`)).toBeInTheDocument();
  });

  it("lance le paiement via l'API FastAPI et redirige vers Stripe", async () => {
    const user = userEvent.setup();
    mocks.backendFetch.mockResolvedValueOnce(json({ url: "https://checkout.stripe.test/s1" }));
    render(<PricingSection />);

    await user.click(screen.getByRole("button", { name: "Choisir Avancé" }));

    await waitFor(() => expect(location.href).toBe("https://checkout.stripe.test/s1"));
    expect(mocks.backendFetch).toHaveBeenCalledWith("/billing/teacher-checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "advanced" }),
    });
  });

  it("envoie vers l'inscription un visiteur non connecté", async () => {
    const user = userEvent.setup();
    mocks.backendFetch.mockResolvedValueOnce(json({ error: "Non authentifié." }, 401));
    render(<PricingSection />);

    await user.click(screen.getByRole("button", { name: "Choisir Maîtrise" }));

    await waitFor(() => expect(location.href).toBe("/register"));
  });
});
