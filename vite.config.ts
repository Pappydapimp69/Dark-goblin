import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "es2022", outDir: "dist" },
  test: { include: ["tests/**/*.test.ts"], globals: true },
});
