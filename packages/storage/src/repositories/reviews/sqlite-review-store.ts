import { and, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewProofFiles } from '../../db/schema/review-proof-files.ts';
import { reviews } from '../../db/schema/reviews.ts';
import type {
  ProofFile,
  ProofFileKey,
  Review,
  ReviewSave,
  ReviewSummary,
} from '@porcelain/reviews/models';
import type { ReviewStore } from '@porcelain/reviews/ports';

type ReviewRow = typeof reviews.$inferSelect;

function reviewFromRow(row: ReviewRow): Review {
  const { diagram, proof, ...rest } = row;
  return {
    ...rest,
    ...(diagram === null ? {} : { diagram }),
    ...(proof === null ? {} : { proof }),
  };
}

export class SqliteReviewStore implements ReviewStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(input: { worktreeId: string }): Review | undefined {
    const row = this.db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, input.worktreeId))
      .get();
    return row && reviewFromRow(row);
  }

  byWorktrees(input: { worktreeIds: readonly string[] }): Review[] {
    return this.db
      .select()
      .from(reviews)
      .where(inArray(reviews.worktreeId, [...input.worktreeIds]))
      .all()
      .map(reviewFromRow);
  }

  findSummary(input: { token: string }): ReviewSummary | undefined {
    return this.db
      .select({
        summaryHtml: reviews.summaryHtml,
        summaryToken: reviews.summaryToken,
        summarySecret: reviews.summarySecret,
      })
      .from(reviews)
      .where(eq(reviews.summaryToken, input.token))
      .get();
  }

  save(input: ReviewSave): void {
    const { proofFiles, ...review } = input;
    const row = {
      ...review,
      diagram: review.diagram ?? null,
      proof: review.proof ?? null,
    };
    const files = (proofFiles ?? []).map((file) => ({
      worktreeId: review.worktreeId,
      id: file.id,
      mediaType: file.mediaType,
      bytes: Buffer.from(
        file.bytes.buffer,
        file.bytes.byteOffset,
        file.bytes.byteLength,
      ),
    }));
    this.db.transaction(
      (tx) => {
        tx.insert(reviews)
          .values(row)
          .onConflictDoUpdate({ target: reviews.worktreeId, set: row })
          .run();
        tx.delete(reviewProofFiles)
          .where(eq(reviewProofFiles.worktreeId, review.worktreeId))
          .run();
        for (const file of files)
          tx.insert(reviewProofFiles).values(file).run();
      },
      { behavior: 'immediate' },
    );
  }

  readProofFile(input: ProofFileKey): ProofFile | undefined {
    const row = this.db
      .select({
        id: reviewProofFiles.id,
        mediaType: reviewProofFiles.mediaType,
        bytes: reviewProofFiles.bytes,
      })
      .from(reviewProofFiles)
      .where(
        and(
          eq(reviewProofFiles.worktreeId, input.worktreeId),
          eq(reviewProofFiles.id, input.proofId),
        ),
      )
      .get();
    return (
      row && {
        id: row.id,
        mediaType: row.mediaType,
        bytes: new Uint8Array(row.bytes),
      }
    );
  }

  setActive(input: {
    worktreeId: string;
    revision: number;
    active: boolean;
  }): void {
    this.db.transaction(
      (tx) => {
        tx.update(reviews)
          .set({ active: input.active })
          .where(
            and(
              eq(reviews.worktreeId, input.worktreeId),
              eq(reviews.revision, input.revision),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
