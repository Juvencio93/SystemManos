// TanStack Start + Vite config, sem dependencias do Lovable.
//
// Plugins:
//   - @tanstack/react-start/plugin/vite -> tanstackStart() (wrapper oficial)
//   - @tanstack/router-plugin/vite     -> TanStackRouterVite() (file-based routing)
//   - vite-tsconfig-paths               -> alias "@/*" para "./src/*"
//
// Nitro e configurado implicitamente por tanstackStart(). O preset
// "vercel" e detectado via process.env.VERCEL === "1" no build da Vercel.

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteTsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteTsconfigPaths(),
    tanstackStart(),
  ],
  build: {
    target: "es2022",
  },
});
