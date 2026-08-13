import { procedureCatalog } from '@porcelain/contracts'
import type { EvidenceCheck } from '@shared/evidence-check'
import type { ReviewDoc } from '../../review/doc-set'
import type { EvidenceAsset, EvidenceAssetBody } from '../../review/evidence-assets-list'
import { publicProcedure, t } from '../../trpc'
import type { ReviewEvidenceOperations } from './review-evidence-operations'

/**
 * Review Evidence router — five wire procedures bound to the live catalog names.
 * Each procedure is parse → invoke one operation → serialize. None of them has an
 * expected typed failure: a missing pack is `null`, an over-cap document is dropped,
 * an uncontained or oversized asset is `null`, and a genuine filesystem failure
 * throws and serializes as `internal.unexpected`.
 *
 * The files are owned by an external process, so they are re-validated and size-capped
 * on every read. `clearLoopEvidence` is the app's one write.
 */

/** The `loopEvidence` wire shape. REV-009 deletes `medium` and `hasReport`. */
type LoopEvidenceOutput = {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
  medium: 'html'
  results: number
  assets: number
  hasReport: boolean
}

export function createReviewEvidenceRouter(operations: ReviewEvidenceOperations) {
  return t.router({
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
      .query(
        ({ input }): Promise<ReviewDoc[]> => operations.readEvidenceResults({ projectPath: input }),
      ),

    /**
     * The Assets sub-tab: `evidence/assets/` listed as a gallery. Metadata only —
     * one tile's bytes arrive from `reviewEvidenceAsset`, on demand.
     */
    reviewEvidenceAssets: publicProcedure
      .input(procedureCatalog.reviewEvidenceAssets.input)
      .output(procedureCatalog.reviewEvidenceAssets.output)
      .query(
        ({ input }): Promise<EvidenceAsset[]> =>
          operations.listEvidenceAssets({ projectPath: input }),
      ),

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
          operations.readEvidenceAsset({ projectPath: input.repoPath, file: input.file }),
      ),

    // Cheap metadata query for the Feature list opener and the Evidence header; the
    // document bodies and the image bytes are fetched separately, only while the
    // Evidence chapter is on screen. Counts come from the same scan the gallery and
    // the Results tab use, so the header never promises a tab that is not there.
    loopEvidence: publicProcedure
      .input(procedureCatalog.loopEvidence.input)
      .output(procedureCatalog.loopEvidence.output)
      .query(async ({ input }): Promise<LoopEvidenceOutput | null> => {
        const pack = await operations.readEvidenceSummary({ projectPath: input })
        if (pack === null) return null
        return {
          title: pack.title,
          updatedAt: pack.updatedAt,
          checks: pack.checks,
          medium: 'html' as const, // REV-009 deletes this marker
          results: pack.results.length,
          assets: pack.assets.length,
          hasReport: pack.legacyReport, // REV-009 deletes this field
        }
      }),

    clearLoopEvidence: publicProcedure
      .input(procedureCatalog.clearLoopEvidence.input)
      .output(procedureCatalog.clearLoopEvidence.output)
      .mutation(async ({ input }) => {
        await operations.clearEvidence({ projectPath: input })
      }),
  })
}
