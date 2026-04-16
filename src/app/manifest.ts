import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CORREXIA — Correction assistée par IA",
    short_name: "CORREXIA",
    description:
      "Plateforme de correction des copies pour les matières scientifiques au lycée.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#007BFF",
    categories: ["education", "productivity"],
    lang: "fr",
    icons: [
      {
        src: "/logo-correxia-mark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-correxia-mark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
