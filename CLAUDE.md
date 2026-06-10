# miiajs-benchmarks

Standalone HTTP framework benchmark harness for [MiiaJS](https://github.com/miiajs/miia) and comparative frameworks (Hono, Elysia, Fastify, NestJS, plus raw runtime baselines for Bun / Node / Deno). Extracted from the `miia/` monorepo so it can evolve independently and support two dependency-resolution modes.

## Layout

```
run.ts                 — interactive CLI that spawns servers + autocannon, prints/saves results
shared/jwt.ts          — JWT token helper used by the "realistic" (API) scenarios
servers/synthetic/     — minimal single-route servers (Hello World, JSON echo, etc.)
servers/realistic/     — CORS + JWT + validation + params servers (mirrors real API workload)
nest/{synthetic,realistic}/  — NestJS servers (separate tsconfig w/ experimentalDecorators)
scripts/use-mode.mjs   — toggles `overrides` field between npm and local modes
tsconfig.json          — root TS config (fully standalone, no extends/references)
nest/tsconfig.json     — NestJS-only config; tsx auto-picks it per spawn
tmp/                   — gitignored; benchmark result .txt files land here
```

There is **no build step, no unit tests, no src/ directory**. This is a script harness — `bun run run.ts` runs everything directly. Do not add `bun test` or a build pipeline unless there's a concrete reason.

## Runtime flow

1. `reportMiiaVersions()` at startup prints which `@miiajs/*` packages are loaded and whether from npm or local mode. Uses `lstatSync` on `node_modules/@miiajs/<name>/package.json` — see "Local mode detection" below.
2. `detectRuntimes()` scans for `bun`, `node`, `deno` via `spawnSync --version`.
3. `selectConfig()` uses `@inquirer/prompts` for interactive selection (scenarios, frameworks, runtime, passes). CLI flags override: `--scenario`, `--passes`, `--only`, `--runtime`, `--all`.
4. For each `(scenario, server)` pair: spawn server, warm up with autocannon (5s), run N passes (30s each), parse JSON output, aggregate.
5. `saveResults()` writes a formatted text report to `./tmp/benchmarks/<type>/<scenario>_<ts>.txt`. `<type>` is `synthetic` or `realistic` derived from the scenario.

The server registry lives in `SYNTHETIC_SERVERS` and `REALISTIC_SERVERS` arrays inside `run.ts`. Each entry: `{ name, framework, runtime, file, cwd? }`. Adding a new server = write a file in `servers/<type>/`, register one entry in the matching array.

## Two dependency modes

`@miiajs/core`, `@miiajs/node-server`, `@miiajs/uws-server` can resolve from npm (after publish) or from a sibling `../miia` checkout for dev iteration. A single `package.json` holds semver `^0.1.0` as source of truth; `scripts/use-mode.mjs` toggles an `overrides` field.

- `bun run use:local` — sets `overrides["@miiajs/*"] = "file:../miia/packages/<name>"` and runs `bun install`.
- `bun run use:npm` — deletes those overrides and runs `bun install`.

`use:local` mutates `package.json`. The diff shows up in `git status` during dev sessions and **must not be committed**. Switch back to `use:npm` before committing other changes.

## Gotchas (the reasons things are how they are)

### 1. `file:` in overrides, not `link:`

Bun's `link:` protocol is for packages registered via `bun link` (global link registry). It **does not** accept relative paths — trying `link:../miia/packages/core` produces `FileNotFound: failed linking dependency/workspace to node_modules`. Use `file:` — it accepts relative paths and (for directories, not tarballs) creates per-file symlinks into the source, which is what we want for dev iteration.

### 2. `uWebSockets.js` resolves through `@miiajs/uws-server` (no workaround as of 0.2.0)

`@miiajs/uws-server@0.2.0+` declares `uWebSockets.js` as a regular **dependency** (`github:uNetworking/uWebSockets.js#v20.68.0`), so bun resolves it transitively with no help from this repo. No top-level dep, no `overrides` entry.

Historical note (≤0.1.0): `uws-server` declared `uWebSockets.js` as a **peerDependency**, which bun tried to fetch from npm and got a 404. The fix was a top-level `dependencies["uWebSockets.js"] = "github:..."` plus `overrides: { "uWebSockets.js": "$uWebSockets.js" }` to force the github URL everywhere. Both were removed when bumping to 0.2.0 — if you ever pin back to a peerDependency version, that pattern is what you need to restore.

`use-mode.mjs` only touches `@miiajs/*` overrides; in npm mode it deletes the `overrides` key entirely once empty, so a clean checkout has no `overrides` field at all.

### 3. Local mode detection via `package.json`, not the package dir

When bun installs a `file:` directory, it doesn't symlink the whole package dir — it walks the source and creates **per-file symlinks** inside a regular directory. So:

- `lstatSync("node_modules/@miiajs/core").isSymbolicLink()` → `false` (regular dir)
- `lstatSync("node_modules/@miiajs/core/package.json").isSymbolicLink()` → `true` (symlink into `../miia/packages/core/package.json`)

`reportMiiaVersions()` checks the latter. Don't "fix" it to check the directory.

### 4. New files in miia dist aren't auto-linked

Per-file symlinks are snapshotted at install time. If a miia rebuild produces a **brand-new** file in `dist/` (new exported module), it won't exist in `node_modules/@miiajs/core/dist/` until you re-run `bun run use:local`. Edits to existing files work fine — they propagate through the symlink.

If miia packages gain a new runtime dependency, run `bun install` in `../miia` first, then re-run the benchmark.

### 5. Results directory is inside the repo

`saveResults()` writes to `join(SCRIPT_DIR, 'tmp', 'benchmarks', type)`. The original monorepo `run.ts` had `join(SCRIPT_DIR, '..', 'tmp', ...)` — after extraction that would escape into the parent workspace dir, so the `..` was dropped. `tmp/` is gitignored.

## Adding a new server

1. Create `servers/<synthetic|realistic>/<framework>.ts`. It must be a standalone file that, when executed, starts an HTTP server on `process.env.PORT` (fallback 9847) and implements the scenario endpoints (see existing files for the contract).
2. Register an entry in `SYNTHETIC_SERVERS` or `REALISTIC_SERVERS` in `run.ts`:
   ```ts
   { name: 'framework-name', framework: 'framework-id', runtime: 'bun', file: 'servers/synthetic/framework.ts' }
   ```
3. If the framework has its own `FrameworkId`, add it to the `FrameworkId` union type at the top of `run.ts`.
4. If it needs a dedicated runtime or cwd (like nest uses `node --import tsx` from the `nest/` subdir), set `cwd` accordingly — see how nest entries are structured.

## Conventions

- **ESM everywhere**, `.js` extension in imports (required by miia's TS setup).
- **No biome/lefthook** — this repo doesn't enforce formatting. Match surrounding style.
- **No CLAUDE.md / README.md duplication.** README is user-facing (how to run), this file is contributor/agent-facing (how it's built and why).