import { describe, expect, it } from "vitest";
import { isValidEmail, mapAuthError, mapUrlErrorParam, USER_MESSAGES } from "@/lib/user-messages";

describe("mapAuthError", () => {
  it.each([
    ["Invalid login credentials", "Email ou mot de passe incorrect."],
    ["User already registered", "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez le mot de passe."],
    ["Email not confirmed", "Confirmez d’abord votre email (lien reçu par message)."],
    ["Password should be at least 6 characters", USER_MESSAGES.passwordMinLength],
  ])("%s", (message, expected) => {
    expect(mapAuthError(message)).toBe(expected);
  });

  it("traite le code HTTP 429 comme une limite de tentatives", () => {
    expect(mapAuthError("anything", 429)).toBe(USER_MESSAGES.authRateLimited);
  });

  it("laisse passer un message inconnu", () => {
    expect(mapAuthError("Something else")).toBe("Something else");
  });
});

describe("autres messages", () => {
  it("isValidEmail", () => {
    expect(isValidEmail(" prof@lycee.fr ")).toBe(true);
    expect(isValidEmail("prof@lycee")).toBe(false);
  });

  it("mapUrlErrorParam", () => {
    expect(mapUrlErrorParam(null)).toBeNull();
    expect(mapUrlErrorParam("auth_callback")).toContain("confirmation du lien");
    expect(mapUrlErrorParam("inconnu")).toContain("authentification");
  });
});
