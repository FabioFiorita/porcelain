import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  INTENT_MANIFEST,
  projectEvidenceDir,
  projectEvidenceResultsDir,
  projectIntentDir,
} from '@shared/project-porcelain'
import { z } from 'zod'
import { inlineLocalAssets } from '../fs/evidence-assets'

/**
 * A document set on disk, rendered as ordered tabs. One primitive, two users:
 * Intent (`active-review/intent/`) and the Results sub-tab of Evidence
 * (`active-review/evidence/results/`).
 *
 * An agent explaining or proving a change should be able to reach for the medium
 * that carries it — prose for a rationale, a styled page for a before/after.
 * More than one file becomes more than one tab.
 *
 * Rendering rules are the ones the app already earned, unchanged:
 * - markdown renders through react-markdown WITHOUT rehype-raw (escaped),
 * - html renders ONLY through `<iframe sandbox="" srcdoc>`, with its siblings
 *   (CSS, images) inlined here so relative paths resolve without ever handing
 *   the iframe a `src` URL — a srcdoc document inherits the parent CSP, and that
 *   CSP is the exfil backstop. Serving a doc set over HTTP would drop it.
 *
 * Those two media are the whole story on every client — web, shell, and mobile.
 * A file with any other extension is skipped, not surfaced as a broken tab.
 *
 * There is deliberately no script medium. Scripts would need `allow-scripts`,
 * and a review is now something you can receive from a clone — that is someone
 * else's JavaScript in your renderer, for a capability nothing needs yet.
 */

const MAX_DOCS = 12
const MAX_DOC_BYTES = 2 * 1024 * 1024
const MAX_TOTAL_BYTES = 8 * 1024 * 1024

/** Legacy single-page evidence, from before Evidence had sub-tabs. */
const LEGACY_REPORT_FILES = ['index.html', 'index.htm'] as const

/**
 * What a pack's `index` document is called in the tab strip. The legacy root
 * report has always been "Report"; `results/index.html` — the same document, one
 * directory down — read as "Index" until a manifest renamed it.
 */
const REPORT_LABEL = 'Report'

export type DocMedium = 'markdown' | 'html'

interface ReviewDocBase {
  /** Stable per review — the file name, used as the tab key. */
  file: string
  label: string
}

/**
 * Discriminated on medium so the renderer never has to parse. Every read and
 * every cap is applied HERE: the clients are pure UI with no Node APIs, and a
 * parse that needs `Buffer` takes the whole surface down in a renderer.
 */
export type ReviewDoc =
  | (ReviewDocBase & { medium: 'markdown'; body: string })
  | (ReviewDocBase & { medium: 'html'; body: string })

const manifestSchema = z.object({
  tabs: z
    .array(z.object({ file: z.string().min(1), label: z.string().min(1).max(60).optional() }))
    .max(MAX_DOCS)
    .default([]),
})

const MEDIUM_BY_EXT: Record<string, DocMedium> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
}

function mediumFor(file: string): DocMedium | null {
  return MEDIUM_BY_EXT[extname(file).toLowerCase()] ?? null
}

/** `index.md` → "Index"; `data-flow.html` → "Data flow". */
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

async function renderableNames(dir: string, exclude: ReadonlySet<string>): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  return entries.filter(
    (file) => isPlainFileName(file) && mediumFor(file) !== null && !exclude.has(file.toLowerCase()),
  )
}

export interface DocSetOptions {
  /**
   * Containment root for a document's relative images and stylesheets, when it
   * is wider than the document's own directory — Results docs live one level
   * down and reference `../assets/`, the gallery the Assets tab lists.
   * Resolution still starts at the document's directory.
   */
  assetRoot?: string
  /**
   * Extra directories scanned after `dir`, in order, for renderable files the
   * primary directory does not already claim by name. Legacy packs wrote loose
   * docs at the evidence root; they keep rendering without a migration.
   */
  alsoScan?: readonly string[]
  /**
   * File names skipped in the `alsoScan` directories only (case-insensitive).
   *
   * Deliberately NOT applied to `dir`: the caller excludes `index.html` so the
   * legacy root report is not listed twice, and applying that to the primary
   * directory silently swallowed a modern `evidence/results/index.html` — the
   * most obvious name an agent would give its report.
   */
  excludeFromAlsoScan?: readonly string[]
  /**
   * Reader-facing labels for specific file names (case-insensitive), used only
   * when the manifest names no label. `index.html` is the most obvious name for
   * a pack's report and the derived label for it is "Index" — a filename
   * artifact nobody wrote. A manifest label still wins.
   */
  defaultLabels?: Readonly<Record<string, string>>
}

interface QueuedDoc {
  file: string
  label?: string
  dir: string
}

/**
 * The documents for a directory, in manifest order. Files the manifest omits
 * follow in name order, so dropping a file in still shows up — an agent that
 * writes one `why.md` should not have to also write a manifest.
 *
 * Caps are per set: at most `MAX_DOCS` tabs, `MAX_DOC_BYTES` each,
 * `MAX_TOTAL_BYTES` in total. Over-cap documents are dropped, never thrown.
 */
export async function readDocSet(dir: string, options: DocSetOptions = {}): Promise<ReviewDoc[]> {
  const exclude = new Set((options.excludeFromAlsoScan ?? []).map((name) => name.toLowerCase()))
  const renderable = await renderableNames(dir, new Set())
  const ordered = await readManifestOrder(dir)
  const seen = new Set<string>()
  const queue: QueuedDoc[] = []
  for (const tab of ordered) {
    if (!renderable.includes(tab.file) || seen.has(tab.file)) continue
    seen.add(tab.file)
    queue.push({ ...tab, dir })
  }
  for (const file of renderable.sort()) {
    if (seen.has(file)) continue
    seen.add(file)
    queue.push({ file, dir })
  }
  for (const extra of options.alsoScan ?? []) {
    for (const file of (await renderableNames(extra, exclude)).sort()) {
      if (seen.has(file)) continue
      seen.add(file)
      queue.push({ file, dir: extra })
    }
  }

  const docs: ReviewDoc[] = []
  let total = 0
  const defaults = options.defaultLabels ?? {}
  for (const tab of queue.slice(0, MAX_DOCS)) {
    const labelled =
      tab.label === undefined ? { ...tab, label: defaults[tab.file.toLowerCase()] } : tab
    const doc = await readDoc(labelled, options.assetRoot, MAX_TOTAL_BYTES - total)
    if (doc === null) continue
    total += Buffer.byteLength(doc.body, 'utf8')
    docs.push(doc)
  }
  return withUniqueLabels(docs)
}

/**
 * Tab labels the human can tell apart. Two tabs reading "Report" is a strip
 * nobody can navigate, and the ways to get there are many: two default-labelled
 * files (`index.html` and `index.htm` in one pack), a manifest that names two
 * tabs the same, or a legacy report meeting a modern one. The rule is uniform —
 * the first doc keeps the label, a later collision is qualified by its file name
 * — so no caller has to remember a special case.
 */
function withUniqueLabels(docs: readonly ReviewDoc[]): ReviewDoc[] {
  const taken = new Set<string>()
  return docs.map((doc) => {
    if (!taken.has(doc.label)) {
      taken.add(doc.label)
      return doc
    }
    let label = `${doc.label} (${doc.file})`
    // `file` is unique per set, so this only spins on a manifest that authored
    // the qualified name itself.
    for (let n = 2; taken.has(label); n += 1) label = `${doc.label} (${doc.file} ${n})`
    taken.add(label)
    return { ...doc, label }
  })
}

/** One document, or null when it is unreadable, unrenderable, or over a cap. */
async function readDoc(
  tab: QueuedDoc,
  assetRoot: string | undefined,
  remainingBytes: number,
): Promise<ReviewDoc | null> {
  const medium = mediumFor(tab.file)
  if (medium === null) return null
  const path = join(tab.dir, tab.file)
  try {
    const size = (await stat(path)).size
    // Bounded on read like every other externally-authored channel: one huge
    // file must not take the surface down, and it is dropped, not thrown.
    if (size > MAX_DOC_BYTES || size > remainingBytes) return null
    const raw = await readFile(path, 'utf8')
    const body =
      medium === 'html' ? await inlineLocalAssets(tab.dir, raw, assetRoot ?? tab.dir) : raw
    // Inlining can expand an HTML doc well past its on-disk size — each local
    // image/stylesheet reference is read and base64'd in full with no cap of its
    // own, so the raw-size check above is not enough once assets are inlined.
    const bodyBytes = Buffer.byteLength(body, 'utf8')
    if (bodyBytes > MAX_DOC_BYTES || bodyBytes > remainingBytes) return null
    return { file: tab.file, label: tab.label ?? labelFor(tab.file), medium, body }
  } catch {
    // unreadable or not valid utf8 — skip it, keep the rest of the tabs
    return null
  }
}

/** Intent documents for the checkout's active review. */
export function readActiveIntentDocs(repoPath: string): Promise<ReviewDoc[]> {
  return readDocSet(projectIntentDir(repoPath))
}

/**
 * The Results sub-tab of Evidence: `evidence/results/` read as a document set,
 * with the evidence directory as the asset root so `../assets/shot.png` — the
 * same image the Assets gallery lists — inlines into a sandboxed report.
 *
 * Two legacy shapes still render, because a pack written last month is still
 * proof: loose `*.md` / `*.html` at the evidence root, and the single
 * `index.html` from before Evidence had sub-tabs, surfaced first as "Report".
 *
 * A pack can hold BOTH — `evidence/index.html` and `evidence/results/index.html`
 * are two files, in two directories, written by two generations of agent. Both
 * render; the legacy one gives up the bare `index.html` tab key, because `file`
 * is what every client uses as the key, and the "Report" name with it, because
 * two tabs reading "Report" is a strip the human cannot navigate.
 */
export async function readActiveEvidenceResults(repoPath: string): Promise<ReviewDoc[]> {
  const evidenceDir = projectEvidenceDir(repoPath)
  const docs = await readDocSet(projectEvidenceResultsDir(repoPath), {
    assetRoot: evidenceDir,
    alsoScan: [evidenceDir],
    excludeFromAlsoScan: LEGACY_REPORT_FILES,
    defaultLabels: { 'index.html': REPORT_LABEL, 'index.htm': REPORT_LABEL },
  })
  const report = await readLegacyReport(evidenceDir)
  if (report === null) return docs
  const taken = new Set(docs.map((doc) => doc.file))
  // `../index.html` is the legacy file's path from the results directory: stable,
  // honest about where it came from, and never a name a scanned directory yields
  // (those are plain file names, with no separator in them).
  const keyed = taken.has(report.file)
    ? { ...report, file: `../${report.file}`, label: 'Earlier report' }
    : report
  // The legacy report is joined to a set that was made unique on its own; only
  // this last merge can put two "Report"s next to each other (a legacy
  // `index.htm` beside a modern `index.html`, say).
  return withUniqueLabels([keyed, ...docs])
}

async function readLegacyReport(evidenceDir: string): Promise<ReviewDoc | null> {
  for (const file of LEGACY_REPORT_FILES) {
    const doc = await readDoc(
      { file, label: REPORT_LABEL, dir: evidenceDir },
      evidenceDir,
      MAX_DOC_BYTES,
    )
    if (doc !== null) return doc
  }
  return null
}
