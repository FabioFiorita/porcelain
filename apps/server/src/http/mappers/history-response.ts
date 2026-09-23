import type {
  CommitDiffsResponse,
  CommitFilesResponse,
} from '@porcelain/contracts/commit-changes';
import type { CommitPageResponse } from '@porcelain/contracts/commit-history';
import type {
  CommitFiles,
  CommitPage,
  CommitSummary,
} from '@porcelain/git/dtos/commit-history';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';

const toCommitSummary = (commit: CommitSummary) => ({
  oid: commit.oid,
  parentOids: [...commit.parentOids],
  author: { name: commit.author.name, timestamp: commit.author.timestamp },
  subject: commit.subject,
  subjectTruncated: commit.subjectTruncated,
  body: commit.body,
  bodyTruncated: commit.bodyTruncated,
  refs: [...commit.refs],
});

export function toCommitPageResponse(page: CommitPage): CommitPageResponse {
  const head = page.snapshot?.head;
  return {
    snapshot:
      page.snapshot && head
        ? {
            tipOid: page.snapshot.tipOid,
            head:
              head.kind === 'detached'
                ? { kind: head.kind }
                : { kind: head.kind, ref: head.ref },
          }
        : null,
    commits: page.commits.map(toCommitSummary),
    nextAfter: page.nextAfter ? [...page.nextAfter] : null,
    tip: page.tip,
    boundary: page.boundary,
    restarted: page.restarted,
  };
}

export function toCommitFilesResponse(
  result: CommitFiles,
): CommitFilesResponse {
  return {
    commit: toCommitSummary(result.commit),
    comparison:
      result.comparison.kind === 'empty-tree'
        ? { kind: 'empty-tree' }
        : {
            kind: 'parent',
            parentNumber: result.comparison.parentNumber,
            baseOid: result.comparison.baseOid,
          },
    files: result.files.map((file) => ({
      oldPath: file.oldPath,
      newPath: file.newPath,
      status: file.status,
      oldMode: file.oldMode,
      newMode: file.newMode,
    })),
  };
}

export function toCommitDiffsResponse(
  commitOid: string,
  paths: readonly (readonly string[])[],
  sections: Map<string, GitDiffResult> | null,
): CommitDiffsResponse {
  return {
    commitOid,
    diffs: paths.map((entry) => ({
      paths: [...entry],
      content:
        sections === null
          ? { kind: 'omitted', reason: 'size-limit' }
          : (sections.get(entry.join('\0')) ?? {
              kind: 'metadata-only',
              patch: '',
            }),
    })),
  };
}
