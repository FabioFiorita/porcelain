import type { CommitFiles } from '../../src/models/commit-history.ts';

export function rootCommit(oid: string): CommitFiles {
  return {
    commit: {
      oid,
      parentOids: [],
      author: { name: 'Author', timestamp: '2026-01-01T00:00:00.000Z' },
      subject: 'Initial commit',
      subjectTruncated: false,
      body: undefined,
      bodyTruncated: false,
      refs: [],
    },
    comparison: { kind: 'empty-tree' },
    files: [],
  };
}
