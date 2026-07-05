import type { MetadataRoute } from "next";

// Manifeste PWA — servi automatiquement par Next.js sur /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vetelio — Planning",
    short_name: "Vetelio",
    description: "Planning de la clinique vétérinaire",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#2563eb",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
