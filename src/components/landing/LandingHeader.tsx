"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { cn } from "@/lib/utils";

type Props = {
  isLoggedIn: boolean;
  lang: "fr" | "en";
};

const navItems = {
  fr: [
    { href: "#tarifs", label: "Tarifs" },
    { href: "/register-school", label: "Établissement", isNext: true },
    { href: "#temoignages", label: "Témoignages" },
    { href: "#faq", label: "FAQ" },
    { href: "#contact", label: "Contact" },
  ],
  en: [
    { href: "#tarifs", label: "Pricing" },
    { href: "/register-school", label: "School", isNext: true },
    { href: "#temoignages", label: "Testimonials" },
    { href: "#faq", label: "FAQ" },
    { href: "#contact", label: "Contact" },
  ],
} satisfies Record<"fr" | "en", { href: string; label: string; isNext?: boolean }[]>;

const desktopLinkClass =
  "transition-colors duration-200 hover:text-primary-500 whitespace-nowrap";

const mobileLinkClass =
  "block rounded-lg px-3 py-2.5 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary-600";

function FlagFr() {
  return (
    <span className="inline-flex h-3.5 w-5 overflow-hidden rounded-[2px] border border-black/10" aria-hidden>
      <span className="h-full w-1/3 bg-[#0055A4]" />
      <span className="h-full w-1/3 bg-white" />
      <span className="h-full w-1/3 bg-[#EF4135]" />
    </span>
  );
}

function FlagGb() {
  return (
    <span className="inline-flex h-3.5 w-5 items-center justify-center overflow-hidden rounded-[2px] border border-black/10 bg-[#012169]" aria-hidden>
      <svg viewBox="0 0 60 30" className="h-full w-full">
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </svg>
    </span>
  );
}

function MobileNavRow({
  href,
  label,
  isNext,
  onNavigate,
}: {
  href: string;
  label: string;
  isNext?: boolean;
  onNavigate: () => void;
}) {
  if (isNext) {
    return (
      <Link href={href} className={mobileLinkClass} onClick={onNavigate}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={mobileLinkClass} onClick={onNavigate}>
      {label}
    </a>
  );
}

export function LandingHeader({ isLoggedIn, lang }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const labels =
    lang === "en"
      ? {
          openMenu: "Open menu",
          closeMenu: "Close menu",
          dashboard: "Dashboard",
          login: "Sign in",
          tryFree: "Try for free",
          app: "App",
          menu: "Menu",
        }
      : {
          openMenu: "Ouvrir le menu",
          closeMenu: "Fermer le menu",
          dashboard: "Dashboard",
          login: "Se connecter",
          tryFree: "Essayer gratuitement",
          app: "App",
          menu: "Menu",
        };

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-md motion-reduce:animate-none animate-header-in supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-5 md:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <CorrexiaLogo variant="svg" size={34} priority />
          <span className="truncate text-sm font-bold tracking-tight sm:text-base md:text-lg">
            CORREXIA
          </span>
        </Link>

        <nav
          className="hidden items-center gap-4 text-sm font-medium text-gray-600 lg:flex xl:gap-6"
          aria-label="Navigation principale"
        >
          {navItems[lang].map(({ href, label, isNext }) =>
            isNext ? (
              <Link key={href} href={href} className={desktopLinkClass}>
                {label}
              </Link>
            ) : (
              <a key={href} href={href} className={desktopLinkClass}>
                {label}
              </a>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          <div className="hidden items-center gap-1 rounded-full border border-gray-200 bg-white p-1 lg:flex">
            <button
              type="button"
              aria-label="Passer en français"
              onClick={() => {
                window.location.href = "/";
              }}
              className={cn(
                "inline-flex items-center rounded-full p-1.5 transition-colors",
                lang === "fr" ? "bg-primary-500" : "hover:bg-gray-100",
              )}
            >
              <FlagFr />
            </button>
            <button
              type="button"
              aria-label="Switch to English"
              onClick={() => {
                window.location.href = "/?lang=en";
              }}
              className={cn(
                "inline-flex items-center rounded-full p-1.5 transition-colors",
                lang === "en" ? "bg-primary-500" : "hover:bg-gray-100",
              )}
            >
              <FlagGb />
            </button>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
          </button>

          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-full border-2 border-gray-900 px-3 py-2 text-xs font-semibold text-gray-900 transition-all duration-300 hover:bg-gray-900 hover:text-white active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm md:px-5"
              >
                {labels.dashboard}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full border-2 border-gray-900 px-3 py-2 text-xs font-semibold text-gray-900 transition-all duration-300 hover:bg-gray-900 hover:text-white active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm md:px-5"
              >
                {labels.login}
              </Link>
            )}
            <Link
              href="/register"
              className="rounded-full bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:bg-primary-600 hover:shadow-md active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm md:px-5"
            >
              <span className="max-[420px]:hidden sm:inline">{labels.tryFree}</span>
              <span className="sm:hidden">{lang === "en" ? "Try" : "Essayer"}</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:hidden">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-sm"
              >
                {labels.app}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full border-2 border-gray-900 px-3 py-2 text-xs font-semibold text-gray-900"
              >
                {lang === "en" ? "Sign in" : "Connexion"}
              </Link>
            )}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" id="landing-mobile-menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className={cn(
              "absolute right-0 top-0 flex h-full w-[min(100vw-2.5rem,20rem)] flex-col border-l border-gray-100 bg-white p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-xl",
            )}
            aria-label="Menu mobile"
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm font-semibold text-gray-900">{labels.menu}</span>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label={labels.closeMenu}
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {navItems[lang].map(({ href, label, isNext }) => (
                <MobileNavRow
                  key={href}
                  href={href}
                  label={label}
                  isNext={isNext}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-primary-500 py-3 text-center text-sm font-semibold text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  {lang === "en" ? "Open dashboard" : "Ouvrir le tableau de bord"}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl border-2 border-gray-900 py-3 text-center text-sm font-semibold text-gray-900"
                    onClick={() => setMenuOpen(false)}
                  >
                    {labels.login}
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-xl bg-primary-500 py-3 text-center text-sm font-semibold text-white"
                    onClick={() => setMenuOpen(false)}
                  >
                    {labels.tryFree}
                  </Link>
                </>
              )}
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-label="Passer en français"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl border px-3 py-2 transition-colors",
                    lang === "fr"
                      ? "border-primary-500 bg-primary-500"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <FlagFr />
                </button>
                <button
                  type="button"
                  aria-label="Switch to English"
                  onClick={() => {
                    window.location.href = "/?lang=en";
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl border px-3 py-2 transition-colors",
                    lang === "en"
                      ? "border-primary-500 bg-primary-500"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <FlagGb />
                </button>
              </div>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
