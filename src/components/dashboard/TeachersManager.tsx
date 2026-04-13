"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import { useRowSelection } from "@/hooks/useRowSelection";
import { omitId } from "@/lib/utils";

type TeacherRow = {
  id: string;
  full_name: string;
  email: string;
  subject: "math" | "physics" | "science";
  class_names: string[];
  created_at: string;
};

type ClassOption = { id: string; name: string };

type Props = {
  initialTeachers: TeacherRow[];
  classOptions: ClassOption[];
};

type FormErrors = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  classNames: string;
  password: string;
  confirmPassword: string;
}>;

const SUBJECT_OPTIONS = [
  { value: "math", label: "Mathématiques" },
  { value: "physics", label: "Physique-chimie" },
  { value: "science", label: "Sciences" },
] as const;

function subjectLabelFr(subject: string): string {
  return SUBJECT_OPTIONS.find((s) => s.value === subject)?.label ?? subject;
}

export function TeachersManager({ initialTeachers, classOptions }: Props) {
  const [rows, setRows] = useState(initialTeachers);
  const [pendingAction, setPendingAction] = useState<"none" | "save" | "delete">("none");
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [subject, setSubject] = useState<"" | "math" | "physics" | "science">("");
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>([]);
  const [selectedExistingClass, setSelectedExistingClass] = useState("");
  const [className, setClassName] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const sortedClasses = useMemo(
    () => [...classOptions].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [classOptions],
  );

  function resetForm() {
    setMode("add");
    setEditId(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setSubject("");
    setSelectedClassNames([]);
    setSelectedExistingClass("");
    setClassName("");
    setErrors({});
  }

  function openAdd() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(row: TeacherRow) {
    const parts = row.full_name.trim().split(/\s+/);
    setMode("edit");
    setEditId(row.id);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setEmail(row.email || "");
    setPassword("");
    setConfirmPassword("");
    setSubject(row.subject);
    setSelectedClassNames(row.class_names);
    setSelectedExistingClass(row.class_names[0] ?? "");
    setClassName("");
    setErrors({});
    setModalOpen(true);
  }

  function effectiveClassNames() {
    const merged = [...selectedClassNames];
    if (selectedExistingClass && !merged.includes(selectedExistingClass)) {
      merged.push(selectedExistingClass);
    }
    const custom = className
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const c of custom) {
      if (!merged.includes(c)) merged.push(c);
    }
    return merged;
  }

  function validateForm(): boolean {
    const next: FormErrors = {};
    if (!firstName.trim()) next.firstName = "Le prénom est obligatoire.";
    if (!lastName.trim()) next.lastName = "Le nom est obligatoire.";
    if (!email.trim()) next.email = "L'email est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Veuillez saisir une adresse email valide.";
    }
    if (!subject) {
      next.subject = "La matière est obligatoire.";
    }
    if (effectiveClassNames().length === 0) {
      next.classNames = "Au moins une classe est obligatoire.";
    }

    if (mode === "add") {
      if (!password) next.password = "Le mot de passe est obligatoire.";
      else if (password.length < 6) {
        next.password = "Le mot de passe doit contenir au moins 6 caractères.";
      }
      if (!confirmPassword) next.confirmPassword = "La confirmation est obligatoire.";
      else if (password !== confirmPassword) {
        next.confirmPassword = "La confirmation ne correspond pas au mot de passe.";
      }
    } else if (password || confirmPassword) {
      if (password.length < 6) {
        next.password = "Le mot de passe doit contenir au moins 6 caractères.";
      }
      if (password !== confirmPassword) {
        next.confirmPassword = "La confirmation ne correspond pas au mot de passe.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    const classNames = effectiveClassNames();
    setPendingAction("save");
    try {
      const endpoint =
        mode === "add"
          ? "/api/dashboard/school/teachers"
          : `/api/dashboard/school/teachers/${editId}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const payload =
        mode === "add"
          ? {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              password,
              subject: subject as "math" | "physics" | "science",
              classNames,
            }
          : {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              password: password.trim() || undefined,
              subject: subject as "math" | "physics" | "science",
              classNames,
            };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        teacher?: {
          id: string;
          full_name: string;
          email: string;
          subject: "math" | "physics" | "science";
        };
      };
      if (!res.ok || !data.ok || !data.teacher) {
        throw new Error(data.error ?? "Action impossible.");
      }
      const teacher = data.teacher;

      if (mode === "add") {
        setRows((prev) => [
          {
            id: teacher.id,
            full_name: teacher.full_name,
            email: teacher.email,
            subject: teacher.subject,
            class_names: classNames,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === teacher.id
              ? {
                  ...r,
                  full_name: teacher.full_name,
                  email: teacher.email,
                  subject: teacher.subject,
                  class_names: classNames,
                }
              : r,
          ),
        );
      }

      resetForm();
      setModalOpen(false);
      await Swal.fire({
        icon: "success",
        title: mode === "add" ? "Enseignant créé" : "Enseignant modifié",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Action impossible.",
      });
    } finally {
      setPendingAction("none");
    }
  }

  async function onDelete(row: TeacherRow) {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Retirer cet enseignant de l'établissement ?",
      text: row.full_name,
      showCancelButton: true,
      confirmButtonText: "Oui, retirer",
      cancelButtonText: "Annuler",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    setPendingAction("delete");
    setPendingRowId(row.id);
    try {
      const res = await fetch(`/api/dashboard/school/teachers/${row.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Suppression impossible.");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      await Swal.fire({
        icon: "success",
        title: "Enseignant retiré",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Suppression impossible.",
      });
    } finally {
      setPendingAction("none");
      setPendingRowId(null);
    }
  }

  const isAnyPending = pendingAction !== "none";

  const teacherExportColumns = useMemo(
    () => [
      { key: "nom", header: "Nom" },
      { key: "email", header: "Email" },
      { key: "classes", header: "Classes" },
      { key: "matiere", header: "Matière" },
      { key: "date_ajout", header: "Date d'ajout" },
    ],
    [],
  );

  const rowIds = useMemo(() => rows.map((t) => t.id), [rows]);
  const {
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    isSelected,
    getExportRows,
    selectedCount,
  } = useRowSelection(rowIds);

  const teacherExportRowsWithId = useMemo(
    () =>
      rows.map((t) => ({
        id: t.id,
        nom: t.full_name,
        email: t.email,
        classes: t.class_names.join(", "),
        matiere: subjectLabelFr(t.subject),
        date_ajout: new Date(t.created_at).toLocaleDateString("fr-FR"),
      })),
    [rows],
  );

  const teacherExportRows = useMemo(() => {
    const picked = getExportRows(teacherExportRowsWithId, "id");
    return picked.map((r) => omitId(r as Record<string, unknown>));
  }, [getExportRows, teacherExportRowsWithId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-start gap-2">
        <Button type="button" variant="primary" className="gap-2" onClick={openAdd} disabled={isAnyPending}>
          <Plus className="h-4 w-4" />
          Ajouter un enseignant
        </Button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-gray-600">
            {selectedCount > 0
              ? `${selectedCount} sélectionné(s) · export ciblé`
              : `Export de tous (${rows.length})`}
          </span>
          <ListExportButton
            fileBaseName="enseignants-etablissement"
            sheetName="Enseignants"
            columns={teacherExportColumns}
            rows={teacherExportRows}
            disabled={isAnyPending || rows.length === 0}
          />
        </div>
      </div>

      {rows.length === 0 ? null : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="w-11 px-3 py-3 text-center">
                    <TableSelectCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                      ariaLabel="Tout sélectionner"
                      disabled={isAnyPending || rows.length === 0}
                    />
                  </th>
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Classes</th>
                  <th className="px-6 py-3">Matière</th>
                  <th className="px-6 py-3">Date d&apos;ajout</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="w-11 px-3 py-4 align-middle">
                      <div className="flex justify-center">
                        <TableSelectCheckbox
                          checked={isSelected(t.id)}
                          onChange={() => toggleOne(t.id)}
                          ariaLabel={`Sélectionner ${t.full_name}`}
                          disabled={isAnyPending}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{t.full_name}</td>
                    <td className="px-6 py-4 text-gray-600">{t.email}</td>
                    <td className="px-6 py-4 text-gray-600">{t.class_names.join(", ") || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">{subjectLabelFr(t.subject)}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(t.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Modifier"
                          disabled={isAnyPending}
                          onClick={() => openEdit(t)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600 disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={isAnyPending}
                          onClick={() => void onDelete(t)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          {pendingAction === "delete" && pendingRowId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900">
              {mode === "add" ? "Créer un compte enseignant" : "Modifier un enseignant"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              {(errors.firstName || errors.lastName) && (
                <p className="text-xs text-error-600">{errors.firstName || errors.lastName}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value as "" | "math" | "physics" | "science")
                  }
                >
                  <option value="">Sélectionner la matière</option>
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <input type="email" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" placeholder="email@lycee.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {errors.subject ? <p className="text-xs text-error-600">{errors.subject}</p> : null}
              {errors.email ? <p className="text-xs text-error-600">{errors.email}</p> : null}
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-700">Classes (obligatoire)</p>
                {sortedClasses.length > 0 && (
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                    value={selectedExistingClass}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedExistingClass(v);
                      setSelectedClassNames(v ? [v] : []);
                    }}
                  >
                    <option value="">Sélectionner la classe</option>
                    {sortedClasses.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  placeholder={
                    sortedClasses.length
                      ? "Choisir une classe existante ou saisir une nouvelle"
                      : "Nouvelle classe (ex. 2nde3)"
                  }
                  value={className}
                  onChange={(e) => {
                    setClassName(e.target.value);
                    setErrors((p) => ({ ...p, classNames: undefined }));
                  }}
                />
                {errors.classNames ? <p className="mt-1 text-xs text-error-600">{errors.classNames}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" placeholder={mode === "add" ? "Mot de passe (min 6)" : "Nouveau mot de passe (optionnel)"} value={password} onChange={(e) => setPassword(e.target.value)} />
                <input type="password" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" placeholder={mode === "add" ? "Confirmer le mot de passe" : "Confirmer (si mot de passe modifié)"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              {(errors.password || errors.confirmPassword) && (
                <p className="text-xs text-error-600">{errors.password || errors.confirmPassword}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" disabled={isAnyPending} onClick={() => { setModalOpen(false); resetForm(); }}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={pendingAction === "save"}
                  loadingText={mode === "add" ? "Création..." : "Mise à jour..."}
                >
                  {mode === "add" ? "Créer le compte enseignant" : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

