import { $ } from "bun";

$.cwd(import.meta.dir);

await $`bun fmt *.js *.html *.css *.json`;
await $`bunx web-ext lint`;
await $`bunx web-ext build --overwrite-dest --ignore-files \
  'build.js' \
  'bun.lock' \
  'bun.lockb' \
  'bunfig.toml' \
  'package.json' \
  'package-lock.json' \
  'tests/**' \
  'screenshots/**' \
  'coverage/**' \
  'output/**'`;
