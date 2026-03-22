import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export function adminInitials(fullName: string, email?: string | null): string {
  const src = fullName?.trim() || email?.split("@")[0] || "AD";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)
    ).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export async function requirePlatformAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, user, profile };
}
