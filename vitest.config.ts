import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * vitest.config.ts — Test-Infrastruktur für Unit-Tests (Sicherheitshelfer etc.).
 * Node-Umgebung; Tests liegen unter tests/. Der `@/*`-Alias spiegelt tsconfig.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
