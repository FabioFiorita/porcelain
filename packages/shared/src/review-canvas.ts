import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * THE Review Canvas format — one writer, two authors.
 *
 * Review is not a lifecycle any more (#28); it is a Canvas that declares
 * `template: 'review'` in the canvas index. Two callers build one:
 *
 * - `porcelain review set` (apps/cli/src/review-file.ts), the agent's entry point;
 * - the one-time companion migration (companion-migration-review.ts), turning a
 *   legacy `.porcelain/active-review/` directory into the same thing.
 *
 * They share this module rather than each rendering their own bundle, which is
 * the only reason a migrated Review and a freshly written one are the same
 * artifact rather than two formats wearing one name.
 *
 * ## Layout
 *
 * ```
 * <bundle>/index.html            entry document — the whole story, one page
 * <bundle>/sections/intent.html  the same four bodies, addressable one at a time
 * <bundle>/sections/process.html
 * <bundle>/sections/execution.html
 * <bundle>/sections/evidence.html
 * <bundle>/assets/…              images, video, and documents the bodies reference
 * ```
 *
 * The entry document repeats what the section files hold. That is deliberate:
 * the entry is what a plain Canvas viewer renders (including a promoted bundle
 * opened from a `git clone` by something that knows nothing about templates),
 * while the section files are what the four-tab Review surface reads without
 * having to parse HTML back apart. `buildReviewCanvas` is the only writer of
 * either, so the two cannot drift.
 */

export const REVIEW_TEMPLATE = 'review' as const

export const REVIEW_SECTIONS = [
  { id: 'intent', title: 'Intent' },
  { id: 'process', title: 'Process' },
  { id: 'execution', title: 'Execution' },
  { id: 'evidence', title: 'Evidence' },
] as const

export type ReviewSectionId = (typeof REVIEW_SECTIONS)[number]['id']
export type ReviewCanvasKind = 'html' | 'markdown'

/** Sibling of the entry document, never a path the caller supplies. */
export const REVIEW_SECTIONS_DIR = 'sections'
/** Where `buildReviewCanvas` expects referenced images/video/documents to land. */
export const REVIEW_ASSETS_DIR = 'assets'

export function reviewSectionFile(id: ReviewSectionId, kind: ReviewCanvasKind): string {
  return `${REVIEW_SECTIONS_DIR}/${id}.${kind === 'html' ? 'html' : 'md'}`
}

export type ReviewSectionBodies = Readonly<Record<ReviewSectionId, string>>

export type ReviewCanvasBundle = Readonly<{
  kind: ReviewCanvasKind
  entryFile: string
  entryContent: string
  sections: readonly Readonly<{
    id: ReviewSectionId
    title: string
    file: string
    content: string
  }>[]
}>

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * The renderable part of a self-contained HTML document.
 *
 * Agents write whole pages, so most inputs carry `<html>` and `<head>`. Nesting
 * one inside the entry document would put a second `<head>` in the middle of a
 * body, so the `<body>` contents are lifted out when there is one and the input
 * is used as-is when there is not.
 */
export function htmlFragment(document: string): string {
  const match = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(document)
  return (match?.[1] ?? document).trim()
}

/** What an empty section says, so "there was none" never reads as "it was lost". */
export function emptySectionBody(kind: ReviewCanvasKind): string {
  return kind === 'html'
    ? '<p><em>Nothing was recorded here.</em></p>'
    : '_Nothing was recorded here._'
}

/** Drop blank blocks and join the rest; an all-blank section says so explicitly. */
export function joinReviewBlocks(blocks: readonly string[], kind: ReviewCanvasKind): string {
  const kept = blocks.map((block) => block.trim()).filter((block) => block !== '')
  if (kept.length === 0) return emptySectionBody(kind)
  return kept.join(kind === 'html' ? '\n' : '\n\n')
}

export function buildReviewCanvas(input: {
  title: string
  kind: ReviewCanvasKind
  bodies: ReviewSectionBodies
}): ReviewCanvasBundle {
  const html = input.kind === 'html'
  const sections = REVIEW_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    file: reviewSectionFile(section.id, input.kind),
    content:
      input.bodies[section.id].trim() === ''
        ? emptySectionBody(input.kind)
        : input.bodies[section.id],
  }))

  const entryFile = html ? 'index.html' : 'index.md'
  const entryContent = html
    ? `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title></head>
<body>
<h1>${escapeHtml(input.title)}</h1>
<nav>${sections.map((s) => `<a href="#${s.id}">${s.title}</a>`).join(' · ')}</nav>
${sections
  .map((s) => `<section id="${s.id}"><h2>${s.title}</h2>\n${s.content}\n</section>`)
  .join('\n')}
</body>
</html>
`
    : `# ${input.title}\n\n${sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n')}\n`

  return { kind: input.kind, entryFile, entryContent, sections }
}

/** One asset to copy into the bundle's `assets/` namespace, already name-checked. */
export type ReviewCanvasAsset = Readonly<{ name: string; path: string }>

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm'])

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * The Evidence gallery: an image renders as an image, a video as a player, and
 * anything else as a link — so an agent can drop a `.md` report or a `.pdf`
 * beside its screenshots and still have it reachable from the Review.
 */
export function renderReviewGallery(
  assets: readonly ReviewCanvasAsset[],
  kind: ReviewCanvasKind,
): string {
  const html = kind === 'html'
  const lines: string[] = []
  for (const asset of assets) {
    const extension = extensionOf(asset.name)
    const src = `${REVIEW_ASSETS_DIR}/${asset.name}`
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

export type ReviewCheckRow = Readonly<{ label: string; status: string; detail?: string }>

/** The Evidence checks table — what was run and whether it passed. */
export function renderReviewChecks(
  checks: readonly ReviewCheckRow[],
  kind: ReviewCanvasKind,
): string {
  if (checks.length === 0) return ''
  if (kind !== 'html') {
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

export type ReviewFileRow = Readonly<{ path: string; source?: string; note?: string }>

/** The Execution section: the files this unit of work actually changed. */
export function renderReviewFiles(files: readonly ReviewFileRow[], kind: ReviewCanvasKind): string {
  if (files.length === 0) return ''
  const rows = files.map((file) => {
    const suffix = [file.source, file.note].filter((part) => part !== undefined).join(' — ')
    return kind === 'html'
      ? `<li><code>${escapeHtml(file.path)}</code>${suffix === '' ? '' : ` — ${escapeHtml(suffix)}`}</li>`
      : `- \`${file.path}\`${suffix === '' ? '' : ` — ${suffix}`}`
  })
  return kind === 'html' ? `<ul>${rows.join('')}</ul>` : rows.join('\n')
}

/**
 * Write the bundle into `bundleDir`: entry document, section files, assets.
 *
 * `sections/` is cleared first so a Review rewritten from HTML to Markdown (or
 * back) does not leave the previous kind's four files behind for the reader to
 * choose between.
 */
export async function writeReviewCanvasBundle(
  bundleDir: string,
  bundle: ReviewCanvasBundle,
  assets: readonly ReviewCanvasAsset[] = [],
): Promise<void> {
  await mkdir(bundleDir, { recursive: true })
  await rm(join(bundleDir, REVIEW_SECTIONS_DIR), { recursive: true, force: true })
  await writeFile(join(bundleDir, bundle.entryFile), bundle.entryContent)
  for (const section of bundle.sections) {
    const path = join(bundleDir, section.file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, section.content)
  }
  if (assets.length === 0) return
  const assetsDir = join(bundleDir, REVIEW_ASSETS_DIR)
  await mkdir(assetsDir, { recursive: true })
  for (const asset of assets) {
    await copyFile(asset.path, join(assetsDir, asset.name))
  }
}
