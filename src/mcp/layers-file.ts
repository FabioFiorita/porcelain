import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see protocol.ts. The flow-layers channel: the per-repo review-flow
// layers the human (Porcelain app, layers-store.ts) and the agent (here) both manage.
// A layer is an ordered { label, pattern } rule; a changed file belongs to the
// furthest-right matching layer, and Porcelain renders the groups in declared order
// (entry-point → data). TWO-WAY: the agent reads the layers and replaces the whole
// ordered set to tailor the grouping to a repo it understands. Atomic writes
// (tmp + rename); the app re-validates on read (and drops uncompilable patterns).

export interface Layer {
  label: string
  pattern: string
}

// Kept in sync with DEFAULT_LAYERS in src/main/flow.ts (the app's source of truth);
// layers-file.test.ts asserts the two are identical so this copy can't drift. We
// duplicate rather than import so this server stays a dependency-free island that
// never reaches into src/main. Shown by get_flow_layers as the starting point when a
// repo has no custom set, and what reset_flow_layers falls back to.
export const DEFAULT_LAYERS: Layer[] = [
  { label: 'Pages', pattern: '(^|/)(pages|views|screens|app)/' },
  { label: 'Components', pattern: '(^|/)components?/' },
  { label: 'Hooks', pattern: '(^|/)hooks?/' },
  { label: 'Queries', pattern: '(^|/)(queries|mutations|api-client|client)/' },
  { label: 'Routes', pattern: '(^|/)(routes?|router|api)/' },
  { label: 'Controllers', pattern: '(^|/)controllers?/' },
  { label: 'Services', pattern: '(^|/)services?/' },
  { label: 'Modules', pattern: '(^|/)modules?/' },
  { label: 'Data', pattern: '(^|/)(prisma|schema|models?|entities|repositories)/' },
  { label: 'Tests', pattern: '\\.(test|spec)\\.[a-z]+$' },
]

type Layers = Record<string, Layer[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export function layersPath(): string {
  return process.env.PORCELAIN_LAYERS ?? join(homedir(), '.porcelain', 'layers.json')
}

// Lenient parse of our own file: skip malformed/uncompilable layers, never throw.
function parseLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) return []
  const layers: Layer[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const { label, pattern } = item
    if (typeof label !== 'string' || label.trim() === '') continue
    if (typeof pattern !== 'string' || pattern === '' || !isValidPattern(pattern)) continue
    layers.push({ label, pattern })
  }
  return layers
}

function readAll(): Layers {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(layersPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Layers = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    const layers = parseLayers(value)
    if (layers.length > 0) all[repoPath] = layers
  }
  return all
}

function writeAll(all: Layers): void {
  const path = layersPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

/**
 * Coerce arbitrary tool input into a validated, ordered layer set; throws on bad
 * shape so set_flow_layers reports a clear error. Requires at least one layer — an
 * empty set is reset_flow_layers, not a set. Rejects uncompilable patterns up front
 * (the app would otherwise drop them on read).
 */
export function toLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) throw new Error('layers must be an array')
  if (value.length === 0) {
    throw new Error('layers must have at least one entry (use reset_flow_layers to clear)')
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`layers[${index}] must be an object`)
    const { label, pattern } = item
    if (typeof label !== 'string' || label.trim() === '') {
      throw new Error(`layers[${index}].label must be a non-empty string`)
    }
    if (typeof pattern !== 'string' || pattern === '') {
      throw new Error(`layers[${index}].pattern must be a non-empty string`)
    }
    if (!isValidPattern(pattern)) {
      throw new Error(`layers[${index}].pattern is not a valid regular expression`)
    }
    return { label, pattern }
  })
}

/** The repo's custom flow layers, or null when none is set (→ Porcelain uses defaults). */
export function readLayers(repoPath: string): Layer[] | null {
  return readAll()[repoPath] ?? null
}

export function setLayers(repoPath: string, layers: Layer[]): void {
  const all = readAll()
  all[repoPath] = layers
  writeAll(all)
}

export function clearLayers(repoPath: string): void {
  const all = readAll()
  if (!(repoPath in all)) return
  delete all[repoPath]
  writeAll(all)
}

const renderList = (layers: readonly Layer[]): string =>
  layers.map((l, i) => `  ${i + 1}. ${l.label} — /${l.pattern}/`).join('\n')

/**
 * Render a repo's flow layers for get_flow_layers: the effective ordered set (custom
 * if set, else the defaults), shown as a numbered list AND as JSON so an agent can
 * round-trip an idempotent edit (read → modify → set_flow_layers). A file belongs to
 * the furthest-right matching layer; unmatched files fall into "Other" (rendered last).
 */
export function describeLayers(repoPath: string, layers: Layer[] | null): string {
  if (!layers) {
    return `No custom flow layers for ${repoPath}; Porcelain applies its built-in defaults (entry-point → data):\n${renderList(DEFAULT_LAYERS)}\n\nReplace them with set_flow_layers (the full ordered list), tailored to this repo's structure. The defaults as JSON:\n${JSON.stringify(DEFAULT_LAYERS, null, 2)}`
  }
  return `Custom flow layers for ${repoPath} (${layers.length}, entry-point → data):\n${renderList(layers)}\n\nEdit by sending the full ordered list to set_flow_layers, or reset_flow_layers to return to the defaults. As JSON:\n${JSON.stringify(layers, null, 2)}`
}
