import { build } from "esbuild";

// Bundle runtime dependencies so Azure does not rewrite node_modules during deployment.
// PGlite is imported only for local development. Production always uses PostgreSQL.
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["@electric-sql/pglite", "pg-native"],
  banner: {
    js: 'import { createRequire as bundleCreateRequire } from "node:module"; const require = bundleCreateRequire(import.meta.url);',
  },
  logLevel: "info",
});
