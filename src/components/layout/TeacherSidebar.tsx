"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CircleUserRound,
  GraduationCap,
  ClipboardList,
  Archive,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const teacherNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/classes", label: "Mes Classes", icon: Users },
  {
    href: "/dashboard/eleves",
    label: "Mes élèves",
    icon: CircleUserRound,
  },
  { href: "/dashboard/evaluations", label: "Évaluations", icon: ClipboardList },
  { href: "/dashboard/archives", label: "Archives", icon: Archive },
  {
    href: "/dashboard/bareme",
    label: "Paramètres du barème",
    icon: SlidersHorizontal,
  },
];

const schoolNav = [
  { href: "/dashboard", label: "Dashboard établissement", icon: LayoutDashboard },
  { href: "/dashboard/enseignants", label: "Enseignants", icon: GraduationCap },
  { href: "/dashboard/eleves", label: "Élèves", icon: CircleUserRound },
  { href: "/dashboard/classes", label: "Classes", icon: Users },
];

type Props = {
  displayName: string;
  subtitle: string;
  initials: string;
  role?: string;
};

export function TeacherSidebar({ displayName, subtitle, initials, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const nav = role === "school_admin" ? schoolNav : teacherNav;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* env manquant : redirection quand même */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-start gap-3 px-5 py-6">
        <CorrexiaLogo size={36} />
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-gray-900">
            CORREXIA
          </p>
          <p className="text-xs text-gray-500">
            {role === "school_admin" ? "Pilotage établissement" : "Correction IA"}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ia-500 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {displayName}
            </p>
            {subtitle ? (
              <p className="truncate text-xs text-gray-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </Button>
      </div>
    </aside>
  );
}
