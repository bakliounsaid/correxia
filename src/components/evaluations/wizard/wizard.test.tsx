import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepQuestions } from "@/components/evaluations/wizard/StepQuestions";
import { canGoNext, type EvaluationDraft } from "@/components/evaluations/wizard/types";

const draft = (overrides: Partial<EvaluationDraft> = {}): EvaluationDraft => ({
  title: "Dérivées",
  evaluationDate: "2026-10-17",
  className: "TS1",
  complexity: "moyen",
  durationMinutes: 60,
  courseFile: null,
  courseContext: "",
  questions: [{ id: "q1", text: "Q1", points: 20 }],
  ...overrides,
});

describe("canGoNext", () => {
  it("étape 1 : titre, classe et complexité obligatoires", () => {
    expect(canGoNext(0, draft())).toBe(true);
    expect(canGoNext(0, draft({ title: "  " }))).toBe(false);
    expect(canGoNext(0, draft({ className: "" }))).toBe(false);
    expect(canGoNext(0, draft({ complexity: "" }))).toBe(false);
  });

  it("étape 2 : un PDF ou une description du cours", () => {
    expect(canGoNext(1, draft())).toBe(false);
    expect(canGoNext(1, draft({ courseContext: "Chapitre 3" }))).toBe(true);
    expect(canGoNext(1, draft({ courseFile: new File(["%PDF"], "cours.pdf") }))).toBe(true);
  });

  it("étape 3 : chaque question a un énoncé et des points", () => {
    expect(canGoNext(2, draft())).toBe(true);
    expect(canGoNext(2, draft({ questions: [] }))).toBe(false);
    expect(canGoNext(2, draft({ questions: [{ id: "q", text: " ", points: 5 }] }))).toBe(false);
    expect(canGoNext(2, draft({ questions: [{ id: "q", text: "Q", points: 0 }] }))).toBe(false);
  });
});

describe("StepQuestions", () => {
  const questions = [
    { id: "q1", text: "Calculer f'(x)", points: 12 },
    { id: "q2", text: "Étudier les variations", points: 8 },
  ];

  it("affiche le total du barème", () => {
    render(<StepQuestions title="T" questions={questions} generating={false} onRegenerate={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText("20 / 20")).toBeInTheDocument();
  });

  it("modifie les points (minimum 1) et l'énoncé", () => {
    const onChange = vi.fn();
    render(<StepQuestions title="T" questions={questions} generating={false} onRegenerate={vi.fn()} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText("Points")[0], { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith([{ ...questions[0], points: 1 }, questions[1]]);
    fireEvent.change(screen.getByLabelText("Énoncé de l'exercice 2"), { target: { value: "Nouveau" } });
    expect(onChange).toHaveBeenLastCalledWith([questions[0], { ...questions[1], text: "Nouveau" }]);
  });

  it("ajoute et supprime des exercices, sans pouvoir supprimer le dernier", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <StepQuestions title="T" questions={questions} generating={false} onRegenerate={vi.fn()} onChange={onChange} />,
    );
    await user.click(screen.getAllByRole("button", { name: /Supprimer/ })[0]);
    expect(onChange).toHaveBeenLastCalledWith([questions[1]]);
    await user.click(screen.getByRole("button", { name: /Ajouter une question/ }));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(3);

    rerender(
      <StepQuestions title="T" questions={[questions[0]]} generating={false} onRegenerate={vi.fn()} onChange={onChange} />,
    );
    expect(screen.getByRole("button", { name: /Supprimer/ })).toBeDisabled();
  });
});
