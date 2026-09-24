import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Tests always run against the in-memory database, never a real one.
  test: { env: { DATABASE_URL: "" } },
});
