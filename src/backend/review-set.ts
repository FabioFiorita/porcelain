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

export const reviewSetSchema = z.object({
  name: z.string().default('Feature view'),
  files: z.array(reviewSetFileSchema).default([]),
})

export interface ReviewSet {
  name: string
  files: ReviewSetFile[]
}

/** The on-disk shape the porcelain CLI writes: review sets keyed by absolute repo path. */
export const reviewSetsSchema = z.record(z.string(), reviewSetSchema)
export type ReviewSets = z.infer<typeof reviewSetsSchema>
