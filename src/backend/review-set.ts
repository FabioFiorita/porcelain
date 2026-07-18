import { z } from 'zod'

/**
 * Where a file in a feature view comes from, relative to the change under review:
 * - `changed` — in the working tree (what the reviewer is actually changing).
 * - `context` — unchanged, but reachable from the change; included so the flow reads
 *   as a story. The static baseline reaches these by walking relative imports.
 * - `shipped` — already landed (on the branch or main); the half of the feature the
 *   reviewer didn't touch. Only the agent can declare these — they cross seams (a
 *   tRPC route string, a runtime contract) that the import graph cannot follow.
 */
export const FILE_SOURCES = ['changed', 'context', 'shipped'] as const
export type FileSource = (typeof FILE_SOURCES)[number]

export const reviewSetFileSchema = z.object({
  path: z.string().min(1),
  source: z.enum(FILE_SOURCES).optional(),
  note: z.string().optional(),
  layer: z.string().optional(),
})

export interface ReviewSetFile {
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

export const reviewSectionAnchorSchema = z.object({
  path: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
})

export const reviewSectionSchema = z.object({
  title: z.string().min(1).max(200),
  prose: z.string().max(32_768),
  diagram: z.string().max(262_144).optional(),
  anchors: z.array(reviewSectionAnchorSchema).max(40).default([]),
})

export interface ReviewSectionAnchor {
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
  /** The code blocks this section walks through, in document order. */
  anchors: ReviewSectionAnchor[]
}

export const reviewSetSchema = z.object({
  name: z.string().default('Feature view'),
  thesis: z.string().max(4096).optional(),
  files: z.array(reviewSetFileSchema).default([]),
  sections: z.array(reviewSectionSchema).max(30).default([]),
})

export interface ReviewSet {
  name: string
  /** One-paragraph markdown thesis shown at the top of the Review. */
  thesis?: string
  files: ReviewSetFile[]
  /** The agent-authored walkthrough sections, in flow order. */
  sections: ReviewSection[]
}

/** The on-disk shape the porcelain CLI writes: review sets keyed by absolute repo path. */
export const reviewSetsSchema = z.record(z.string(), reviewSetSchema)
export type ReviewSets = z.infer<typeof reviewSetsSchema>
