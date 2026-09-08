import type { CommitChangesResponse } from '@porcelain/contracts/commit-changes';
import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import type {
  CommitChanges,
  CommitPage,
} from '../../git/dtos/commit-history.ts';

export function toCommitPageResponse(page: CommitPage): CommitPageResponse {
  const head = page.snapshot.head;
  return {
    snapshot: {
      tipOid: page.snapshot.tipOid,
      head:
        head.kind === 'detached'
          ? { kind: head.kind }
          : { kind: head.kind, ref: head.ref },
    },
    commits: page.commits.map((commit) => ({
      oid: commit.oid,
      parentOids: [...commit.parentOids],
      author: { name: commit.author.name, timestamp: commit.author.timestamp },
      subject: commit.subject,
      subjectTruncated: commit.subjectTruncated,
    })),
    nextCursor: page.nextCursor,
    boundary: page.boundary,
  };
}

export function toCommitChangesResponse(
  result: CommitChanges,
): CommitChangesResponse {
  return {
    commitOid: result.commitOid,
    parentOids: [...result.parentOids],
    comparison:
      result.comparison.kind === 'empty-tree'
        ? { kind: 'empty-tree' }
        : {
            kind: 'parent',
            parentNumber: result.comparison.parentNumber,
            baseOid: result.comparison.baseOid,
          },
    changes: result.changes.map((change) => ({
      oldPath: change.oldPath,
      newPath: change.newPath,
      status: change.status,
      oldMode: change.oldMode,
      newMode: change.newMode,
      patch:
        change.patch.kind === 'binary'
          ? { kind: 'binary' }
          : { kind: change.patch.kind, text: change.patch.text },
    })),
  };
}
