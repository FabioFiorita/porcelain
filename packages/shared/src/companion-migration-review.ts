import { copyFile, mkdir } from 'node:fs/promises'
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

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm'])

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
  entryFile: string
  content: string
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
type EvidenceCheckRow = { label: string; status: string; detail?: string }
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

function parseChecks(raw: unknown): EvidenceCheckRow[] {
  if (!isRecord(raw) || !Array.isArray(raw.checks)) return []
  const out: EvidenceCheckRow[] = []
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * The renderable part of a legacy HTML document.
 *
 * Agents wrote self-contained pages here, so most of these carry `<html>` and
 * `<head>`. Nesting a whole document inside the Canvas entry would put a second
 * `<head>` in the middle of the body, so the `<body>` contents are lifted out
 * when there is one and the input is used as-is when there is not.
 */
export function htmlFragment(document: string): string {
  const match = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(document)
  return (match?.[1] ?? document).trim()
}

/** Legacy intent assets lived in `intent/assets/`; the bundle has one flat `assets/`. */
function rewriteAssetPaths(body: string): string {
  return body.replaceAll(`${PROJECT_INTENT_DIR}/${ASSETS_DIR}/`, `${ASSETS_DIR}/`)
}

function renderGallery(assets: readonly AssetCandidate[], html: boolean): string {
  const lines: string[] = []
  for (const asset of assets) {
    const extension = extensionOf(asset.name)
    const src = `${ASSETS_DIR}/${asset.name}`
    if (IMAGE_EXTENSIONS.has(extension)) {
      lines.push(
        html
          ? `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(asset.name)}"><figcaption>${escapeHtml(asset.name)}</figcaption></figure>`
          : `![${asset.name}](${src})`,
      )
      continue
    }
    if (VIDEO_EXTENSIONS.has(extension)) {
      lines.push(
        html
          ? `<figure><video src="${escapeHtml(src)}" controls></video><figcaption>${escapeHtml(asset.name)}</figcaption></figure>`
          : `[${asset.name}](${src})`,
      )
      continue
    }
    lines.push(
      html
        ? `<p><a href="${escapeHtml(src)}">${escapeHtml(asset.name)}</a></p>`
        : `- [${asset.name}](${src})`,
    )
  }
  return lines.join('\n')
}

function renderChecks(checks: readonly EvidenceCheckRow[], html: boolean): string {
  if (checks.length === 0) return ''
  if (!html) {
    const rows = checks.map(
      (check) => `| ${check.label} | ${check.status} | ${check.detail ?? ''} |`,
    )
    return ['| Check | Status | Detail |', '| --- | --- | --- |', ...rows].join('\n')
  }
  const rows = checks.map(
    (check) =>
      `<tr><td>${escapeHtml(check.label)}</td><td>${escapeHtml(check.status)}</td><td>${escapeHtml(check.detail ?? '')}</td></tr>`,
  )
  return `<table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

function renderFiles(files: readonly ReviewFile[], html: boolean): string {
  if (files.length === 0) return ''
  return files
    .map((file) => {
      const suffix = [file.source, file.note].filter((part) => part !== undefined).join(' — ')
      return html
        ? `<li><code>${escapeHtml(file.path)}</code>${suffix === '' ? '' : ` — ${escapeHtml(suffix)}`}</li>`
        : `- \`${file.path}\`${suffix === '' ? '' : ` — ${suffix}`}`
    })
    .join('\n')
}

function joinBlocks(blocks: readonly string[], html: boolean): string {
  const kept = blocks.map((block) => block.trim()).filter((block) => block !== '')
  if (kept.length === 0)
    return html ? '<p><em>Nothing was recorded here.</em></p>' : '_Nothing was recorded here._'
  return kept.join(html ? '\n' : '\n\n')
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

const SECTION_TITLES = ['Intent', 'Process', 'Execution', 'Evidence'] as const

function renderEntry(title: string, bodies: readonly string[], html: boolean): string {
  if (!html) {
    const parts = SECTION_TITLES.map((name, index) => `## ${name}\n\n${bodies[index] ?? ''}`)
    return `# ${title}\n\n${parts.join('\n\n')}\n`
  }
  const nav = SECTION_TITLES.map((name) => `<a href="#${name.toLowerCase()}">${name}</a>`).join(
    ' · ',
  )
  const parts = SECTION_TITLES.map(
    (name, index) =>
      `<section id="${name.toLowerCase()}"><h2>${name}</h2>\n${bodies[index] ?? ''}\n</section>`,
  )
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>
<h1>${escapeHtml(title)}</h1>
<nav>${nav}</nav>
${parts.join('\n')}
</body>
</html>
`
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

  const title =
    set.name ??
    archivedName ??
    (source.kind === 'active' ? 'Migrated review' : `Migrated review ${source.sourceId}`)

  const thesisBlock =
    set.thesis === undefined ? '' : html ? `<p>${escapeHtml(set.thesis)}</p>` : set.thesis
  const bodies = [
    joinBlocks([thesisBlock, ...documentBlocks(intentDocs, html)], html),
    joinBlocks(sectionBlocks(set.sections ?? [], html), html),
    joinBlocks([renderFiles(set.files ?? [], html)], html),
    joinBlocks(
      [
        renderChecks(checks, html),
        ...documentBlocks(resultDocs, html),
        renderGallery(assets, html),
      ],
      html,
    ),
  ]

  const entryFile = html ? 'index.html' : 'index.md'
  const content = renderEntry(title, bodies, html)
  const archivedAt = isRecord(archivedMeta) ? text(archivedMeta.archivedAt) : undefined
  return {
    ...(archivedAt === undefined ? {} : { archivedAt }),
    title,
    kind: html ? 'html' : 'markdown',
    entryFile,
    content,
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

/** Write the bundle: entry document plus every copied asset under `assets/`. */
export async function writeReviewBundle(
  bundleDir: string,
  conversion: ReviewConversion,
): Promise<void> {
  await mkdir(bundleDir, { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(bundleDir, conversion.entryFile), conversion.content)
  if (conversion.assets.length === 0) return
  const assetsDir = join(bundleDir, ASSETS_DIR)
  await mkdir(assetsDir, { recursive: true })
  for (const asset of conversion.assets) {
    await copyFile(asset.path, join(assetsDir, asset.name))
  }
}
