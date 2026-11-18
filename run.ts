import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { checkbox, select } from '@inquirer/prompts'
import { createToken } from './shared/jwt.js'

const API_TOKEN = await createToken()

// ─── Config ─────────────────────────────────────────────────

const PORT = 9847
const BASE_URL = `http://localhost:${PORT}`
const CONNECTIONS = 100
const DURATION = 30
const WARMUP_DURATION = 5
const STARTUP_TIMEOUT = 10_000

const SCRIPT_DIR = import.meta.dirname!

// ─── Types ──────────────────────────────────────────────────

type Runtime = 'bun' | 'node' | 'deno'
type Scenario = 'get' | 'post' | 'get-api' | 'post-api'
type FrameworkId = 'raw' | 'raw-node' | 'raw-uws' | 'miia' | 'miia-uws' | 'hono' | 'hono-uws' | 'elysia' | 'fastify' | 'nest'

interface ServerConfig {
  name: string
  framework: FrameworkId
  runtime: Runtime
  file: string
  cwd?: string
}

interface ScenarioConfig {
  method: 'GET' | 'POST'
  path: string
  body?: string
  headers?: Record<string, string>
}

interface AutocannonResult {
  requests: { average: number }
  latency: { average: number; p50: number; p99: number; p99_9: number }
}

interface PassResult {
  reqPerSec: number
  latencyAvg: number
  latencyP50: number
  latencyP99: number
  latencyP999: number
}

interface AggregatedResult {
  name: string
  reqPerSecAvg: number
  reqPerSecStddev: number
  latencyAvg: number
  latencyP50: number
  latencyP99: number
  latencyP999: number
}

// ─── Data ───────────────────────────────────────────────────

const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  get: {
    method: 'GET',
    path: '/',
  },
  post: {
    method: 'POST',
    path: '/json',
    body: JSON.stringify({ name: 'World' }),
    headers: { 'content-type': 'application/json' },
  },
  'get-api': {
    method: 'GET',
    path: '/api/users/42/posts/7',
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      origin: 'http://benchmark.local',
    },
  },
  'post-api': {
    method: 'POST',
    path: '/api/workspaces/ws-1/projects/proj-42/tasks?notify=true&format=full',
    body: JSON.stringify({ title: 'Fix bug', priority: 'high' }),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_TOKEN}`,
      origin: 'http://benchmark.local',
      'x-request-id': 'req-bench-001',
    },
  },
}

const FRAMEWORKS: { id: FrameworkId; name: string }[] = [
  { id: 'raw', name: 'Raw HTTP' },
  { id: 'raw-node', name: 'Raw node-server' },
  { id: 'raw-uws', name: 'Raw uws-server' },
  { id: 'miia', name: 'MiiaJS' },
  { id: 'miia-uws', name: 'MiiaJS (uWS)' },
  { id: 'hono', name: 'Hono' },
  { id: 'hono-uws', name: 'Hono (uWS)' },
  { id: 'elysia', name: 'Elysia (Bun only)' },
  { id: 'fastify', name: 'Fastify' },
  { id: 'nest', name: 'NestJS' },
]

const SYNTHETIC_SERVERS: ServerConfig[] = [
  { name: 'Raw Bun', framework: 'raw', runtime: 'bun', file: 'servers/synthetic/raw-bun.ts' },
  { name: 'Raw Node', framework: 'raw', runtime: 'node', file: 'servers/synthetic/raw-node.ts' },
  { name: 'Raw Deno', framework: 'raw', runtime: 'deno', file: 'servers/synthetic/raw-deno.ts' },
  { name: 'Raw node-server', framework: 'raw-node', runtime: 'node', file: 'servers/synthetic/raw-node-server.ts' },
  { name: 'Raw uws-server', framework: 'raw-uws', runtime: 'node', file: 'servers/synthetic/raw-uws-server.ts' },
  { name: 'MiiaJS (Bun)', framework: 'miia', runtime: 'bun', file: 'servers/synthetic/miia.ts' },
  { name: 'MiiaJS (Node)', framework: 'miia', runtime: 'node', file: 'servers/synthetic/miia.ts' },
  { name: 'MiiaJS (Deno)', framework: 'miia', runtime: 'deno', file: 'servers/synthetic/miia.ts' },
  { name: 'MiiaJS uWS (Node)', framework: 'miia-uws', runtime: 'node', file: 'servers/synthetic/miia-uws.ts' },
  { name: 'Hono (Bun)', framework: 'hono', runtime: 'bun', file: 'servers/synthetic/hono.ts' },
  { name: 'Hono (Node)', framework: 'hono', runtime: 'node', file: 'servers/synthetic/hono.ts' },
  { name: 'Hono (Deno)', framework: 'hono', runtime: 'deno', file: 'servers/synthetic/hono.ts' },
  { name: 'Hono uWS (Node)', framework: 'hono-uws', runtime: 'node', file: 'servers/synthetic/hono-uws.ts' },
  { name: 'Elysia (Bun)', framework: 'elysia', runtime: 'bun', file: 'servers/synthetic/elysia-bun.ts' },
  { name: 'Fastify (Bun)', framework: 'fastify', runtime: 'bun', file: 'servers/synthetic/fastify.ts' },
  { name: 'Fastify (Node)', framework: 'fastify', runtime: 'node', file: 'servers/synthetic/fastify.ts' },
  { name: 'NestJS (Bun)', framework: 'nest', runtime: 'bun', file: 'synthetic/node.ts', cwd: 'nest' },
  { name: 'NestJS (Node)', framework: 'nest', runtime: 'node', file: 'synthetic/node.ts', cwd: 'nest' },
]

const REALISTIC_SERVERS: ServerConfig[] = [
  { name: 'MiiaJS (Bun)', framework: 'miia', runtime: 'bun', file: 'servers/realistic/miia.ts' },
  { name: 'MiiaJS (Node)', framework: 'miia', runtime: 'node', file: 'servers/realistic/miia.ts' },
  { name: 'MiiaJS (Deno)', framework: 'miia', runtime: 'deno', file: 'servers/realistic/miia.ts' },
  { name: 'MiiaJS uWS (Node)', framework: 'miia-uws', runtime: 'node', file: 'servers/realistic/miia-uws.ts' },
  { name: 'Hono (Bun)', framework: 'hono', runtime: 'bun', file: 'servers/realistic/hono.ts' },
  { name: 'Hono (Node)', framework: 'hono', runtime: 'node', file: 'servers/realistic/hono.ts' },
  { name: 'Hono (Deno)', framework: 'hono', runtime: 'deno', file: 'servers/realistic/hono.ts' },
  { name: 'Hono uWS (Node)', framework: 'hono-uws', runtime: 'node', file: 'servers/realistic/hono-uws.ts' },
  { name: 'Elysia (Bun)', framework: 'elysia', runtime: 'bun', file: 'servers/realistic/elysia.ts' },
  { name: 'Fastify (Bun)', framework: 'fastify', runtime: 'bun', file: 'servers/realistic/fastify.ts' },
  { name: 'Fastify (Node)', framework: 'fastify', runtime: 'node', file: 'servers/realistic/fastify.ts' },
  { name: 'NestJS (Bun)', framework: 'nest', runtime: 'bun', file: 'realistic/node.ts', cwd: 'nest' },
  { name: 'NestJS (Node)', framework: 'nest', runtime: 'node', file: 'realistic/node.ts', cwd: 'nest' },
]

function getServers(scenario: Scenario): ServerConfig[] {
  return scenario === 'get-api' || scenario === 'post-api' ? REALISTIC_SERVERS : SYNTHETIC_SERVERS
}

// ─── Helpers ────────────────────────────────────────────────

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ─── Runtime detection ──────────────────────────────────────

function detectRuntimes(): Set<Runtime> {
  const available = new Set<Runtime>()
  const runtimes: Runtime[] = ['bun', 'node', 'deno']

  for (const runtime of runtimes) {
    try {
      const result = spawnSync(runtime, ['--version'], { timeout: 5000, stdio: 'pipe' })
      if (result.status === 0) {
        const version = result.stdout?.toString().trim()
        console.log(c.green(`  ✓ ${runtime} ${version}`))
        available.add(runtime)
      }
    } catch {
      // not installed
    }
  }

  for (const runtime of runtimes) {
    if (!available.has(runtime)) {
      console.log(c.dim(`  ✗ ${runtime} not found`))
    }
  }

  return available
}

// ─── Server lifecycle ───────────────────────────────────────

function startServer(config: ServerConfig): ChildProcess {
  const cwd = config.cwd ? `${SCRIPT_DIR}/${config.cwd}` : SCRIPT_DIR
  const file = config.cwd ? config.file : `${SCRIPT_DIR}/${config.file}`
  const env = { ...process.env, PORT: String(PORT) }

  if (config.runtime === 'bun') {
    return spawn('bun', ['run', file], { cwd, stdio: 'ignore', env })
  }
  if (config.runtime === 'deno') {
    return spawn('deno', ['run', '--allow-net', '--allow-env', '--sloppy-imports', file], { cwd, stdio: 'ignore', env })
  }
  return spawn('node', ['--import', 'tsx', file], { cwd, stdio: 'ignore', env })
}

async function waitForServer(): Promise<boolean> {
  const url = `${BASE_URL}/`
  const start = Date.now()
  while (Date.now() - start < STARTUP_TIMEOUT) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

function killServer(proc: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (!proc.pid || proc.killed) return resolve()
    proc.on('exit', () => resolve())
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
    }, 3000)
  })
}

// ─── Autocannon ─────────────────────────────────────────────

async function runAutocannon(
  connections: number,
  duration: number,
  scenario: ScenarioConfig,
): Promise<AutocannonResult> {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${scenario.path}`
    const args = ['-c', String(connections), '-d', String(duration), '-j']

    if (scenario.method !== 'GET') {
      args.push('-m', scenario.method)
    }
    if (scenario.headers) {
      for (const [key, value] of Object.entries(scenario.headers)) {
        args.push('-H', `${key}=${value}`)
      }
    }
    if (scenario.body) {
      args.push('-b', scenario.body)
    }
    args.push(url)

    const autocannon = join(SCRIPT_DIR, 'node_modules', '.bin', 'autocannon')
    const proc = spawn(autocannon, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let output = ''
    proc.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`autocannon exited with code ${code}`))
      try {
        resolve(JSON.parse(output) as AutocannonResult)
      } catch {
        reject(new Error('Failed to parse autocannon output'))
      }
    })
  })
}

// ─── Benchmark ──────────────────────────────────────────────

function aggregate(name: string, passes: PassResult[]): AggregatedResult {
  const n = passes.length
  const reqs = passes.map(p => p.reqPerSec)
  const avg = reqs.reduce((a, b) => a + b, 0) / n
  const variance = reqs.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n

  return {
    name,
    reqPerSecAvg: avg,
    reqPerSecStddev: Math.sqrt(variance),
    latencyAvg: passes.reduce((a, b) => a + b.latencyAvg, 0) / n,
    latencyP50: passes.reduce((a, b) => a + b.latencyP50, 0) / n,
    latencyP99: passes.reduce((a, b) => a + b.latencyP99, 0) / n,
    latencyP999: passes.reduce((a, b) => a + b.latencyP999, 0) / n,
  }
}

async function benchmarkServer(
  config: ServerConfig,
  scenario: ScenarioConfig,
  passes: number,
): Promise<AggregatedResult | null> {
  console.log(`\n${c.bold(c.cyan(`► ${config.name}`))}`)
  console.log(c.dim(`  ${config.runtime} ${config.file}${config.cwd ? ` (cwd: ${config.cwd})` : ''}`))

  const proc = startServer(config)

  try {
    if (!await waitForServer()) {
      console.log(c.red(`  SKIPPED — server failed to start within ${STARTUP_TIMEOUT / 1000}s`))
      return null
    }

    // Warmup (once, full connections to let JIT compile hot paths)
    console.log(c.dim(`  Warming up (${WARMUP_DURATION}s, ${CONNECTIONS}c)...`))
    await runAutocannon(CONNECTIONS, WARMUP_DURATION, scenario)

    // Multi-pass benchmark
    const passResults: PassResult[] = []
    for (let p = 1; p <= passes; p++) {
      console.log(`  Pass ${p}/${passes} (${CONNECTIONS}c × ${DURATION}s)...`)
      const result = await runAutocannon(CONNECTIONS, DURATION, scenario)
      const pass: PassResult = {
        reqPerSec: result.requests?.average ?? 0,
        latencyAvg: result.latency?.average ?? 0,
        latencyP50: result.latency?.p50 ?? 0,
        latencyP99: result.latency?.p99 ?? 0,
        latencyP999: result.latency?.p99_9 ?? 0,
      }
      passResults.push(pass)
      console.log(c.dim(`    ${fmt(pass.reqPerSec)} req/s | avg: ${pass.latencyAvg}ms | p50: ${pass.latencyP50}ms | p99: ${pass.latencyP99}ms`))
    }

    const agg = aggregate(config.name, passResults)
    console.log(c.green(`  → Avg: ${fmt(agg.reqPerSecAvg)} req/s (±${fmt(agg.reqPerSecStddev)})`))
    return agg
  } catch (err) {
    console.log(c.red(`  FAILED — ${err instanceof Error ? err.message : err}`))
    return null
  } finally {
    await killServer(proc)
    await new Promise(r => setTimeout(r, 500))
  }
}

// ─── Results table ──────────────────────────────────────────

function printResults(results: AggregatedResult[], scenario: Scenario, passes: number) {
  const sorted = [...results].sort((a, b) => b.reqPerSecAvg - a.reqPerSecAvg)
  const leader = sorted[0]?.reqPerSecAvg ?? 0

  console.log('')
  console.log(c.bold('═══════════════════════════════════════════════════════════════════════════════════════'))
  console.log(c.bold(`  Benchmark Results — ${scenario.toUpperCase()} ${SCENARIOS[scenario].path}`))
  console.log(c.dim(`  connections: ${CONNECTIONS} | duration: ${DURATION}s | warmup: ${WARMUP_DURATION}s | passes: ${passes} | pipelining: 1`))
  console.log(c.bold('═══════════════════════════════════════════════════════════════════════════════════════════════'))
  console.log('')

  const header = [
    'Framework'.padEnd(26),
    'Req/sec (avg)'.padStart(15),
    '± stddev'.padStart(10),
    'Δ leader'.padStart(10),
    'Lat avg'.padStart(10),
    'p50'.padStart(8),
    'p99'.padStart(8),
    'p99.9'.padStart(8),
  ].join(' ')

  console.log(c.bold(`  ${header}`))
  console.log('  ' + '─'.repeat(97))

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    const delta = leader > 0 ? ((r.reqPerSecAvg - leader) / leader * 100) : 0
    const deltaStr = i === 0 ? '—' : `${delta.toFixed(1)}%`

    const line = [
      r.name.padEnd(26),
      fmt(r.reqPerSecAvg).padStart(15),
      `±${fmt(r.reqPerSecStddev)}`.padStart(10),
      deltaStr.padStart(10),
      `${r.latencyAvg.toFixed(2)}ms`.padStart(10),
      `${r.latencyP50.toFixed(2)}ms`.padStart(8),
      `${r.latencyP99.toFixed(2)}ms`.padStart(8),
      `${r.latencyP999.toFixed(2)}ms`.padStart(8),
    ].join(' ')
    console.log(`  ${line}`)
  }

  console.log('')
}

function saveResults(results: AggregatedResult[], scenario: Scenario, passes: number) {
  const sorted = [...results].sort((a, b) => b.reqPerSecAvg - a.reqPerSecAvg)
  const leader = sorted[0]?.reqPerSecAvg ?? 0

  const now = new Date()
  const ts = now.toISOString().replace(/[T:]/g, '-').slice(0, 16)
  const type = scenario === 'get-api' || scenario === 'post-api' ? 'realistic' : 'synthetic'
  const dir = join(SCRIPT_DIR, 'tmp', 'benchmarks', type)
  const file = join(dir, `${scenario}_${ts}.txt`)

  const lines: string[] = [
    `Benchmark Results — ${scenario.toUpperCase()} ${SCENARIOS[scenario].path}`,
    `Date: ${now.toISOString()}`,
    `connections: ${CONNECTIONS} | duration: ${DURATION}s | warmup: ${WARMUP_DURATION}s | passes: ${passes} | pipelining: 1`,
    '',
    [
      'Framework'.padEnd(26),
      'Req/sec (avg)'.padStart(15),
      '± stddev'.padStart(10),
      'Δ leader'.padStart(10),
      'Lat avg'.padStart(10),
      'p50'.padStart(8),
      'p99'.padStart(8),
      'p99.9'.padStart(8),
    ].join(' '),
    '─'.repeat(97),
  ]

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    const delta = leader > 0 ? ((r.reqPerSecAvg - leader) / leader * 100) : 0
    const deltaStr = i === 0 ? '—' : `${delta.toFixed(1)}%`
    lines.push([
      r.name.padEnd(26),
      fmt(r.reqPerSecAvg).padStart(15),
      `±${fmt(r.reqPerSecStddev)}`.padStart(10),
      deltaStr.padStart(10),
      `${r.latencyAvg.toFixed(2)}ms`.padStart(10),
      `${r.latencyP50.toFixed(2)}ms`.padStart(8),
      `${r.latencyP99.toFixed(2)}ms`.padStart(8),
      `${r.latencyP999.toFixed(2)}ms`.padStart(8),
    ].join(' '))
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(file, lines.join('\n') + '\n')
  console.log(c.dim(`  Results saved to ${file}`))
}

// ─── CLI selection ──────────────────────────────────────────

interface RunConfig {
  scenarios: Scenario[]
  passes: number
  selectedFrameworks?: FrameworkId[]
  selectedRuntime?: Runtime
  selectAll: boolean
}

function parseArg(args: string[], prefix: string): string | undefined {
  const arg = args.find(a => a.startsWith(`--${prefix}=`))
  return arg?.slice(prefix.length + 3)
}

async function selectConfig(availableRuntimes: Set<Runtime>): Promise<RunConfig> {
  const args = process.argv.slice(2)

  // Parse CLI flags
  const selectAll = args.includes('--all')
  let scenarios = parseArg(args, 'scenario')?.split(',') as Scenario[] | undefined
  let passes = parseArg(args, 'passes') ? parseInt(parseArg(args, 'passes')!, 10) : undefined
  let selectedFrameworks = parseArg(args, 'only')?.split(',') as FrameworkId[] | undefined
  let selectedRuntime = parseArg(args, 'runtime') as Runtime | undefined

  // Interactive mode
  const hasSelectionFlags = selectAll || selectedFrameworks || selectedRuntime
  if (!hasSelectionFlags) {
    if (!scenarios) {
      const scenarioSelection = await checkbox<Scenario | 'all'>({
        message: 'Select benchmark scenarios',
        choices: [
          { name: '★ All scenarios', value: 'all' as const },
          { name: 'GET /          — Hello World', value: 'get' },
          { name: 'POST /json     — JSON Body Parse + UUID', value: 'post' },
          { name: 'GET /api/...   — CORS + JWT + Params', value: 'get-api' },
          { name: 'POST /api/...  — CORS + JWT + Body + Params + Query + Header + UUID', value: 'post-api' },
        ],
        required: true,
      })

      scenarios = scenarioSelection.includes('all')
        ? ['get', 'post', 'get-api', 'post-api']
        : scenarioSelection.filter((v): v is Scenario => v !== 'all')
    }

    if (!passes) {
      passes = await select<number>({
        message: 'Number of passes per server',
        choices: [
          { name: '1 (quick ~35s/server)', value: 1 },
          { name: '3 (recommended ~1.5m/server)', value: 3 },
          { name: '5 (thorough ~2.5m/server)', value: 5 },
        ],
        default: 3,
      })
    }

    const hasApiScenario = scenarios.some(s => s === 'get-api' || s === 'post-api')
    const hasBaseScenario = scenarios.some(s => s === 'get' || s === 'post')
    const frameworkChoices = hasApiScenario && !hasBaseScenario
      ? FRAMEWORKS.filter(f => !f.id.startsWith('raw'))
      : FRAMEWORKS

    const frameworkSelection = await checkbox<FrameworkId | 'all'>({
      message: 'Select frameworks to benchmark',
      choices: [
        { name: '★ All frameworks', value: 'all' as const },
        ...frameworkChoices.map(f => ({ name: f.name, value: f.id })),
      ],
      required: true,
    })

    selectedFrameworks = frameworkSelection.includes('all')
      ? frameworkChoices.map(f => f.id)
      : frameworkSelection.filter((v): v is FrameworkId => v !== 'all')

    const runtimeChoices: { name: string; value: Runtime | 'all' }[] = [
      { name: 'All available', value: 'all' },
      ...[...availableRuntimes].map(r => ({ name: `${r} only`, value: r as Runtime | 'all' })),
    ]

    selectedRuntime = await select<Runtime | 'all'>({
      message: 'Select runtime',
      choices: runtimeChoices,
    }).then(v => v === 'all' ? undefined : v)
  }

  return {
    scenarios: scenarios ?? ['get'],
    passes: passes ?? 3,
    selectedFrameworks,
    selectedRuntime,
    selectAll,
  }
}

// ─── Main ───────────────────────────────────────────────────

function reportMiiaVersions() {
  const names = ['@miiajs/core', '@miiajs/node-server', '@miiajs/uws-server']
  console.log(c.bold('  MiiaJS Packages:'))
  for (const name of names) {
    try {
      const pkgPath = join(SCRIPT_DIR, 'node_modules', name, 'package.json')
      const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'))
      // bun `file:` installs create per-file symlinks pointing at the source dir.
      // Detect local mode by checking whether package.json itself is a symlink.
      const linked = lstatSync(pkgPath).isSymbolicLink()
      const target = linked ? dirname(realpathSync(pkgPath)) : null
      const tag = linked ? c.yellow(`[local → ${target}]`) : c.dim('[npm]')
      console.log(`    ${c.green('✓')} ${name}@${version} ${tag}`)
    } catch {
      console.log(`    ${c.red('✗')} ${name} ${c.dim('[not installed]')}`)
    }
  }
  console.log('')
}

async function main() {
  console.log(c.bold(c.cyan(`
  ╔═══════════════════════════════════════════╗
  ║   MiiaJS HTTP Benchmark                   ║
  ╚═══════════════════════════════════════════╝
`)))

  reportMiiaVersions()

  // Detect runtimes
  console.log(c.bold('  Runtime Detection:'))
  const availableRuntimes = detectRuntimes()
  console.log('')

  if (availableRuntimes.size === 0) {
    console.log(c.red('  No runtimes detected. Install bun, node, or deno.'))
    return
  }

  const config = await selectConfig(availableRuntimes)
  const { scenarios, passes, selectedFrameworks, selectedRuntime, selectAll } = config

  for (const scenario of scenarios) {
    const scenarioConfig = SCENARIOS[scenario]
    let servers = getServers(scenario).filter(s => availableRuntimes.has(s.runtime))

    if (!selectAll) {
      if (selectedFrameworks) {
        servers = servers.filter(s => selectedFrameworks.includes(s.framework))
      }
      if (selectedRuntime) {
        servers = servers.filter(s => s.runtime === selectedRuntime)
      }
    }

    if (servers.length === 0) {
      console.log(c.yellow(`\n  No servers matched for scenario ${scenario.toUpperCase()}. Skipping.`))
      continue
    }

    const shuffled = shuffle(servers)
    console.log(c.dim(`\n  Running ${shuffled.length} benchmark(s): ${shuffled.map(s => s.name).join(', ')}`))
    console.log(c.dim(`  Scenario: ${scenario.toUpperCase()} ${scenarioConfig.path}`))
    console.log(c.dim(`  ${CONNECTIONS} connections, ${DURATION}s duration, ${WARMUP_DURATION}s warmup, ${passes} pass(es)\n`))

    const results: AggregatedResult[] = []

    for (let i = 0; i < shuffled.length; i++) {
      console.log(c.dim(`\n[${i + 1}/${shuffled.length}]`))
      try {
        const result = await benchmarkServer(shuffled[i], scenarioConfig, passes)
        if (result) results.push(result)
      } catch (err) {
        console.log(c.red(`  ERROR: ${err}`))
      }
    }

    printResults(results, scenario, passes)
    saveResults(results, scenario, passes)
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nInterrupted. Exiting...')
  process.exit(1)
})

main()
