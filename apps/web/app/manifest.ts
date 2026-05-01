import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voltaria",
    short_name: "Voltaria",
    description: "Monitoreo de cargadores eléctricos en torres residenciales",
    start_url: "/mobile/home",
    display: "standalone",
    background_color: "#060B14",
    theme_color: "#060B14",
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
