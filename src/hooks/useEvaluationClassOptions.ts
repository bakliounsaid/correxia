"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ClassOptionsState = { schoolName: string; classOptions: string[]; loading: boolean };

function sortedUnique(names: string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "fr"));
}

async function classNamesByIds(supabase: SupabaseClient, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("classes").select("name").in("id", ids).order("name", { ascending: true });
  return (data ?? []).map((c) => c.name as string);
}

/** Classes proposées à la création d'une évaluation + nom de l'établissement (admin d'école ou enseignant). */
async function loadClassOptions(supabase: SupabaseClient): Promise<Omit<ClassOptionsState, "loading">> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { schoolName: "", classOptions: [] };

  const { data: adminSchool } = await supabase
    .from("schools")
    .select("id, name")
    .eq("admin_user_id", user.id)
    .maybeSingle();
  if (adminSchool?.id) {
    const { data: classes } = await supabase
      .from("classes")
      .select("name")
      .eq("school_id", adminSchool.id)
      .order("name", { ascending: true });
    return {
      schoolName: (adminSchool.name as string) ?? "",
      classOptions: sortedUnique((classes ?? []).map((c) => c.name as string)),
    };
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, school_id, schools(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  const schoolJoin = teacher?.schools as { name?: string } | { name?: string }[] | null | undefined;
  let schoolName = (Array.isArray(schoolJoin) ? schoolJoin[0]?.name : schoolJoin?.name) ?? "";
  if (!schoolName && teacher?.school_id) {
    const { data: school } = await supabase.from("schools").select("name").eq("id", teacher.school_id).maybeSingle();
    schoolName = (school?.name as string) ?? "";
  }

  let classOptions: string[] = [];
  if (teacher?.id) {
    const { data: links } = await supabase.from("class_teachers").select("class_id").eq("teacher_id", teacher.id);
    classOptions = sortedUnique(await classNamesByIds(supabase, (links ?? []).map((l) => l.class_id as string)));
  }
  return { schoolName, classOptions };
}

export function useEvaluationClassOptions(): ClassOptionsState {
  const [state, setState] = useState<ClassOptionsState>({ schoolName: "", classOptions: [], loading: true });

  useEffect(() => {
    let mounted = true;
    loadClassOptions(getSupabaseBrowserClient())
      .then((result) => mounted && setState({ ...result, loading: false }))
      .catch(() => mounted && setState({ schoolName: "", classOptions: [], loading: false }));
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
