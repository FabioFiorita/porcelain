import { z } from 'zod'

/**
 * Where a file in Execution comes from, relative to the unit under review. The
 * agent alone chooses membership; these tags only label listed files:
 * - `changed` — dirty in the working tree (Porcelain auto-tags listed dirty files).
 * - `context` — unchanged, listed so the flow still reads as a story.
 * - `shipped` — already landed (on the branch or main); cross-seam half of the unit
 *   the agent wants the human to see (a tRPC route, a runtime contract).
 */
export const FILE_SOURCES = ['changed', 'context', 'shipped'] as const
export type FileSource = (typeof FILE_SOURCES)[number]

const reviewSetFileSchema = z.object({
  path: z.string().min(1),
  source: z.enum(FILE_SOURCES).optional(),
  note: z.string().optional(),
  layer: z.string().optional(),
})

interface ReviewSetFile {
  /** Repo-relative path. */
  path: string
  /** Defaults to `shipped` when the file isn't in the working tree (see `FileSource`). */
  source?: FileSource
  /** A cross-file invariant the reviewer must check (e.g. "labels must match the service"). */
  note?: string
  /**
   * The flow-layer (group heading) this file belongs to IN THE FEATURE VIEW. When
   * the agent sets it, the feature view honours the agent's layers + declared file
   * order verbatim instead of the repo-wide regex layers (which still drive the
   * Changes tab). Files left without a layer fall back to the regex match.
   */
  layer?: string
}

const reviewSectionAnchorSchema = z.object({
  path: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
})

export const reviewSectionSchema = z.object({
  title: z.string().min(1).max(200),
  prose: z.string().max(32_768),
  diagram: z.string().max(262_144).optional(),
  html: z.string().max(524_288).optional(),
  htmlHeight: z.number().int().min(160).max(1600).optional(),
  anchors: z.array(reviewSectionAnchorSchema).max(40).default([]),
})

interface ReviewSectionAnchor {
  /** Repo-relative path (must pass `isRepoContained` — it flows into file reads). */
  path: string
  /** 1-based inclusive range; omit both to anchor the file's normal reading block. */
  startLine?: number
  endLine?: number
}

export interface ReviewSection {
  title: string
  /** Markdown, rendered via react-markdown with default escaping (no raw HTML). */
  prose: string
  /**
   * Self-contained inline SVG markup (the agent renders mermaid→SVG itself).
   * Agent-authored ACTIVE content — only ever rendered inside the sandboxed
   * `<iframe sandbox="" srcdoc>` path, never injected into the app DOM.
   */
  diagram?: string
  /**
   * A self-contained HTML fragment/document, agent-authored ACTIVE content —
   * rendered ONLY via the sandboxed `<iframe sandbox="" srcdoc>` path, never
   * injected into the app DOM. For content richer than markdown (styled tables,
   * metric summaries, small reports; embed images as data URIs — external loads
   * are blocked by the CSP).
   */
  html?: string
  /** Pixel height hint for the embed well (default 448 when omitted; capped 160–1600). */
  htmlHeight?: number
  /** The code blocks this section walks through, in document order. */
  anchors: ReviewSectionAnchor[]
}

/**
 * Freeform Overview canvas body (optional). When set, the Feature Overview tab
 * renders this full-height instead of the structured reading surface; thesis +
 * sections still drive the sidebar outline. Not a revival of the deleted
 * feature-artifact channel — a medium on the same Review.
 *
 * HTML is the only canvas medium. Reviews written before the media collapsed to
 * HTML + Markdown may still carry a scene-based canvas on disk; that canvas is
 * dropped on read (see `canvas` below), never a parse failure.
 */
const reviewCanvasSchema = z.discriminatedUnion('medium', [
  z.object({
    medium: z.literal('html'),
    html: z.string().min(1).max(524_288),
  }),
])

export type ReviewCanvas = z.infer<typeof reviewCanvasSchema>

export const reviewSetSchema = z.object({
  name: z.string().default('Feature view'),
  thesis: z.string().max(4096).optional(),
  files: z.array(reviewSetFileSchema).default([]),
  sections: z.array(reviewSectionSchema).max(30).default([]),
  /**
   * A canvas the app cannot render — a legacy scene medium, or anything over the
   * caps — degrades to no canvas instead of failing the whole review. review.json
   * is written by an external process; one stale field must not cost the human
   * every other tab.
   */
  canvas: reviewCanvasSchema.optional().catch(undefined),
})

export interface ReviewSet {
  name: string
  /** One-paragraph markdown thesis shown at the top of the Review. */
  thesis?: string
  files: ReviewSetFile[]
  /** The agent-authored walkthrough sections, in flow order. */
  sections: ReviewSection[]
  /** Optional freeform Overview body (html). */
  canvas?: ReviewCanvas
}
