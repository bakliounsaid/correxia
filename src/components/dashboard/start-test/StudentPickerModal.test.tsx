import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudentPickerModal } from "@/components/dashboard/start-test/StudentPickerModal";

const students = [
  { id: "s1", first_name: "Ada", last_name: "Lovelace", class_name: "TS1" },
  { id: "s2", first_name: "Alan", last_name: "Turing", class_name: "TS1" },
];

function renderModal(overrides: Partial<Parameters<typeof StudentPickerModal>[0]> = {}) {
  const props = {
    students,
    selectedIds: ["s1"],
    loading: false,
    submitting: false,
    onToggle: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<StudentPickerModal {...props} />);
  return props;
}

describe("StudentPickerModal", () => {
  it("affiche les élèves, leur sélection et le compteur", () => {
    renderModal();
    expect(screen.getByRole("checkbox", { name: "Lovelace Ada" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Turing Alan" })).not.toBeChecked();
    expect(screen.getByText("1 élève(s) sélectionné(s)")).toBeInTheDocument();
  });

  it("transmet les actions", async () => {
    const user = userEvent.setup();
    const props = renderModal();
    await user.click(screen.getByRole("checkbox", { name: "Turing Alan" }));
    await user.click(screen.getByRole("button", { name: "Télécharger les feuilles de réponses" }));
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(props.onToggle).toHaveBeenCalledWith("s2");
    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it("bloque la génération sans élève ou pendant le chargement", () => {
    renderModal({ students: [] });
    expect(screen.getByText("Aucun élève disponible.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Télécharger les feuilles de réponses" })).toBeDisabled();
  });
});
