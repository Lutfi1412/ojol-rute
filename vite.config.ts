import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true, // bisa dibuka dari HP lewat IP jaringan (https://192.168.x.x:5173)
    port: 5173,
    headers: {
      "Permissions-Policy": "geolocation=(self)",
    },
  },
  preview: {
    host: true,
    port: 4173,
    headers: {
      "Permissions-Policy": "geolocation=(self)",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/tests/**/*.test.ts"],
  },
});