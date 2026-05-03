import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Meme-Tagebuch",
    short_name: "Meme-Tagebuch",
    description: "Memes aus Fotos erstellen, mit Freunden im Feed teilen.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#18181b",
    theme_color: "#ea580c",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
