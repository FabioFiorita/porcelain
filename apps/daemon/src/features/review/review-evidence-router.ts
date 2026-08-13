import { procedureCatalog } from '@porcelain/contracts'
import type { ReviewDoc } from '../../review/doc-set'
import type { EvidenceAssetBody } from '../../review/evidence-assets-list'
import { publicProcedure, t } from '../../trpc'
import type { ReviewEvidencePack } from './review-evidence-capabilities'
import type { ReviewEvidenceOperations } from './review-evidence-operations'

/**
 * Review Evidence router — four wire procedures bound to the canonical catalog names.
 * Each procedure is parse → invoke one operation → serialize. None of them has an
 * expected typed failure: a missing pack is `null`, an over-cap document or image is
 * described as `unavailable` and fetches as `null`, and a genuine filesystem failure
 * throws and serializes as `internal.unexpected`.
 *
 * The files are owned by an external process, so they are re-validated and size-capped
 * on every read. `clearEvidence` is the app's one write.
 */
export function createReviewEvidenceRouter(operations: ReviewEvidenceOperations) {
  return t.router({
    /**
     * The Evidence pack in one read: **Checks** (`meta.json`), **Results**
     * (`evidence/results/` described as documents), and **Assets**
     * (`evidence/assets/` described as a gallery). Descriptors only — bodies and
     * image bytes are fetched separately, only while the Evidence chapter is on
     * screen — so the header can never promise a tab that is not there.
     */
    reviewEvidence: publicProcedure
      .input(procedureCatalog.reviewEvidence.input)
      .output(procedureCatalog.reviewEvidence.output)
      .query(
        ({ input }): Promise<ReviewEvidencePack | null> =>
          operations.readEvidencePack({ projectPath: input }),
      ),

    /**
     * One Results document by its descriptor `file`. HTML arrives self-contained
     * (siblings inlined by the reader) so the renderer keeps it on the
     * `sandbox="" srcdoc` path — never a `src` URL, which would drop the parent CSP
     * that backstops agent-authored HTML.
     */
    reviewEvidenceDoc: publicProcedure
      .input(procedureCatalog.reviewEvidenceDoc.input)
      .output(procedureCatalog.reviewEvidenceDoc.output)
      .query(
        ({ input }): Promise<ReviewDoc | null> =>
          operations.readEvidenceDoc({ projectPath: input.repoPath, file: input.file }),
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

    clearEvidence: publicProcedure
      .input(procedureCatalog.clearEvidence.input)
      .output(procedureCatalog.clearEvidence.output)
      .mutation(async ({ input }) => {
        await operations.clearEvidence({ projectPath: input })
      }),
  })
}
