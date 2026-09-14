import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Everything in public/ is copied to the site root at build time, which is
  // how /jobs.json and /content.json end up live.
  publicDir: "public",
  build: { outDir: "dist", emptyOutDir: true },
});
