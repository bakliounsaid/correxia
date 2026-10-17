import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  backendFetch: vi.fn(),
  swal: vi.fn(),
  downloadAnswerSheetsPdf: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sweetalert2", () => ({ default: { fire: mocks.swal } }));
vi.mock("@/lib/backend", () => ({ backendFetch: mocks.backendFetch }));
vi.mock("@/lib/evaluation-pdf", () => ({
  downloadAnswerSheetsPdf: mocks.downloadAnswerSheetsPdf,
  downloadCorrectionTemplatePdf: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock("@/lib/qr-scan", () => ({ decodeQrFromImageFile: vi.fn() }));

import { StartTestButton } from "@/components/dashboard/StartTestButton";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const baseProps = {
  evaluationId: "ev1",
  status: "created",
  hasCorrectionFile: true,
  copyCount: 0,
  hasDepositedCopy: false,
  evaluationTitle: "Dérivées",
  classLabel: "TS1",
};

beforeEach(() => {
  mocks.swal.mockResolvedValue({ isConfirmed: true });
});

describe("StartTestButton — boutons selon l'état", () => {
  it("évaluation créée sans copie : on peut commencer l'examen", () => {
    render(<StartTestButton {...baseProps} />);
    expect(screen.getByRole("button", { name: /Commencer l'examen/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Déposer feuilles/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lancer la correction/ })).not.toBeInTheDocument();
  });

  it("examen en cours avec scans : dépôt et correction proposés", () => {
    render(<StartTestButton {...baseProps} status="in_progress" copyCount={2} hasDepositedCopy />);
    expect(screen.queryByRole("button", { name: /Commencer l'examen/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Déposer feuilles/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lancer la correction/ })).toBeInTheDocument();
  });

  it("toutes les copies validées : plus de correction à lancer", () => {
    render(
      <StartTestButton {...baseProps} status="in_progress" copyCount={2} hasDepositedCopy allDepositedCopiesValidated />,
    );
    expect(screen.queryByRole("button", { name: /Lancer la correction/ })).not.toBeInTheDocument();
  });

  it("évaluation terminée : la correction type n'est plus modifiable", () => {
    render(<StartTestButton {...baseProps} status="completed" copyCount={2} />);
    expect(screen.getByRole("button", { name: /Remplacer correction type/ })).toBeDisabled();
  });
});

describe("StartTestButton — actions", () => {
  it("lance l'examen pour les élèves sélectionnés et télécharge les feuilles", async () => {
    const user = userEvent.setup();
    mocks.backendFetch
      .mockResolvedValueOnce(json({ ok: true, students: [{ id: "s1", first_name: "Ada", last_name: "L", class_name: "TS1" }] }))
      .mockResolvedValueOnce(
        json({ ok: true, created: 1, already_exists: 0, test: { title: "T" }, copies: [{ unique_test_id: "CX-1" }] }),
      );
    render(<StartTestButton {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Commencer l'examen/ }));
    await user.click(await screen.findByRole("button", { name: "Télécharger les feuilles de réponses" }));

    await waitFor(() => expect(mocks.downloadAnswerSheetsPdf).toHaveBeenCalledOnce());
    expect(mocks.backendFetch).toHaveBeenLastCalledWith("/evaluations/ev1/start", {
      method: "POST",
      body: JSON.stringify({ studentIds: ["s1"] }),
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("affiche l'erreur de quota renvoyée par la correction IA", async () => {
    const user = userEvent.setup();
    mocks.backendFetch.mockResolvedValueOnce(json({ error: "Quota atteint : 40/40 copies" }, 402));
    render(<StartTestButton {...baseProps} status="in_progress" copyCount={1} hasDepositedCopy />);

    await user.click(screen.getByRole("button", { name: /Lancer la correction/ }));

    await waitFor(() =>
      expect(mocks.swal).toHaveBeenCalledWith(expect.objectContaining({ icon: "error", text: "Quota atteint : 40/40 copies" })),
    );
  });

  it("signale une correction partielle", async () => {
    const user = userEvent.setup();
    mocks.backendFetch.mockResolvedValueOnce(json({ ok: true, corrected: 1, total: 2, failures: ["Copie 1: PDF"] }));
    render(<StartTestButton {...baseProps} status="in_progress" copyCount={2} hasDepositedCopy />);

    await user.click(screen.getByRole("button", { name: /Lancer la correction/ }));

    await waitFor(() =>
      expect(mocks.swal).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "warning", title: "Correction partielle", text: "1/2 copie(s) corrigée(s). Erreurs: Copie 1: PDF" }),
      ),
    );
  });
});
