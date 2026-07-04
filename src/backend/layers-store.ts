import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { loadConfig } from './config-store'
import type { Layer } from './flow'

/**
 * The flow-layers channel: the per-repo review-flow layers (the ordered
 * `{ label, pattern }` rules that group changes entry-point → data), keyed by
 * absolute repo path, in `~/.porcelain/layers.json` (same fixed home-dir rationale
 * as the review-set / board / notes channels — a plain `node` MCP process can't
 * resolve userData). TWO-WAY: the app authors layers (Settings → Review flow) and
 * the MCP server (src/mcp/layers-file.ts) does the same (get/set/reset_flow_layers),
 * so an agent can tailor the grouping to a repo it understands. Atomic (tmp + rename)
 * + in-process-serialized writes; a cross-process race is rare/low-stakes and the
 * watcher re-syncs. Absence of a repo's entry = Porcelain applies DEFAULT_LAYERS.
 *
 * Layers moved here out of userData/config.json (where they used to live, alongside
 * notes) precisely so the dependency-free MCP can read+write them; see
 * migrateLayersFromConfig.
 */
const layerSchema = z.object({ label: z.string(), pattern: z.string() })
export const layersSchema = z.record(z.string(), z.array(layerSchema))

export function layersPath(): string {
  // Must match src/mcp/layers-file.ts. PORCELAIN_LAYERS redirects both sides for tests.
  return process.env.PORCELAIN_LAYERS ?? join(homedir(), '.porcelain', 'layers.json')
}

// A pattern the flow grouper can compile. The file is externally owned (the MCP
// writes it), so we drop any layer whose pattern is not a valid regex on read —
// otherwise `compileLayers` (flow.ts) would throw and break every grouping view.
function compilable(layer: Layer): boolean {
  if (layer.label.trim() === '' || layer.pattern === '') return false
  try {
    new RegExp(layer.pattern)
    return true
  } catch {
    return false
  }
}

async function readAll(): Promise<Record<string, Layer[]>> {
  let parsed: z.infer<typeof layersSchema>
  try {
    parsed = layersSchema.parse(JSON.parse(await readFile(layersPath(), 'utf8')))
  } catch {
    // absent, unparseable, or schema-invalid — treat as empty
    return {}
  }
  const all: Record<string, Layer[]> = {}
  for (const [repoPath, layers] of Object.entries(parsed)) {
    const valid = layers.filter(compilable)
    if (valid.length > 0) all[repoPath] = valid
  }
  return all
}

async function writeAll(all: Record<string, Layer[]>): Promise<void> {
  const path = layersPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}

// Serialize app-side read-modify-write so two quick saves never drop a write.
let chain: Promise<void> = Promise.resolve()
function mutate<T>(fn: (all: Record<string, Layer[]>) => T): Promise<T> {
  const run = chain.then(async () => {
    const all = await readAll()
    const result = fn(all)
    await writeAll(all)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** The repo's custom flow layers, or null when none is set (→ Porcelain uses defaults). */
export async function readLayers(repoPath: string): Promise<Layer[] | null> {
  return (await readAll())[repoPath] ?? null
}

/** Set a repo's flow layers; `null` clears the override back to the defaults. */
export async function writeLayers(repoPath: string, layers: Layer[] | null): Promise<void> {
  await mutate((all) => {
    if (layers === null) delete all[repoPath]
    else all[repoPath] = layers
  })
}

/**
 * One-time migration: layers used to live in userData/config.json
 * (`config.repos[*].layers`). Copy any legacy override into layers.json so the
 * MCP — which can't resolve userData — can read+write it. Idempotent: only fills a
 * repo whose layers.json entry is absent, so it no-ops once migrated and never
 * clobbers a newer in-app edit. Runs at startup, before any window reads layers.
 */
export async function migrateLayersFromConfig(): Promise<void> {
  const config = await loadConfig()
  const legacy = Object.entries(config.repos).filter(([, repo]) => repo.layers?.length)
  if (legacy.length === 0) return
  await mutate((all) => {
    for (const [repoPath, repo] of legacy) {
      if (all[repoPath] === undefined && repo.layers?.length) all[repoPath] = repo.layers
    }
  })
}
