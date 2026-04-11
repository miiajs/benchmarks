# miiajs-benchmarks

HTTP framework benchmark harness for [MiiaJS](https://github.com/miiajs/miia) and comparative frameworks (Hono, Elysia, Fastify, NestJS, plus raw runtime baselines for Bun/Node/Deno).

## Requirements

- [Bun](https://bun.sh) (the harness runs via `bun run`)
- Node.js ≥ 22.22.1 (used to spawn some servers via `tsx`)

## Quickstart

```sh
bun run use:local   # see "Dependency modes" below — required until @miiajs/* are on npm
bun install
bun run bench
```

The `bench` command launches an interactive CLI that lets you pick scenarios (`get`, `post`, `get-api`, `post-api`), frameworks, runtimes, and number of passes. Results are written to `./tmp/benchmarks/<type>/<scenario>_<timestamp>.txt` and printed to the console.

## Dependency modes

The `@miiajs/*` packages can be resolved from two places. The project keeps a single `package.json` as source of truth (with `^0.1.0` semver) and toggles a local `overrides` field via a small script.

| Mode  | Command              | Resolves `@miiajs/*` from                          | When to use                                                                 |
|-------|----------------------|----------------------------------------------------|------------------------------------------------------------------------------|
| npm   | `bun run use:npm`    | npm registry (`^0.1.0`)                            | Default after publish; reproducible, no sibling checkout needed.            |
| local | `bun run use:local`  | `file:../miia/packages/<name>` (sibling checkout)  | Iterating on miia source — edit miia, `bun run build` there, re-run bench. |

Both scripts also run `bun install` afterwards to update the lockfile.

`use:local` mutates `package.json` — it adds an `overrides` field pointing at the sibling `../miia` checkout. You'll see the mutation in `git status` during dev sessions; **do not commit it**. Switch back with `use:npm` before committing other changes.

### Local mode workflow

1. Clone `miia` as a sibling: `/parent/miia` and `/parent/benchmarks` both exist.
2. In `../miia`: `bun install && bun run build` (rebuild after any source change you want to benchmark).
3. In this repo: `bun run use:local && bun run bench`.
4. To see which version is actually loaded, the benchmark banner prints e.g. `@miiajs/core@0.1.0 [local -> /parent/miia/packages/core]` on startup.

Bun installs `file:` packages as per-file symlinks into `../miia/packages/<name>`, so editing miia source and running `bun run build` there updates the linked `dist/` files in place — no reinstall between iterations. Two caveats:

- **New files** in `dist/` (e.g. a new export added after the last `bun install` here) are not auto-linked. If miia gains a brand-new exported module, run `bun run use:local` again to refresh the links.
- **New runtime dependencies** in `@miiajs/*` require `bun install` in `../miia` first, then re-run the benchmark.

### Current status: npm mode not yet functional

`@miiajs/core`, `@miiajs/node-server`, and `@miiajs/uws-server` are **not yet published on npm** (v0.1.0 is in preparation). Until they are:

- `bun run use:npm` leaves `package.json` clean, but the subsequent `bun install` will fail with 404 on `@miiajs/core`. This is expected — not a bug.
- Use `bun run use:local` as the only working mode.

After publish, `bun run use:npm` will "just work" and the default `bun install` on a fresh clone will resolve everything from the registry.

## Output

Benchmark results are written to `./tmp/benchmarks/<type>/<scenario>_<timestamp>.txt`, where `<type>` is `synthetic` or `realistic` depending on the scenario. The `tmp/` directory is gitignored.