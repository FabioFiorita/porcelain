import { join } from 'node:path'
import {
  type AssetCandidate,
  listCopyableAssets,
  readJsonFile,
  readTextFile,
} from './companion-migration-store'
import {
  ASSETS_DIR,
  EVIDENCE_RESULTS_DIR,
  PROJECT_EVIDENCE_DIR,
  PROJECT_INTENT_DIR,
} from './project-porcelain'
import {
  buildReviewCanvas,
  escapeHtml,
  htmlFragment,
  joinReviewBlocks,
  type ReviewCanvasBundle,
  type ReviewCheckRow,
  type ReviewSectionId,
  renderReviewChecks,
  renderReviewFiles,
  renderReviewGallery,
  writeReviewCanvasBundle,
} from './review-canvas'

/**
 * Legacy Review → Canvas bundle (#27, decision 2a).
 *
 * A repo-local review was five things in one directory: `review.json` (name,
 * thesis, files, walkthrough sections), `intent/` (a document set), and
 * `evidence/` (structured checks, a `results/` document set, and an `assets/`
 * gallery). The Canvas Review template is four sections — Intent, Process,
 * Execution, Evidence — so the mapping is fixed rather than clever:
 *
 * - **Intent**    ← the thesis plus the `intent/` document set (the case for the change)
 * - **Process**   ← the walkthrough sections (how the change was made)
 * - **Execution** ← the declared review files (what actually changed)
 * - **Evidence**  ← the checks table, the `results/` documents, and the gallery
 *
 * Nothing is dropped silently: a source with no content for a section still gets
 * the section, marked empty, so a reader can tell "there was none" from "it was
 * lost". Assets are COPIED into the bundle's own `assets/` namespace, which is
 * what makes the migrated Canvas render its screenshots through the existing
 * Viewer with no reference back into a checkout that #28 will empty out.
 */

export type ReviewSourceKind = 'active' | 'archived'

export type ReviewCanvasSource = {
  kind: ReviewSourceKind
  /** Absolute directory: `<repo>/.porcelain/active-review` or `…/reviews/<id>`. */
  dir: string
  /** Archived id, or `active` for the review in flight. */
  sourceId: string
}

export type ReviewConversion = {
  title: string
  /** `html` when any source document or section carried HTML; `markdown` otherwise. */
  kind: 'html' | 'markdown'
  /** The rendered bundle: entry document plus the four section files. */
  bundle: ReviewCanvasBundle
  /** Assets to copy into `<bundle>/assets/`, already confinement-checked. */
  assets: AssetCandidate[]
  /** Legacy asset names the copier refused, with the reason, for the report. */
  rejectedAssets: string[]
  /** Content hash inputs — the migration ledger's fingerprint for this review. */
  fingerprintParts: string[]
  /** `archivedAt` from an archived review's `meta.json`, when it had one. */
  archivedAt?: string
}

type ReviewFile = { path: string; source?: string; note?: string }
type ReviewSection = { title: string; prose: string; html?: string; diagram?: string }
type ReviewSet = {
  name?: string
  thesis?: string
  files?: ReviewFile[]
  sections?: ReviewSection[]
}
type Document = { file: string; label: string; body: string; html: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

function parseReviewSet(raw: unknown): ReviewSet {
  if (!isRecord(raw)) return {}
  const files: ReviewFile[] = []
  if (Array.isArray(raw.files)) {
    for (const entry of raw.files) {
      if (!isRecord(entry)) continue
      const path = text(entry.path)
      if (path === undefined) continue
      files.push({ path, source: text(entry.source), note: text(entry.note) })
    }
  }
  const sections: ReviewSection[] = []
  if (Array.isArray(raw.sections)) {
    for (const entry of raw.sections) {
      if (!isRecord(entry)) continue
      const title = text(entry.title)
      if (title === undefined) continue
      sections.push({
        title,
        prose: typeof entry.prose === 'string' ? entry.prose : '',
        html: text(entry.html),
        diagram: text(entry.diagram),
      })
    }
  }
  return { name: text(raw.name), thesis: text(raw.thesis), files, sections }
}

function parseChecks(raw: unknown): ReviewCheckRow[] {
  if (!isRecord(raw) || !Array.isArray(raw.checks)) return []
  const out: ReviewCheckRow[] = []
  for (const entry of raw.checks) {
    if (!isRecord(entry)) continue
    const label = text(entry.label)
    const status = text(entry.status)
    if (label === undefined || status === undefined) continue
    out.push({ label, status, detail: text(entry.detail) })
  }
  return out
}

/**
 * Read a document set (`intent/`, `evidence/results/`) in its pinned tab order.
 *
 * `meta.json` is the manifest the CLI writes; a set whose manifest is missing or
 * unreadable still migrates, ordered by name, because losing the tab order is a
 * far smaller loss than losing the documents.
 */
async function readDocSet(dir: string): Promise<Document[]> {
  const files = await listCopyableAssets(dir)
  const byName = new Map(files.map((file) => [file.name, file]))
  const manifest = await readJsonFile(join(dir, 'meta.json'))
  const ordered: string[] = []
  if (isRecord(manifest) && Array.isArray(manifest.tabs)) {
    for (const tab of manifest.tabs) {
      if (!isRecord(tab)) continue
      const file = text(tab.file)
      if (file !== undefined && byName.has(file)) ordered.push(file)
    }
  }
  for (const file of files) {
    if (file.name === 'meta.json') continue
    if (!ordered.includes(file.name)) ordered.push(file.name)
  }

  const labels = new Map<string, string>()
  if (isRecord(manifest) && Array.isArray(manifest.tabs)) {
    for (const tab of manifest.tabs) {
      if (!isRecord(tab)) continue
      const file = text(tab.file)
      const label = text(tab.label)
      if (file !== undefined && label !== undefined) labels.set(file, label)
    }
  }

  const docs: Document[] = []
  for (const name of ordered) {
    const extension = extensionOf(name)
    if (extension !== 'md' && extension !== 'html') continue
    const entry = byName.get(name)
    if (entry === undefined) continue
    const body = await readTextFile(entry.path)
    if (body === null) continue
    docs.push({
      file: name,
      label: labels.get(name) ?? name.replace(/\.(?:md|html)$/, ''),
      body,
      html: extension === 'html',
    })
  }
  return docs
}

/** Legacy intent assets lived in `intent/assets/`; the bundle has one flat `assets/`. */
function rewriteAssetPaths(body: string): string {
  return body.replaceAll(`${PROJECT_INTENT_DIR}/${ASSETS_DIR}/`, `${ASSETS_DIR}/`)
}

function documentBlocks(docs: readonly Document[], html: boolean): string[] {
  return docs.map((doc) => {
    const body = rewriteAssetPaths(doc.body)
    if (html) {
      const rendered = doc.html ? htmlFragment(body) : `<pre>${escapeHtml(body)}</pre>`
      return `<h3>${escapeHtml(doc.label)}</h3>\n${rendered}`
    }
    return `### ${doc.label}\n\n${body}`
  })
}

function sectionBlocks(sections: readonly ReviewSection[], html: boolean): string[] {
  return sections.map((section) => {
    if (html) {
      const parts = [
        `<h3>${escapeHtml(section.title)}</h3>`,
        section.prose === '' ? '' : `<pre>${escapeHtml(section.prose)}</pre>`,
        section.diagram ?? '',
        section.html === undefined ? '' : htmlFragment(section.html),
      ]
      return parts.filter((part) => part !== '').join('\n')
    }
    return `### ${section.title}\n\n${section.prose}`
  })
}

/** Read one legacy review directory and build everything the bundle writer needs. */
export async function readReviewConversion(source: ReviewCanvasSource): Promise<ReviewConversion> {
  const reviewRaw = await readJsonFile(join(source.dir, 'review.json'))
  const set = parseReviewSet(reviewRaw)
  const archivedMeta = await readJsonFile(join(source.dir, 'meta.json'))
  const archivedName = isRecord(archivedMeta) ? text(archivedMeta.name) : undefined

  const intentDocs = await readDocSet(join(source.dir, PROJECT_INTENT_DIR))
  const evidenceDir = join(source.dir, PROJECT_EVIDENCE_DIR)
  const resultDocs = await readDocSet(join(evidenceDir, EVIDENCE_RESULTS_DIR))
  const checks = parseChecks(await readJsonFile(join(evidenceDir, 'meta.json')))

  const evidenceAssets = await listCopyableAssets(join(evidenceDir, ASSETS_DIR))
  const intentAssets = await listCopyableAssets(join(source.dir, PROJECT_INTENT_DIR, ASSETS_DIR))
  const taken = new Set(evidenceAssets.map((asset) => asset.name))
  const rejectedAssets: string[] = []
  const assets = [...evidenceAssets]
  for (const asset of intentAssets) {
    if (taken.has(asset.name)) {
      rejectedAssets.push(`${asset.name} (name already used by an evidence asset)`)
      continue
    }
    taken.add(asset.name)
    assets.push(asset)
  }

  const html =
    (set.sections ?? []).some(
      (section) => section.html !== undefined || section.diagram !== undefined,
    ) ||
    intentDocs.some((doc) => doc.html) ||
    resultDocs.some((doc) => doc.html)
  const kind = html ? 'html' : 'markdown'

  const title =
    set.name ??
    archivedName ??
    (source.kind === 'active' ? 'Migrated review' : `Migrated review ${source.sourceId}`)

  const thesisBlock =
    set.thesis === undefined ? '' : html ? `<p>${escapeHtml(set.thesis)}</p>` : set.thesis
  const bodies: Record<ReviewSectionId, string> = {
    intent: joinReviewBlocks([thesisBlock, ...documentBlocks(intentDocs, html)], kind),
    process: joinReviewBlocks(sectionBlocks(set.sections ?? [], html), kind),
    execution: joinReviewBlocks([renderReviewFiles(set.files ?? [], kind)], kind),
    evidence: joinReviewBlocks(
      [
        renderReviewChecks(checks, kind),
        ...documentBlocks(resultDocs, html),
        renderReviewGallery(assets, kind),
      ],
      kind,
    ),
  }

  const bundle = buildReviewCanvas({ title, kind, bodies })
  const archivedAt = isRecord(archivedMeta) ? text(archivedMeta.archivedAt) : undefined
  return {
    ...(archivedAt === undefined ? {} : { archivedAt }),
    title,
    kind,
    bundle,
    assets,
    rejectedAssets,
    fingerprintParts: [
      JSON.stringify(reviewRaw),
      JSON.stringify(checks),
      ...intentDocs.map((doc) => `${doc.file}:${doc.body}`),
      ...resultDocs.map((doc) => `${doc.file}:${doc.body}`),
      ...assets.map((asset) => asset.name),
    ],
  }
}

/** Write the bundle through the one Review Canvas writer both authors share. */
export async function writeReviewBundle(
  bundleDir: string,
  conversion: ReviewConversion,
): Promise<void> {
  await writeReviewCanvasBundle(bundleDir, conversion.bundle, conversion.assets)
}
