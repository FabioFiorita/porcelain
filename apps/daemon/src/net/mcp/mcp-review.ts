import {
  buildReviewCanvas,
  escapeHtml,
  type ReviewCanvasKind,
  type ReviewSectionId,
} from '@porcelain/shared/review-canvas'
import type { CanvasBundleSource } from '../../features/projects'

/** The Review as an agent declares it. Stored verbatim so it can be read back. */
export type ReviewSet = Readonly<{
  name: string
  thesis?: string
  files: readonly ReviewFile[]
  sections: readonly ReviewSection[]
}>

export type ReviewFile = Readonly<{
  path: string
  source?: 'changed' | 'context' | 'shipped'
  note?: string
  layer?: string
}>

export type ReviewSection = Readonly<{
  title: string
  prose: string
  diagram?: string
  anchors?: readonly Readonly<{ path: string; startLine?: number; endLine?: number }>[]
}>

/**
 * The declared set travels beside the rendered bundle so `porcelain_context` can
 * hand back what was declared rather than reverse-engineering it out of HTML.
 */
export const REVIEW_CANVAS_METADATA = 'review.json'

/** Inline SVG is the only markup a section may carry, so HTML is the kind whenever one appears. */
function reviewKind(set: ReviewSet): ReviewCanvasKind {
  return set.sections.some((section) => section.diagram !== undefined) ? 'html' : 'markdown'
}

function sectionBodies(set: ReviewSet): {
  kind: ReviewCanvasKind
  bodies: Readonly<Record<ReviewSectionId, string>>
} {
  const kind = reviewKind(set)
  const html = kind === 'html'
  const intent =
    set.thesis === undefined ? '' : html ? `<p>${escapeHtml(set.thesis)}</p>` : set.thesis
  const process = set.sections
    .map((section) => {
      if (!html) return `### ${section.title}\n\n${section.prose}`
      const parts = [`<h3>${escapeHtml(section.title)}</h3>`, `<p>${escapeHtml(section.prose)}</p>`]
      if (section.diagram !== undefined) parts.push(section.diagram)
      return parts.join('\n')
    })
    .join(html ? '\n' : '\n\n')
  const execution = set.files
    .map((file) => {
      const note = file.note === undefined ? '' : ` — ${file.note}`
      return html
        ? `<li><code>${escapeHtml(file.path)}</code>${escapeHtml(note)}</li>`
        : `- \`${file.path}\`${note}`
    })
    .join('\n')
  return {
    kind,
    bodies: {
      intent,
      process,
      execution: html && execution !== '' ? `<ul>\n${execution}\n</ul>` : execution,
      evidence: '',
    } as Readonly<Record<ReviewSectionId, string>>,
  }
}

/** Render a declared Review into the files its Canvas bundle is made of. */
export function reviewBundleSource(set: ReviewSet): {
  kind: ReviewCanvasKind
  entryFile: string
  source: CanvasBundleSource
} {
  const { kind, bodies } = sectionBodies(set)
  const bundle = buildReviewCanvas({ title: set.name, kind, bodies })
  return {
    kind,
    entryFile: bundle.entryFile,
    source: {
      kind: 'files',
      files: [
        { path: bundle.entryFile, content: bundle.entryContent },
        ...bundle.sections.map((section) => ({ path: section.file, content: section.content })),
        { path: REVIEW_CANVAS_METADATA, content: `${JSON.stringify(set, null, 2)}\n` },
      ],
    },
  }
}

/** Merge incoming files over existing ones, matched by path — `append` semantics. */
export function mergeReviewFiles(
  existing: readonly ReviewFile[],
  incoming: readonly ReviewFile[],
): ReviewFile[] {
  const byPath = new Map(existing.map((file) => [file.path, file]))
  for (const file of incoming) byPath.set(file.path, file)
  return [...byPath.values()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse a stored `review.json`. Field by field and never trusted: the bundle may
 * have been promoted into a repository and travelled back by `git clone`.
 */
export function parseReviewSet(value: unknown): ReviewSet | null {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name === '') return null
  const files = Array.isArray(value.files)
    ? value.files.filter(isRecord).flatMap((file): ReviewFile[] => {
        if (typeof file.path !== 'string' || file.path === '') return []
        const parsed: {
          path: string
          source?: ReviewFile['source']
          note?: string
          layer?: string
        } = { path: file.path }
        if (file.source === 'changed' || file.source === 'context' || file.source === 'shipped') {
          parsed.source = file.source
        }
        if (typeof file.note === 'string') parsed.note = file.note
        if (typeof file.layer === 'string') parsed.layer = file.layer
        return [parsed]
      })
    : []
  const sections = Array.isArray(value.sections)
    ? value.sections.filter(isRecord).flatMap((section): ReviewSection[] => {
        if (typeof section.title !== 'string' || typeof section.prose !== 'string') return []
        const parsed: { title: string; prose: string; diagram?: string } = {
          title: section.title,
          prose: section.prose,
        }
        if (typeof section.diagram === 'string') parsed.diagram = section.diagram
        return [parsed]
      })
    : []
  const set: { name: string; thesis?: string; files: ReviewFile[]; sections: ReviewSection[] } = {
    name: value.name,
    files,
    sections,
  }
  if (typeof value.thesis === 'string') set.thesis = value.thesis
  return set
}
