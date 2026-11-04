// TanStack Start + Vite config, sem dependencias do Lovable.
//
// Plugins:
//   - @tanstack/react-start/plugin/vite -> tanstackStart() (wrapper oficial)
//   - @tanstack/router-plugin/vite     -> TanStackRouterVite() (file-based routing)
//   - vite-tsconfig-paths               -> alias "@/*" para "./src/*"
//
// Nitro e configurado implicitamente por tanstackStart(). O preset
// "vercel" e detectado via process.env.VERCEL === "1" no build da Vercel.
//
// Saida publica:
//   O app tem rotas de servidor (server functions, /api/public/*), entao o
//   build SSR continua sendo gerado e o deploy na Vercel nao muda. Alem dele,
//   a configuracao abaixo publica uma entrada HTML estatica (index.html +
//   _shell.html) copiando o shell da aplicacao. Assim a pre-visualizacao
//   estatica tem uma pagina de entrada sem remover nada do servidor.

import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Publica o shell HTML gerado pelo Start como pagina de entrada estatica.
// Nao altera o bundle de servidor nem as server functions.
function staticEntry(): Plugin {
  return {
    name: "manostech-static-entry",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const outDir = ".vercel/output/static";
      const candidates = ["dist/client/_shell.html", "dist/_shell.html"];
      const shell = await findFirst(candidates);
      if (!shell) return;
      await mkdir(outDir, { recursive: true });
      const html = await readText(shell);
      const page = html.includes("<script") ? html : html.replace("</body>", "</body>");
      await writeFile(join(outDir, "_shell.html"), page, "utf8");
      await writeFile(join(outDir, "index.html"), page, "utf8");
      await copyFile(shell, join(outDir, "_shell.origin.html"));
    },
  };
}

async function findFirst(paths: string[]): Promise<string | undefined> {
  const { access } = await import("node:fs/promises");
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      /* tenta o proximo */
    }
  }
  return undefined;
}

async function readText(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    ...react().map((plugin) => ({ ...plugin, enforce: "post" as const })),
    viteTsconfigPaths(),
    tanstackStart({ spa: { enabled: true } }),
    nitro(),
    staticEntry(),
  ],
  build: {
    target: "es2022",
  },
});
