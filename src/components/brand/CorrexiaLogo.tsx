import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Taille d’affichage (carré), en px */
  size?: number;
  /**
   * Conservé pour compatibilité des appels existants.
   * Les deux variantes utilisent désormais le logo PNG officiel.
   */
  variant?: "mark" | "svg";
  priority?: boolean;
};

export function CorrexiaLogo({
  className,
  size = 40,
  priority = false,
}: Props) {
  const src = "/logo-correxia-mark.png";

  return (
    <Image
      src={src}
      alt="CORREXIA"
      width={512}
      height={512}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
