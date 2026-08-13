import { procedureCatalog } from '@porcelain/contracts'
import { projectEvidenceAssetsDir as evidenceAssetsDir } from '@shared/project-porcelain'
import { reviewedFingerprint, reviewedFingerprints } from '../git/git'
import { type ReviewDoc, readActiveEvidenceResults, readActiveIntentDocs } from '../review/doc-set'
import {
  type EvidenceAsset,
  type EvidenceAssetBody,
  listEvidenceAssets,
  readEvidenceAsset,
} from '../review/evidence-assets-list'
import {
  clearEvidence,
  type Evidence,
  type EvidenceMeta,
  readEvidence,
  readEvidenceMeta,
} from '../stores/evidence-store'
import {
  markReviewed,
  readReviewedMarks,
  reconcileReviewed,
  setReviewedMarks,
  unmarkReviewed,
} from '../stores/reviewed-store'
import { publicProcedure, t } from '../trpc'

export function createReviewRouter() {
  return t.router({
    // A mark stores a content fingerprint (sha256 of the file's diff vs HEAD) so it can be
    // reconciled: `reviewedPaths` re-derives each marked file's current fingerprint and
    // prunes any mark whose content changed (external commit, amend, post-mark edit).
    markReviewed: publicProcedure
      .input(procedureCatalog.markReviewed.input)
      .output(procedureCatalog.markReviewed.output)
      .mutation(async ({ input }) => {
        await markReviewed(
          input.repoPath,
          input.path,
          await reviewedFingerprint(input.repoPath, input.path),
        )
      }),

    unmarkReviewed: publicProcedure
      .input(procedureCatalog.unmarkReviewed.input)
      .output(procedureCatalog.unmarkReviewed.output)
      .mutation(async ({ input }) => {
        await unmarkReviewed(input.repoPath, input.path)
      }),

    reviewedPaths: publicProcedure
      .input(procedureCatalog.reviewedPaths.input)
      .output(procedureCatalog.reviewedPaths.output)
      .query(async ({ input }): Promise<string[]> => {
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
      .input(procedureCatalog.setReviewed.input)
      .output(procedureCatalog.setReviewed.output)
      .mutation(async ({ input }) => {
        const fingerprints = await reviewedFingerprints(input.repoPath, input.paths)
        await setReviewedMarks(
          input.repoPath,
          Array.from(fingerprints, ([path, fingerprint]) => ({ path, fingerprint })),
        )
      }),

    /**
     * Intent as a document set: `.porcelain/intent/` rendered as ordered tabs.
     * HTML arrives self-contained (siblings inlined by the daemon) so the renderer
     * keeps it on the `sandbox="" srcdoc` path — never a `src` URL, which would
     * drop the parent CSP that backstops agent-authored HTML.
     */
    reviewIntent: publicProcedure
      .input(procedureCatalog.reviewIntent.input)
      .output(procedureCatalog.reviewIntent.output)
      .query(({ input }): Promise<ReviewDoc[]> => readActiveIntentDocs(input)),

    /**
     * Evidence is three sub-tabs over one directory: **Checks** (the structured
     * list on `loopEvidence`), **Results** (this — `evidence/results/` as a
     * document set, the same primitive as Intent), and **Assets** (below).
     *
     * The name is wire history: it used to mean "extra docs beside index.html".
     * Installed clients call it, so it keeps its name and gains a meaning.
     */
    reviewEvidenceDocs: publicProcedure
      .input(procedureCatalog.reviewEvidenceDocs.input)
      .output(procedureCatalog.reviewEvidenceDocs.output)
      .query(({ input }): Promise<ReviewDoc[]> => readActiveEvidenceResults(input)),

    /**
     * The Assets sub-tab: `evidence/assets/` listed as a gallery. Metadata only —
     * one tile's bytes arrive from `reviewEvidenceAsset`, on demand.
     */
    reviewEvidenceAssets: publicProcedure
      .input(procedureCatalog.reviewEvidenceAssets.input)
      .output(procedureCatalog.reviewEvidenceAssets.output)
      .query(({ input }): Promise<EvidenceAsset[]> => listEvidenceAssets(evidenceAssetsDir(input))),

    /**
     * One gallery image as a data URL. Deliberately a procedure and not an HTTP
     * route: the daemon's static server serves the renderer dist unauthenticated,
     * and user files must never leave through it. Null when missing or over cap.
     */
    reviewEvidenceAsset: publicProcedure
      .input(procedureCatalog.reviewEvidenceAsset.input)
      .output(procedureCatalog.reviewEvidenceAsset.output)
      .query(
        ({ input }): Promise<EvidenceAssetBody | null> =>
          readEvidenceAsset(evidenceAssetsDir(input.repoPath), input.file),
      ),

    // Loop evidence: agent-authored HTML proving the work was validated (browser /
    // simulator / screenshots), rendered sandboxed as the Review's final chapter.
    // See `evidence-store.ts` — re-validated + size-capped on every read (external
    // process owns the files). Cheap metadata query; full HTML fetched only while
    // the evidence chapter is on screen. `clearLoopEvidence` is the app's one write.
    loopEvidence: publicProcedure
      .input(procedureCatalog.loopEvidence.input)
      .output(procedureCatalog.loopEvidence.output)
      .query(({ input }): Promise<EvidenceMeta | null> => readEvidenceMeta(input)),

    loopEvidenceHtml: publicProcedure
      .input(procedureCatalog.loopEvidenceHtml.input)
      .output(procedureCatalog.loopEvidenceHtml.output)
      .query(({ input }): Promise<Evidence | null> => readEvidence(input)),

    clearLoopEvidence: publicProcedure
      .input(procedureCatalog.clearLoopEvidence.input)
      .output(procedureCatalog.clearLoopEvidence.output)
      .mutation(async ({ input }) => {
        await clearEvidence(input)
      }),
  })
}
