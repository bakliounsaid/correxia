import { describe, expect, it } from "vitest";
import plansJson from "../../backend/app/plans.json";
import { formatPrice, PLAN_TEXT } from "@/lib/plans";
import { SCHOOL_OFFERS } from "@/lib/school-billing-plans";
import { TEACHER_OFFERS, teacherPlanLabel } from "@/lib/teacher-billing-plans";

describe("formatPrice", () => {
  it.each([
    [4500, "45€"],
    [0, "0€"],
    [1999, "19,99€"],
    [null, "Sur devis"],
  ])("%s → %s", (cents, expected) => {
    expect(formatPrice(cents)).toBe(expected);
  });
});

describe("offres affichées = plans.json (source unique avec l'API)", () => {
  it("prix et noms des packs enseignant", () => {
    for (const [id, plan] of Object.entries(plansJson.teacher)) {
      const offer = TEACHER_OFFERS.find((o) => o.id === id)!;
      expect(offer.name).toBe(plan.name);
      expect(offer.priceLabel).toBe(formatPrice(plan.price_cents));
    }
  });

  it("limites de copies et d'enseignants reprises telles quelles", () => {
    const essential = TEACHER_OFFERS.find((o) => o.id === "essential")!;
    expect(essential.features).toContain(`Jusqu’à ${plansJson.teacher.essential.copy_limit} copies`);
    expect(TEACHER_OFFERS.find((o) => o.id === "advanced")!.features).toContain(PLAN_TEXT.advancedCopies);
    expect(PLAN_TEXT.advancedCopies).toContain(String(plansJson.teacher.advanced.copy_limit));

    const establishment = SCHOOL_OFFERS.find((o) => o.id === "establishment")!;
    expect(establishment.priceLabel).toBe(formatPrice(plansJson.school.establishment.price_cents));
    expect(establishment.features).toContain(`Jusqu’à ${plansJson.school.establishment.max_teachers} enseignants`);
  });

  it("libellé de l'offre courante", () => {
    expect(teacherPlanLabel(null)).toBe(`${plansJson.teacher.essential.name} (gratuit)`);
    expect(teacherPlanLabel("advanced")).toBe(plansJson.teacher.advanced.name);
  });
});
