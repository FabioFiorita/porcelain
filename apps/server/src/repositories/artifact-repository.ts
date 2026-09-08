import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, sum } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { artifacts } from '../db/schema/artifacts.ts';
import { type ArtifactUpload, artifactLimits } from '../models/artifact.ts';
import { ArtifactQuotaError } from './errors/artifact-quota-error.ts';
import type { ArtifactStore } from './interfaces/artifact-store.ts';

const metadataColumns = {
  id: artifacts.id,
  worktreeId: artifacts.worktreeId,
  name: artifacts.name,
  sizeBytes: artifacts.sizeBytes,
  createdAt: artifacts.createdAt,
};
const address = (worktreeId: string, artifactId: string) =>
  and(eq(artifacts.worktreeId, worktreeId), eq(artifacts.id, artifactId));

export class ArtifactRepository implements ArtifactStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  create(worktreeId: string, input: ArtifactUpload, sizeBytes: number) {
    return this.db.transaction(
      (tx) => {
        const usage = tx
          .select({ count: count(), bytes: sum(artifacts.sizeBytes) })
          .from(artifacts)
          .get();
        if (
          (usage?.count ?? 0) >= artifactLimits.count ||
          Number(usage?.bytes ?? 0) + sizeBytes > artifactLimits.totalBytes
        )
          throw new ArtifactQuotaError();
        const metadata = {
          id: randomUUID(),
          worktreeId,
          name: input.name,
          sizeBytes,
          createdAt: new Date().toISOString(),
        };
        tx.insert(artifacts)
          .values({ ...metadata, content: input.content })
          .run();
        return metadata;
      },
      { behavior: 'immediate' },
    );
  }
  list(worktreeId: string) {
    return this.db
      .select(metadataColumns)
      .from(artifacts)
      .where(eq(artifacts.worktreeId, worktreeId))
      .orderBy(asc(artifacts.createdAt), asc(artifacts.id))
      .all();
  }
  get(worktreeId: string, artifactId: string) {
    return this.db
      .select()
      .from(artifacts)
      .where(address(worktreeId, artifactId))
      .get();
  }
  delete(worktreeId: string, artifactId: string) {
    return (
      this.db.delete(artifacts).where(address(worktreeId, artifactId)).run()
        .changes > 0
    );
  }
}
