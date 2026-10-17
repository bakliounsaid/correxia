import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  backendFetch: vi.fn(),
  swal: vi.fn(),
  upload: vi.fn(),
  getCurrentTeacher: vi.fn(),
  buildSubjectPdfBlob: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("sweetalert2", () => ({ default: { fire: mocks.swal } }));
vi.mock("@/lib/backend", () => ({ backendFetch: mocks.backendFetch }));
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => ({}) }));
vi.mock("@/lib/evaluation-pdf", () => ({ buildSubjectPdfBlob: mocks.buildSubjectPdfBlob }));
vi.mock("@/lib/storage-upload", () => ({
  getCurrentTeacher: mocks.getCurrentTeacher,
  uploadToTestsBucket: mocks.upload,
}));
vi.mock("@/hooks/useEvaluationClassOptions", () => ({
  useEvaluationClassOptions: () => ({ schoolName: "Lycée Test", classOptions: ["TS1", "TS2"], loading: false }),
}));

import NewEvaluationPage from "@/app/dashboard/evaluations/new/page";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  mocks.swal.mockResolvedValue({ isConfirmed: true });
  mocks.upload.mockResolvedValue("https://cdn.test/t1/sujet.pdf");
  mocks.getCurrentTeacher.mockResolvedValue({ id: "t1", school_id: null });
  mocks.buildSubjectPdfBlob.mockResolvedValue(new Blob(["%PDF"]));
});

async function fillInfoAndCourse(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Titre *"), "Dérivées");
  await user.selectOptions(screen.getByLabelText("Classe *"), "TS2");
  await user.selectOptions(screen.getByLabelText("Degré de complexité *"), "moyen");
  await user.click(screen.getByRole("button", { name: /Suivant/ }));
  fireEvent.change(screen.getByPlaceholderText("Description du cours (optionnel)"), {
    target: { value: "Cours sur les dérivées" },
  });
}

describe("Création d'évaluation", () => {
  it("bloque l'étape 1 tant qu'elle est incomplète", async () => {
    render(<NewEvaluationPage />);
    expect(screen.getByRole("button", { name: /Suivant/ })).toBeDisabled();
  });

  it("génère le sujet puis enregistre l'évaluation via l'API", async () => {
    const user = userEvent.setup();
    mocks.backendFetch
      .mockResolvedValueOnce(json({ ok: true, questions: ["Calculer f'(x)", "Étudier f"] }))
      .mockResolvedValueOnce(json({ ok: true, evaluation: { id: "ev1" } }));
    render(<NewEvaluationPage />);

    await fillInfoAndCourse(user);
    await user.click(screen.getByRole("button", { name: /Suivant/ }));

    expect(await screen.findByDisplayValue("Calculer f'(x)")).toBeInTheDocument();
    expect(screen.getByText("20 / 20")).toBeInTheDocument();
    const generateCall = JSON.parse(mocks.backendFetch.mock.calls[0][1].body);
    expect(generateCall).toMatchObject({ title: "Dérivées", className: "TS2", complexity: "moyen" });

    await user.click(screen.getByRole("button", { name: /Suivant/ }));
    await user.click(screen.getByRole("button", { name: /Valider l'évaluation/ }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/evaluations"));
    const [path, init] = mocks.backendFetch.mock.calls[1];
    expect(path).toBe("/evaluations");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      title: "Dérivées",
      class_name: "TS2",
      duration_minutes: 60,
      subject_file_url: "https://cdn.test/t1/sujet.pdf",
    });
    expect(body.rubric).toEqual([
      { id: "exo-1", label: "Exercice 1", points: 10 },
      { id: "exo-2", label: "Exercice 2", points: 10 },
    ]);
  });

  it("reste sur l'étape du cours si la génération échoue", async () => {
    const user = userEvent.setup();
    mocks.backendFetch.mockResolvedValueOnce(json({ error: "Service IA injoignable." }, 502));
    render(<NewEvaluationPage />);

    await fillInfoAndCourse(user);
    await user.click(screen.getByRole("button", { name: /Suivant/ }));

    await waitFor(() =>
      expect(mocks.swal).toHaveBeenCalledWith(expect.objectContaining({ icon: "error", text: "Service IA injoignable." })),
    );
    expect(screen.getByPlaceholderText("Description du cours (optionnel)")).toBeInTheDocument();
  });
});
