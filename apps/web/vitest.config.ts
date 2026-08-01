import { defineConfig, mergeConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default mergeConfig(
  defineConfig({
    plugins: [react()],
  }),
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
