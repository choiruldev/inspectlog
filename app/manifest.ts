import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InspectLog — Developer Web & API Inspector",
    short_name: "InspectLog",
    description: "Inspeksi payload HTTP, response, console log, dan error runtime aplikasi web & API.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#090a0f",
    theme_color: "#090a0f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
