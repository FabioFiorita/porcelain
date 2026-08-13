import { procedureCatalog } from '@porcelain/contracts'
import type { FeatureReading, FeatureView } from '../../review/feature-view'
import { publicProcedure, t } from '../../trpc'
import type { InboxRow } from './review-reading-capabilities'
import type { ReviewReadingOperations } from './review-reading-operations'

/**
 * Review reading router — four wire procedures bound to the live catalog names.
 * Each procedure is parse → invoke one operation → serialize. None of them has an
 * expected typed failure: "no active review" is `null`, a vanished file is an empty
 * hunk list, a broken sibling worktree is a dropped row, and a genuine Git or
 * filesystem failure throws and serializes as `internal.unexpected`.
 */
export function createReviewReadingRouter(operations: ReviewReadingOperations) {
  return t.router({
    // The feature view (the Review's Execution outline): exactly the files the agent
    // listed in the review set (porcelain CLI → <repo>/.porcelain/review.json), in
    // agent order, with notes/layers/thesis/sections. Null without a set (the
    // renderer shows the "No review yet" empty state). Working-tree changes that
    // the agent did not list never appear here.
    featureView: publicProcedure
      .input(procedureCatalog.featureView.input)
      .output(procedureCatalog.featureView.output)
      .query(
        ({ input }): Promise<FeatureView | null> =>
          operations.readActiveReview({ projectPath: input }),
      ),

    /**
     * The Review document: thesis + walkthrough sections (prose/diagram + anchored
     * code blocks) + the leftover files flow-grouped, with just the relevant lines
     * and the loop-evidence meta as the final chapter. Review-set-only.
     *
     * Agent-authored section HTML and inline SVG arrive self-contained (siblings
     * inlined by the daemon) and size-capped, so the renderer keeps them on the
     * `sandbox="" srcdoc` path — never a `src` URL, which would drop the parent CSP
     * that backstops agent-authored HTML. Nothing here rewrites or re-hosts them.
     */
    featureReading: publicProcedure
      .input(procedureCatalog.featureReading.input)
      .output(procedureCatalog.featureReading.output)
      .query(
        ({ input }): Promise<FeatureReading | null> =>
          operations.readReviewReading({ projectPath: input }),
      ),

    // The Review inbox: sibling worktrees of this checkout that carry work awaiting
    // review. A broken or deleted sibling that git still lists drops its row rather
    // than failing the whole inbox.
    worktreeInbox: publicProcedure
      .input(procedureCatalog.worktreeInbox.input)
      .output(procedureCatalog.worktreeInbox.output)
      .query(
        ({ input }): Promise<InboxRow[]> => operations.listReviewInbox({ projectPath: input }),
      ),

    // Explore an existing feature read-only: seed from a symbol (or a whole file)
    // and walk the import/reference graph into the SAME flow-ordered, sliced reading
    // surface — no working-tree change, no agent. Files outside the working tree are
    // read on demand (bounded by the walk's depth/file caps + the source size cap).
    exploreFeature: publicProcedure
      .input(procedureCatalog.exploreFeature.input)
      .output(procedureCatalog.exploreFeature.output)
      .query(
        ({ input }): Promise<FeatureReading> =>
          operations.exploreReview({ projectPath: input.repoPath, seed: input.seed }),
      ),
  })
}
