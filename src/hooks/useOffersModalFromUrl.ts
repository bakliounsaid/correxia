"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export const UPGRADE_PARAM = "upgrade";

/**
 * Fenêtre des offres ouverte par un lien « ?upgrade=1 » (bouton « Mettre à niveau » de la barre latérale).
 *
 * S'ouvre à CHAQUE arrivée du paramètre (pas seulement au premier rendu : la page reste montée quand on
 * navigue vers elle-même), puis retire le paramètre via le routeur Next. Le retirer avec
 * window.history.replaceState désynchroniserait le routeur, et le clic suivant sur le même lien ne ferait rien.
 */
export function useOffersModalFromUrl(openRequested: boolean | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(Boolean(openRequested));
  // Réf : l'effet ne doit réagir qu'à l'arrivée du paramètre, pas à un changement d'identité du routeur.
  const navigation = useRef({ router, pathname });
  navigation.current = { router, pathname };

  useEffect(() => {
    if (!openRequested) return;
    setOpen(true);
    const params = new URLSearchParams(window.location.search);
    params.delete(UPGRADE_PARAM);
    const qs = params.toString();
    const { router: r, pathname: path } = navigation.current;
    r.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [openRequested]);

  return [open, setOpen] as const;
}
