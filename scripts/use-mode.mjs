#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const mode = process.argv[2]
if (mode !== 'local' && mode !== 'npm') {
  console.error('Usage: use-mode.mjs <local|npm>')
  process.exit(1)
}

// @miiajs/testing is never installed here: core's devDependency on it is `workspace:*`, which bun
// cannot resolve for a file: dependency unless the name is overridden too.
const PKGS = ['@miiajs/core', '@miiajs/node-server', '@miiajs/uws-server', '@miiajs/testing']
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

if (mode === 'local') {
  pkg.overrides ??= {}
  for (const name of PKGS) {
    const short = name.split('/')[1]
    pkg.overrides[name] = `file:../miia/packages/${short}`
  }
} else if (pkg.overrides) {
  // bun.lock still holds core as a file: dependency with its `workspace:*` devDependency, so dropping
  // every override at once fails. One install with only the testing override re-resolves core from npm.
  for (const name of PKGS) if (name !== '@miiajs/testing') delete pkg.overrides[name]
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  execFileSync('bun', ['install'], { cwd: root, stdio: 'inherit' })
  delete pkg.overrides['@miiajs/testing']
  if (Object.keys(pkg.overrides).length === 0) delete pkg.overrides
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`use-mode: switched to ${mode}`)