// Builds a single-file, backend-free preview of the app (same React screens, mocked API).
// npm run preview:build  ->  preview/dist/index.html
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("./"),
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: "next/link", replacement: r("./shims/link.tsx") },
      { find: "next/navigation", replacement: r("./shims/navigation.ts") },
      { find: "@/lib/supabase/client", replacement: r("./shims/supabase-client.ts") },
      { find: "@", replacement: r("../src") },
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify("preview"),
    "process.env.NEXT_PUBLIC_PREVIEW": JSON.stringify("1"),
  },
  build: { outDir: r("./dist"), emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 },
});
