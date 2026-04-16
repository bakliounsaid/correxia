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
  Sparkles,
  LogOut,
} from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const teacherNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/evaluations", label: "Évaluations", icon: ClipboardList },
  {
    href: "/dashboard/eleves",
    label: "Mes élèves",
    icon: CircleUserRound,
  },
  { href: "/dashboard/classes", label: "Mes Classes", icon: Users },
  { href: "/dashboard/archives", label: "Archives", icon: Archive },
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
  /** Enseignant libre : bouton packs Avancé / Maîtrise */
  showTeacherUpgrade?: boolean;
};

export function TeacherSidebar({
  displayName,
  subtitle,
  initials,
  role,
  showTeacherUpgrade,
}: Props) {
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
    <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] md:sticky md:top-0 md:min-h-[100dvh] md:w-[260px] md:border-b-0 md:border-r md:supports-[padding:max(0px)]:pt-0">
      <div className="hidden items-start gap-3 px-5 py-6 md:flex">
        <Link href="/" aria-label="Aller sur la landing">
          <CorrexiaLogo variant="svg" size={36} />
        </Link>
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-gray-900">
            CORREXIA
          </p>
          <p className="text-xs text-gray-500">
            {role === "school_admin" ? "Pilotage établissement" : "Correction IA"}
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-visible md:py-0">
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
                "flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors md:gap-3 md:py-2.5",
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

      {role === "school_admin" ? (
        <div className="px-3 pb-3 pt-1 md:border-t md:border-gray-100 md:pb-4 md:pt-4">
          <Link
            href="/dashboard/abonnement?upgrade=1"
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} />
            Mettre à niveau
          </Link>
        </div>
      ) : showTeacherUpgrade ? (
        <div className="px-3 pb-3 pt-1 md:border-t md:border-gray-100 md:pb-4 md:pt-4">
          <Link
            href="/dashboard/abonnement-enseignant?upgrade=1"
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} />
            Mettre à niveau
          </Link>
        </div>
      ) : null}

      <div className="mt-auto border-t border-gray-100 p-4 supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))] md:supports-[padding:max(0px)]:pb-4">
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
