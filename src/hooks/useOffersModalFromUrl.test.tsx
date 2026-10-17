import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/abonnement-enseignant",
}));

import { useOffersModalFromUrl } from "@/hooks/useOffersModalFromUrl";

function Probe({ upgrade }: { upgrade: boolean }) {
  const [open, setOpen] = useOffersModalFromUrl(upgrade);
  return (
    <div>
      <span>{open ? "offres ouvertes" : "offres fermées"}</span>
      <button type="button" onClick={() => setOpen(false)}>
        Fermer
      </button>
    </div>
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", "/dashboard/abonnement-enseignant?upgrade=1");
});

describe("useOffersModalFromUrl", () => {
  it("ouvre les offres à l'arrivée avec ?upgrade=1 et retire le paramètre via le routeur", () => {
    render(<Probe upgrade />);
    expect(screen.getByText("offres ouvertes")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/dashboard/abonnement-enseignant", { scroll: false });
  });

  it("rouvre les offres à chaque clic sur « Mettre à niveau », sans recharger la page", () => {
    // La page reste montée : seul le paramètre d'URL change (true → false après nettoyage → true au clic).
    const { rerender } = render(<Probe upgrade />);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    rerender(<Probe upgrade={false} />);
    expect(screen.getByText("offres fermées")).toBeInTheDocument();

    rerender(<Probe upgrade />);
    expect(screen.getByText("offres ouvertes")).toBeInTheDocument();
  });

  it("conserve les autres paramètres (retour de paiement Stripe)", () => {
    window.history.replaceState(null, "", "/dashboard/abonnement-enseignant?upgrade=1&checkout=cancel");
    render(<Probe upgrade />);
    expect(replace).toHaveBeenLastCalledWith("/dashboard/abonnement-enseignant?checkout=cancel", { scroll: false });
  });

  it("ne fait rien sans ?upgrade=1", () => {
    render(<Probe upgrade={false} />);
    expect(screen.getByText("offres fermées")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
