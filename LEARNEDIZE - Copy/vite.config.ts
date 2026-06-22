import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      ssrManifest: true,
    },
  },
  nitro: {
    preset: "vercel",
  },
  tanstackStart: {
    server: {
      entry: "./src/server.ts",
    },
  },
});
