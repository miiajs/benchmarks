#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const mode = process.argv[2]
if (mode !== 'local' && mode !== 'npm') {
  console.error('Usage: use-mode.mjs <local|npm>')
  process.exit(1)
}

const PKGS = ['@miiajs/core', '@miiajs/node-server', '@miiajs/uws-server']
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
  for (const name of PKGS) delete pkg.overrides[name]
  if (Object.keys(pkg.overrides).length === 0) delete pkg.overrides
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`use-mode: switched to ${mode}`)