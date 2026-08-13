import { procedureCatalog } from '@porcelain/contracts'
import type { ActiveReview, ReviewReading } from '../../review/active-review'
import type { ReviewDoc } from '../../review/doc-set'
import { publicProcedure, t } from '../../trpc'
import type { InboxRow } from './review-reading-capabilities'
import type { ReviewReadingOperations } from './review-reading-operations'

/**
 * Review reading router — five wire procedures bound to the canonical catalog names.
 * Each procedure is parse → invoke one operation → serialize. None of them has an
 * expected typed failure: "no active review" is `null`, a vanished file is an empty
 * hunk list, a broken sibling worktree is a dropped row, and a genuine Git or
 * filesystem failure throws and serializes as `internal.unexpected`.
 */
export function createReviewReadingRouter(operations: ReviewReadingOperations) {
  return t.router({
    // The active review (the Review's Execution outline): exactly the files the agent
    // listed in the review set (porcelain CLI → <repo>/.porcelain/review.json), in
    // agent order, with notes/layers/thesis/sections. Null without a set (the
    // renderer shows the "No review yet" empty state). Working-tree changes that
    // the agent did not list never appear here.
    activeReview: publicProcedure
      .input(procedureCatalog.activeReview.input)
      .output(procedureCatalog.activeReview.output)
      .query(
        ({ input }): Promise<ActiveReview | null> =>
          operations.readActiveReview({ projectPath: input }),
      ),

    /**
     * The Review document: thesis + walkthrough sections (prose/diagram + anchored
     * code blocks) + the leftover files flow-grouped, with just the relevant lines
     * and the Evidence meta as the final chapter. Review-set-only.
     *
     * Agent-authored section HTML and inline SVG arrive self-contained (siblings
     * inlined by the daemon) and size-capped, so the renderer keeps them on the
     * `sandbox="" srcdoc` path — never a `src` URL, which would drop the parent CSP
     * that backstops agent-authored HTML. Nothing here rewrites or re-hosts them.
     */
    reviewReading: publicProcedure
      .input(procedureCatalog.reviewReading.input)
      .output(procedureCatalog.reviewReading.output)
      .query(
        ({ input }): Promise<ReviewReading | null> =>
          operations.readReviewReading({ projectPath: input }),
      ),

    /**
     * Intent as a document set: `.porcelain/active-review/intent/` rendered as
     * ordered tabs — the first reading of the Review canvas. HTML arrives
     * self-contained (siblings inlined by the daemon) so the renderer keeps it on
     * the `sandbox="" srcdoc` path — never a `src` URL, which would drop the parent
     * CSP that backstops agent-authored HTML.
     */
    reviewIntent: publicProcedure
      .input(procedureCatalog.reviewIntent.input)
      .output(procedureCatalog.reviewIntent.output)
      .query(
        ({ input }): Promise<ReviewDoc[]> => operations.readReviewIntent({ projectPath: input }),
      ),

    // The Review inbox: sibling worktrees of this checkout that carry work awaiting
    // review. A broken or deleted sibling that git still lists drops its row rather
    // than failing the whole inbox.
    reviewInbox: publicProcedure
      .input(procedureCatalog.reviewInbox.input)
      .output(procedureCatalog.reviewInbox.output)
      .query(
        ({ input }): Promise<InboxRow[]> => operations.listReviewInbox({ projectPath: input }),
      ),

    // Explore existing code read-only: seed from a symbol (or a whole file) and walk
    // the import/reference graph into the SAME flow-ordered, sliced reading surface —
    // no working-tree change, no agent. Files outside the working tree are read on
    // demand (bounded by the walk's depth/file caps + the source size cap).
    exploreReading: publicProcedure
      .input(procedureCatalog.exploreReading.input)
      .output(procedureCatalog.exploreReading.output)
      .query(
        ({ input }): Promise<ReviewReading> =>
          operations.exploreReview({ projectPath: input.repoPath, seed: input.seed }),
      ),
  })
}
