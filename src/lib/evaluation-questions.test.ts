import { describe, expect, it } from "vitest";
import {
  distributePointsToTotal,
  estimateAnswerBoxHeight,
  estimateQuestionRows,
  safeFileSlug,
  toPrintableQuestions,
  toStoredQuestions,
  totalPoints,
} from "@/lib/evaluation-questions";

describe("distributePointsToTotal", () => {
  it.each([
    [3, 20, [7, 7, 6]],
    [4, 20, [5, 5, 5, 5]],
    [1, 20, [20]],
    [0, 20, []],
  ])("%i exercices sur %i points", (count, total, expected) => {
    const points = distributePointsToTotal(count, total);
    expect(points).toEqual(expected);
    if (count > 0) expect(points.reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe("toPrintableQuestions", () => {
  it("normalise les questions stockées", () => {
    expect(toPrintableQuestions([{ title: "Ex A", text: "Calculer", points: 5 }, { text: "Démontrer" }])).toEqual([
      { label: "Ex A", text: "Calculer", points: 5 },
      { label: "Exercice 2", text: "Démontrer", points: 0 },
    ]);
  });

  it("produit un exercice vide si le sujet n'a pas de questions", () => {
    expect(toPrintableQuestions(null)).toEqual([{ label: "Exercice 1", text: "", points: 0 }]);
    expect(toPrintableQuestions([])).toHaveLength(1);
  });
});

describe("toStoredQuestions", () => {
  it("construit questions, barème et total cohérents", () => {
    const stored = toStoredQuestions([
      { id: "a", text: "Q1", points: 12 },
      { id: "b", text: "Q2", points: 8 },
    ]);
    expect(stored.totalPoints).toBe(20);
    expect(stored.questions[1]).toEqual({
      id: "exo-2",
      type: "open_question",
      title: "Exercice 2",
      text: "Q2",
      points: 8,
    });
    expect(stored.rubric).toEqual([
      { id: "exo-1", label: "Exercice 1", points: 12 },
      { id: "exo-2", label: "Exercice 2", points: 8 },
    ]);
  });
});

describe("tailles d'affichage", () => {
  it("bornent le nombre de lignes et la hauteur de la zone de réponse", () => {
    expect(estimateQuestionRows("")).toBe(4);
    expect(estimateQuestionRows("x".repeat(5000))).toBe(16);
    expect(estimateAnswerBoxHeight("")).toBe(144);
    expect(estimateAnswerBoxHeight("x".repeat(5000))).toBe(288);
  });
});

describe("divers", () => {
  it("totalPoints et safeFileSlug", () => {
    expect(totalPoints([{ points: 2 }, { points: 3.5 }])).toBe(5.5);
    expect(safeFileSlug("Dérivées & limites", "evaluation")).toBe("D-riv-es---limites");
    expect(safeFileSlug("", "evaluation")).toBe("evaluation");
  });
});
