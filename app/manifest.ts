import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f4ebdd",
    description:
      "A shift-friendly 30-day strength, recovery, and nutrition tracker.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icons/gym-app-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icons/gym-app-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/gym-app-maskable-512.png",
        type: "image/png",
      },
    ],
    id: "/",
    name: "30-Day Gym Tracker",
    orientation: "portrait-primary",
    short_name: "Gym Tracker",
    start_url: "/",
    theme_color: "#173f35",
  };
}
