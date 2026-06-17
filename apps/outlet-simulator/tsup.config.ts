import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  noExternal: ["@voltaria/db", "@voltaria/shared"]
});
