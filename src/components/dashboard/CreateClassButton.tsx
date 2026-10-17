"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/** Enseignant indépendant : création d'une classe (classe + rattachement en une transaction SQL). */
export function CreateClassButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onCreate() {
    const { value: name } = await Swal.fire({
      title: "Nouvelle classe",
      input: "text",
      inputLabel: "Nom de la classe",
      inputPlaceholder: "Ex. Terminale B",
      showCancelButton: true,
      confirmButtonText: "Créer",
      cancelButtonText: "Annuler",
      inputValidator: (v) => (!v || !v.trim() ? "Le nom de la classe est obligatoire." : null),
    });
    if (!name) return;

    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("create_teacher_class", { p_name: String(name).trim() });
      if (error) throw error;
      await Swal.fire({
        icon: "success",
        title: "Succès",
        text: "Classe créée.",
        timer: 1800,
        showConfirmButton: false,
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Création de la classe impossible.",
        confirmButtonText: "OK",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="primary" className="gap-2" disabled={pending} onClick={() => void onCreate()}>
      <Plus className="h-4 w-4" />
      Nouvelle classe
    </Button>
  );
}
