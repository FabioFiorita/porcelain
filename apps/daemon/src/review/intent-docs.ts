import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { INTENT_MANIFEST, projectIntentDir } from '@shared/project-porcelain'
import { z } from 'zod'
import { inlineLocalAssets } from '../fs/evidence-assets'

/**
 * Intent as a set of documents on disk (`.porcelain/intent/`), not one field.
 *
 * An agent explaining a change should be able to reach for the medium that
 * carries it — prose for a rationale, a diagram for a data flow, a styled page
 * for a before/after. More than one file becomes more than one tab.
 *
 * Rendering rules are the ones the app already earned, unchanged:
 * - markdown renders through react-markdown WITHOUT rehype-raw (escaped),
 * - html renders ONLY through `<iframe sandbox="" srcdoc>`, with its siblings
 *   (CSS, images) inlined here so relative paths resolve without ever handing
 *   the iframe a `src` URL — a srcdoc document inherits the parent CSP, and that
 *   CSP is the exfil backstop. Serving intent over HTTP would drop it.
 * - excalidraw is inert JSON handed to the read-only host.
 *
 * There is deliberately no script medium. Scripts would need `allow-scripts`,
 * and a review is now something you can receive from a clone — that is someone
 * else's JavaScript in your renderer, for a capability nothing needs yet.
 */

const MAX_DOCS = 12
const MAX_DOC_BYTES = 2 * 1024 * 1024
const MAX_TOTAL_BYTES = 8 * 1024 * 1024

export type IntentMedium = 'markdown' | 'html' | 'excalidraw'

export interface IntentDoc {
  /** Stable per review — the file name, used as the tab key. */
  file: string
  label: string
  medium: IntentMedium
  /** Markdown source, self-contained HTML, or an Excalidraw scene as JSON text. */
  body: string
}

const manifestSchema = z.object({
  tabs: z
    .array(z.object({ file: z.string().min(1), label: z.string().min(1).max(60).optional() }))
    .max(MAX_DOCS)
    .default([]),
})

const MEDIUM_BY_EXT: Record<string, IntentMedium> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.excalidraw': 'excalidraw',
}

function mediumFor(file: string): IntentMedium | null {
  return MEDIUM_BY_EXT[extname(file).toLowerCase()] ?? null
}

/** `index.md` → "Index"; `data-flow.excalidraw` → "Data flow". */
function labelFor(file: string): string {
  const base = file.slice(0, file.length - extname(file).length).replace(/[-_]+/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * A file name and nothing else — no directory part, no traversal. The manifest is
 * authored by an external process, and these names reach `readFile`.
 */
function isPlainFileName(name: string): boolean {
  return name !== '' && !name.includes('/') && !name.includes('\\') && !name.startsWith('.')
}

async function readManifestOrder(dir: string): Promise<Array<{ file: string; label?: string }>> {
  try {
    const parsed = manifestSchema.safeParse(
      JSON.parse(await readFile(join(dir, INTENT_MANIFEST), 'utf8')),
    )
    if (!parsed.success) return []
    return parsed.data.tabs.filter((tab) => isPlainFileName(tab.file))
  } catch {
    return []
  }
}

/**
 * The intent documents for a review directory, in manifest order. Files the
 * manifest omits follow in name order, so dropping a file in still shows up —
 * an agent that writes one `index.md` should not have to also write a manifest.
 */
export async function readIntentDocs(dir: string): Promise<IntentDoc[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const renderable = entries.filter((file) => isPlainFileName(file) && mediumFor(file) !== null)
  const ordered = await readManifestOrder(dir)
  const seen = new Set<string>()
  const queue: Array<{ file: string; label?: string }> = []
  for (const tab of ordered) {
    if (!renderable.includes(tab.file) || seen.has(tab.file)) continue
    seen.add(tab.file)
    queue.push(tab)
  }
  for (const file of renderable.sort()) {
    if (seen.has(file)) continue
    seen.add(file)
    queue.push({ file })
  }

  const docs: IntentDoc[] = []
  let total = 0
  for (const tab of queue.slice(0, MAX_DOCS)) {
    const medium = mediumFor(tab.file)
    if (medium === null) continue
    const path = join(dir, tab.file)
    try {
      const size = (await stat(path)).size
      // Bounded on read like every other externally-authored channel: one huge
      // file must not take the surface down, and it is dropped, not thrown.
      if (size > MAX_DOC_BYTES || total + size > MAX_TOTAL_BYTES) continue
      const raw = await readFile(path, 'utf8')
      const body = medium === 'html' ? await inlineLocalAssets(dir, raw) : raw
      total += Buffer.byteLength(body, 'utf8')
      docs.push({ file: tab.file, label: tab.label ?? labelFor(tab.file), medium, body })
    } catch {
      // unreadable or not valid utf8 — skip it, keep the rest of the tabs
    }
  }
  return docs
}

/** Intent documents for the checkout's active review. */
export function readActiveIntentDocs(repoPath: string): Promise<IntentDoc[]> {
  return readIntentDocs(projectIntentDir(repoPath))
}
