"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Settings,
  LogOut,
} from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/enseignants", label: "Enseignants", icon: Users },
  { href: "/admin/ecoles", label: "Écoles", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

type Props = {
  displayName: string;
  subtitle: string;
  initials: string;
};

export function AdminSidebar({ displayName, subtitle, initials }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* env manquant : on redirige quand même */
    }
    router.push("/login?redirect=/admin");
    router.refresh();
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white md:min-h-[100dvh] md:w-[260px] md:border-b-0 md:border-r">
      <div className="hidden items-start gap-3 px-5 py-6 md:flex">
        <CorrexiaLogo size={36} />
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-gray-900">
            CORREXIA
          </p>
          <p className="text-xs text-gray-500">Administration</p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-visible md:py-0">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
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

      <div className="mt-auto hidden border-t border-gray-100 p-4 md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {displayName}
            </p>
            <p className="truncate text-xs text-gray-500">{subtitle}</p>
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
