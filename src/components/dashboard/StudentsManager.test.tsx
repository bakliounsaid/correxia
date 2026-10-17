import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  swal: vi.fn(),
  insertStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
  fetchStudentsOfClasses: vi.fn(),
  fetchTeacherClassIds: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sweetalert2", () => ({ default: { fire: mocks.swal } }));
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => ({}) }));
vi.mock("@/lib/students-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/students-data")>()),
  insertStudent: mocks.insertStudent,
  updateStudent: mocks.updateStudent,
  deleteStudent: mocks.deleteStudent,
  fetchStudentsOfClasses: mocks.fetchStudentsOfClasses,
  fetchTeacherClassIds: mocks.fetchTeacherClassIds,
}));
vi.mock("@/components/ui/ListExportButton", () => ({ ListExportButton: () => null }));

import { StudentsManager } from "@/components/dashboard/StudentsManager";

const ada = {
  id: "s1",
  first_name: "Ada",
  last_name: "Lovelace",
  id_interne: "A-1",
  class_id: "c1",
  class_name: "TS1",
  created_at: "2026-01-01T00:00:00Z",
};
const baseProps = {
  initialStudents: [ada],
  classOptions: [{ id: "c1", name: "TS1" }],
  viewerTeacherId: "t1",
  insertSchoolId: null,
  isSchoolAdmin: false,
  canManage: true,
};

beforeEach(() => {
  mocks.swal.mockResolvedValue({ isConfirmed: true });
  mocks.fetchTeacherClassIds.mockResolvedValue(["c1"]);
  mocks.fetchStudentsOfClasses.mockResolvedValue([ada]);
  mocks.insertStudent.mockResolvedValue(undefined);
  mocks.deleteStudent.mockResolvedValue(undefined);
});

describe("StudentsManager — droits", () => {
  it("enseignant d'établissement : lecture seule", () => {
    render(<StudentsManager {...baseProps} canManage={false} />);
    expect(screen.getByText("Vos classes et vos élèves sont gérés par votre établissement.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter un élève/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Modifier Lovelace Ada/ })).not.toBeInTheDocument();
  });

  it("sans classe : ajout et import désactivés", () => {
    render(<StudentsManager {...baseProps} classOptions={[]} />);
    expect(screen.getByRole("button", { name: /Ajouter un élève/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Importer CSV/ })).toBeDisabled();
  });
});

describe("StudentsManager — actions", () => {
  it("ajoute un élève puis recharge la liste", async () => {
    const user = userEvent.setup();
    render(<StudentsManager {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Ajouter un élève/ }));
    await user.type(screen.getByLabelText("Prénom *"), " Alan ");
    await user.type(screen.getByLabelText("Nom *"), "Turing");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(mocks.insertStudent).toHaveBeenCalledWith({}, null, {
        first_name: "Alan",
        last_name: "Turing",
        class_id: "c1",
        id_interne: "",
      }),
    );
    expect(mocks.fetchStudentsOfClasses).toHaveBeenCalledWith({}, ["c1"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("préremplit la fiche pour une modification", async () => {
    const user = userEvent.setup();
    render(<StudentsManager {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Modifier Lovelace Ada" }));
    expect(screen.getByRole("dialog", { name: "Modifier l’élève" })).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom *")).toHaveValue("Ada");
    expect(screen.getByLabelText("ID interne (optionnel)")).toHaveValue("A-1");
  });

  it("supprime après confirmation, rien sans confirmation", async () => {
    const user = userEvent.setup();
    render(<StudentsManager {...baseProps} />);

    mocks.swal.mockResolvedValueOnce({ isConfirmed: false });
    await user.click(screen.getByRole("button", { name: "Supprimer Lovelace Ada" }));
    expect(mocks.deleteStudent).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Supprimer Lovelace Ada" }));
    await waitFor(() => expect(mocks.deleteStudent).toHaveBeenCalledWith({}, "s1"));
  });

  it("affiche l'erreur d'enregistrement", async () => {
    const user = userEvent.setup();
    mocks.insertStudent.mockRejectedValueOnce(new Error("duplicate key value"));
    render(<StudentsManager {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Ajouter un élève/ }));
    await user.type(screen.getByLabelText("Prénom *"), "A");
    await user.type(screen.getByLabelText("Nom *"), "B");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(mocks.swal).toHaveBeenCalledWith(expect.objectContaining({ icon: "error", text: "duplicate key value" })),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
