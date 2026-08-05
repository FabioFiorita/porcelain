import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { DiffHunk } from '../git/diff'
import {
  gitCommitDiff,
  gitCommitMessage,
  gitDiffFile,
  gitListFiles,
  gitRangeDiffFile,
  reviewedFingerprint,
  reviewedFingerprints,
} from '../git/git'
import {
  cachedFeatureReading,
  gatherFeature,
  getFeatureBuild,
  storeFeatureReading,
} from '../review/feature-build'
import { buildExploreReading, walkExplore } from '../review/feature-explore'
import {
  buildDiffReading,
  buildFeatureReading,
  type FeatureReading,
  type FeatureView,
} from '../review/feature-view'
import { DEFAULT_LAYERS, type FlowGroup } from '../review/flow'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from '../review/flow-build'
import {
  addComment,
  clearResolvedComments,
  deleteComment,
  editComment,
  type ReviewComment,
  readComments,
  setCommentResolved,
} from '../stores/comment-store'
import {
  clearEvidence,
  type Evidence,
  type EvidenceMeta,
  readEvidence,
  readEvidenceMeta,
} from '../stores/evidence-store'
import { readLayers } from '../stores/layers-store'
import {
  type ArchivedReviewMeta,
  clearReviewSet,
  deleteArchivedReview,
  listArchivedReviews,
  restoreArchivedReview,
} from '../stores/review-store'
import {
  markReviewed,
  readReviewedMarks,
  reconcileReviewed,
  setReviewedMarks,
  unmarkReviewed,
} from '../stores/reviewed-store'
import { publicProcedure, t } from '../trpc'

export const reviewRouter = t.router({
  // A mark stores a content fingerprint (sha256 of the file's diff vs HEAD) so it can be
  // reconciled: `reviewedPaths` re-derives each marked file's current fingerprint and
  // prunes any mark whose content changed (external commit, amend, post-mark edit).
  markReviewed: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await markReviewed(
        input.repoPath,
        input.path,
        await reviewedFingerprint(input.repoPath, input.path),
      )
    }),

  unmarkReviewed: publicProcedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unmarkReviewed(input.repoPath, input.path)
    }),

  reviewedPaths: publicProcedure.input(z.string()).query(async ({ input }): Promise<string[]> => {
    // Only the marked paths need fingerprinting (few files); reconcile prunes stale
    // marks and writes through so reviewed.json stays truthful for the CLI reader.
    // reconcileReviewed re-reads after prune so a concurrent markReviewed (the UI's
    // optimistic tick) is never omitted from this response — that omission used to
    // overwrite the client cache and make the mark appear to un-toggle a second later.
    const marks = await readReviewedMarks(input)
    const current = await reviewedFingerprints(
      input,
      marks.map((mark) => mark.path),
    )
    return reconcileReviewed(input, marks, current)
  }),

  setReviewed: publicProcedure
    .input(z.object({ repoPath: z.string(), paths: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const fingerprints = await reviewedFingerprints(input.repoPath, input.paths)
      await setReviewedMarks(
        input.repoPath,
        Array.from(fingerprints, ([path, fingerprint]) => ({ path, fingerprint })),
      )
    }),

  // Continuous stacked-diff reading surface for Changes (working/branch) and
  // History (a single commit). Same flow order as the lists; every file carries
  // its full diff so the viewer can scroll the whole change as one document.
  diffReading: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        scope: z.discriminatedUnion('type', [
          z.object({ type: z.literal('working') }),
          z.object({ type: z.literal('branch') }),
          z.object({ type: z.literal('commit'), hash: z.string() }),
        ]),
      }),
    )
    .query(async ({ input }): Promise<FeatureReading> => {
      const { repoPath, scope } = input
      let groups: FlowGroup[]
      let name: string
      let fetchHunks: (path: string) => Promise<DiffHunk[]>

      if (scope.type === 'working') {
        groups = await loadWorkingFlow(repoPath)
        name = 'Changes'
        fetchHunks = async (path: string): Promise<DiffHunk[]> =>
          (await gitDiffFile(repoPath, path)).hunks
      } else if (scope.type === 'branch') {
        const range = await loadRangeFlow(repoPath)
        groups = range.groups
        name = `vs ${range.base}`
        fetchHunks = async (path: string): Promise<DiffHunk[]> =>
          (await gitRangeDiffFile(repoPath, range.base, path)).hunks
      } else {
        groups = await loadCommitFlow(repoPath, scope.hash)
        const message = await gitCommitMessage(repoPath, scope.hash)
        name = message.split('\n')[0]?.trim() || scope.hash.slice(0, 12)
        fetchHunks = (path: string): Promise<DiffHunk[]> =>
          gitCommitDiff(repoPath, scope.hash, path)
      }

      const files = groups.flatMap((group) => group.files)
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        files.map(async (file) => {
          try {
            diffs.set(file.path, await fetchHunks(file.path))
          } catch {
            // vanished/renamed between the flow snapshot and this read — empty hunks
          }
        }),
      )
      return buildDiffReading({ name, groups, diffs })
    }),

  // The feature view (the Review's Execution outline): exactly the files the agent
  // listed in the review set (porcelain CLI → <repo>/.porcelain/review.json), in
  // agent order, with notes/layers/thesis/sections. Null without a set (the
  // renderer shows the "No review yet" empty state). Working-tree changes that
  // the agent did not list never appear here.
  featureView: publicProcedure
    .input(z.string())
    .query(async ({ input }): Promise<FeatureView | null> => {
      const g = await gatherFeature(input)
      if (!g.reviewSet) return null
      return (await getFeatureBuild(input, { ...g, reviewSet: g.reviewSet })).view
    }),

  // The Review document: thesis + walkthrough sections (prose/diagram + anchored
  // code blocks) + the leftover files flow-grouped, with just the relevant lines
  // (diff hunks for changed files, symbol slices for context/shipped) and the
  // loop-evidence meta as the final chapter. Review-set-only — null without an
  // agent review set, so the slice heuristic only ever runs on the agent's
  // curated, annotated set.
  featureReading: publicProcedure
    .input(z.string())
    .query(async ({ input }): Promise<FeatureReading | null> => {
      const g = await gatherFeature(input)
      if (!g.reviewSet) return null
      // Evidence meta is read fresh on every poll (a cheap stat-level read): it is
      // NOT part of the feature key, so a cached reading would otherwise pin a
      // stale/absent final chapter until the working tree changed.
      const meta = await readEvidenceMeta(input)
      const evidence = meta
        ? {
            title: meta.title,
            updatedAt: meta.updatedAt,
            checks: meta.checks,
            medium: meta.medium,
          }
        : null
      const canvas = g.reviewSet.canvas
      const cached = cachedFeatureReading(input, g.key)
      // Evidence + canvas can change without the feature key; always reattach them.
      if (cached) return { ...cached, evidence, canvas }
      const { view, sources } = await getFeatureBuild(input, { ...g, reviewSet: g.reviewSet })
      const changed = view.groups
        .flatMap((group) => group.files)
        .filter((f) => f.source === 'changed')
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        changed.map(async (file) => {
          try {
            diffs.set(file.path, (await gitDiffFile(input, file.path)).hunks)
          } catch {
            // file vanished/renamed between the status snapshot and this read —
            // leave it out; buildFeatureReading falls back to an empty hunk list
          }
        }),
      )
      const reading = buildFeatureReading({
        view,
        sections: g.reviewSet.sections,
        sources,
        diffs,
        evidence,
        canvas,
      })
      storeFeatureReading(input, g.key, reading)
      return reading
    }),

  // Archive the active review (intent, comments, reviewed marks, evidence) under
  // .porcelain/reviews/<id>/ and clear the active slots → "No review yet".
  clearFeatureReview: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    await clearReviewSet(input)
  }),

  /** Previous (archived) reviews for the project, newest first. */
  archivedReviews: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<ArchivedReviewMeta[]> => listArchivedReviews(input)),

  restoreArchivedReview: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await restoreArchivedReview(input.repoPath, input.id)
    }),

  deleteArchivedReview: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await deleteArchivedReview(input.repoPath, input.id)
    }),

  // Loop evidence: agent-authored HTML proving the work was validated (browser /
  // simulator / screenshots), rendered sandboxed as the Review's final chapter.
  // See `evidence-store.ts` — re-validated + size-capped on every read (external
  // process owns the files). Cheap metadata query; full HTML fetched only while
  // the evidence chapter is on screen. `clearLoopEvidence` is the app's one write.
  loopEvidence: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<EvidenceMeta | null> => readEvidenceMeta(input)),

  loopEvidenceHtml: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<Evidence | null> => readEvidence(input)),

  clearLoopEvidence: publicProcedure.input(z.string()).mutation(async ({ input }) => {
    await clearEvidence(input)
  }),

  // Review comments — the human's notes on lines/files, fed to the agent as context
  // via the porcelain CLI (`comments list`) and resolvable by it (`comments resolve`).
  // Stored in the active review folder (see `comment-store.ts`); a two-way channel.
  reviewComments: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<ReviewComment[]> => readComments(input)),

  addReviewComment: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        path: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
        anchorText: z.string().optional(),
        body: z.string().min(1),
      }),
    )
    .mutation(({ input }): Promise<ReviewComment> => {
      const { repoPath, ...comment } = input
      return addComment(repoPath, comment)
    }),

  editReviewComment: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string(), body: z.string().min(1) }))
    .mutation(({ input }) => editComment(input.repoPath, input.id, input.body)),

  deleteReviewComment: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteComment(input.repoPath, input.id)),

  clearResolvedReviewComments: publicProcedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(({ input }) => clearResolvedComments(input.repoPath)),

  resolveReviewComment: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string(), resolved: z.boolean() }))
    .mutation(({ input }) => setCommentResolved(input.repoPath, input.id, input.resolved)),

  // Explore an existing feature read-only: seed from a symbol (or a whole file)
  // and walk the import/reference graph into the SAME flow-ordered, sliced reading
  // surface — no working-tree change, no agent. Files outside the working tree are
  // read on demand (bounded by the walk's depth/file caps + the 10MB read limit).
  exploreFeature: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        seed: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('file'), path: z.string() }),
          z.object({ kind: z.literal('symbol'), path: z.string(), symbol: z.string() }),
        ]),
      }),
    )
    .query(async ({ input }): Promise<FeatureReading> => {
      const repoFiles = new Set(await gitListFiles(input.repoPath))
      const sources = new Map<string, string>()
      const readSource = async (path: string): Promise<string | undefined> => {
        const cached = sources.get(path)
        if (cached !== undefined) return cached
        try {
          const content = await readFile(join(input.repoPath, path), 'utf8')
          if (content.length < 1024 * 1024) {
            sources.set(path, content)
            return content
          }
        } catch {
          // unreadable / outside the repo — the walk just treats it as a leaf
        }
        return undefined
      }
      const nodes = await walkExplore(input.seed, readSource, repoFiles)
      const layers = (await readLayers(input.repoPath)) ?? DEFAULT_LAYERS
      const name =
        input.seed.kind === 'symbol'
          ? input.seed.symbol
          : (input.seed.path.split('/').at(-1) ?? input.seed.path)
      return buildExploreReading(name, nodes, sources, layers)
    }),
})
