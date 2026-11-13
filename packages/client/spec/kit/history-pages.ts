export const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};
export const tip = 'a'.repeat(40);
export const frontier = 'b'.repeat(40);
export const root = 'c'.repeat(40);
export function commit(oid: string, subject: string) {
  return {
    oid,
    subject,
    parentOids: [],
    author: { name: 'Author', timestamp: '2026-10-06T00:00:00.000Z' },
    subjectTruncated: false,
    body: null,
    bodyTruncated: false,
    refs: [],
  };
}
export const firstPage = {
  snapshot: { tipOid: tip, head: { kind: 'attached', ref: 'refs/heads/main' } },
  commits: [commit(tip, 'Newest')],
  nextAfter: [frontier, root],
  tip,
  boundary: null,
  restarted: false,
};

export function restoredHistoryPage(older: boolean, fresh: boolean) {
  return {
    ...firstPage,
    commits: [
      commit(
        older ? root : tip,
        `${fresh ? 'Fresh' : 'Old'} ${older ? 'oldest' : 'newest'}`,
      ),
    ],
    nextAfter: older ? null : firstPage.nextAfter,
  };
}
