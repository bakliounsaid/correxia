import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Taille d’affichage (carré), en px */
  size?: number;
  /**
   * `mark` = logo PNG officiel (recommandé header, hero).
   * `svg` = pictogramme vectoriel léger.
   */
  variant?: "mark" | "svg";
  priority?: boolean;
};

export function CorrexiaLogo({
  className,
  size = 40,
  variant = "mark",
  priority = false,
}: Props) {
  if (variant === "svg") {
    return (
      <Image
        src="/logo-correxia.svg"
        alt="CORREXIA"
        width={size}
        height={size}
        className={cn("shrink-0 object-contain", className)}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src="/logo-correxia-mark.png"
      alt="CORREXIA"
      width={512}
      height={512}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
