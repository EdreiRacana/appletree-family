import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // El Service Worker DEBE servirse sin caché, si no los navegadores
        // siguen usando la versión anterior y las notificaciones push llegan
        // con el comportamiento viejo (se auto-cierran, se reemplazan, etc.).
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          // Netlify-CDN-Cache-Control controla el edge del CDN aparte del
          // Cache-Control que ve el navegador.
          { key: "Netlify-CDN-Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ]
  },
};

export default nextConfig;
