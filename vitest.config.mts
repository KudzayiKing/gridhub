import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/*
 * `.mts` (not `.ts`) on purpose: this config uses ESM syntax, and Vite loads a `.ts` config
 * as CommonJS unless package.json declares `"type": "module"`. That mismatch produces a
 * warning today and will become an error in a future Vite major.
 *
 * Because it is now a real ES module, `__dirname` does not exist — `import.meta.dirname`
 * does, and is supported on the Node versions this project targets.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
