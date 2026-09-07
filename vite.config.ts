// @lovable.dev/vite-tanstack-config keeps the Lovable editor and sandbox
// integration working while still allowing self-hosted deployment targets.
//
// Do not add TanStack Start, React, Tailwind, Nitro, or path-alias plugins
// manually: the wrapper already installs them.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = process.env["VERCEL"] === "1";

export default defineConfig({
  tanstackStart: {
    // Keep the custom SSR error wrapper for every hosting provider.
    server: { entry: "server" },
  },

  // Lovable controls its own sandbox preset. Vercel builds advertise
  // VERCEL=1 and receive Nitro's Vercel-compatible output automatically.
  // Local/self-hosted builds keep portable Nitro output enabled.
  nitro: isVercel ? { preset: "vercel" } : true,
});
