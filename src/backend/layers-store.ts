import { z } from 'zod'
import type { Layer } from './flow'
import { createHomeChannel } from './home-channel'

/**
 * The flow-layers channel: the per-repo review-flow layers (the ordered
 * `{ label, pattern }` rules that group changes entry-point → data), keyed by
 * absolute repo path, in `~/.porcelain/layers.json` (same fixed home-dir rationale
 * as the review-set / board / notes channels — a plain `node` CLI process can't
 * resolve userData). TWO-WAY: the app authors layers (Settings → Review flow) and
 * the porcelain CLI (src/cli/layers-file.ts) does the same (layers get/set/reset),
 * so an agent can tailor the grouping to a repo it understands. Atomic (tmp + rename)
 * + in-process-serialized writes; a cross-process race is rare/low-stakes and the
 * watcher re-syncs. Absence of a repo's entry = Porcelain applies DEFAULT_LAYERS
 * (Docs + Agents starters — not a fat framework stack).
 */
const layerSchema = z.object({ label: z.string(), pattern: z.string() })
export const layersSchema = z.record(z.string(), z.array(layerSchema))

// A pattern the flow grouper can compile. The file is externally owned (the CLI
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

// Drop uncompilable patterns on read, and any repo whose layers all drop.
function keepCompilable(parsed: Record<string, Layer[]>): Record<string, Layer[]> {
  const all: Record<string, Layer[]> = {}
  for (const [repoPath, layers] of Object.entries(parsed)) {
    const valid = layers.filter(compilable)
    if (valid.length > 0) all[repoPath] = valid
  }
  return all
}

const channel = createHomeChannel({
  envVar: 'PORCELAIN_LAYERS',
  fileName: 'layers.json',
  schema: layersSchema,
  empty: (): Record<string, Layer[]> => ({}),
  transform: keepCompilable,
})

// Must match src/cli/layers-file.ts. PORCELAIN_LAYERS redirects both sides for tests.
export const layersPath: () => string = channel.path

/** The repo's custom flow layers, or null when none is set (→ Docs + Agents starters). */
export async function readLayers(repoPath: string): Promise<Layer[] | null> {
  return (await channel.readAll())[repoPath] ?? null
}

/** Set a repo's flow layers; `null` clears the override back to the starters. */
export async function writeLayers(repoPath: string, layers: Layer[] | null): Promise<void> {
  await channel.mutate((all) => {
    if (layers === null) delete all[repoPath]
    else all[repoPath] = layers
  })
}
