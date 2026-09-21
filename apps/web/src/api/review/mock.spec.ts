import { describe, expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createReviewMock } from './mock';
import { publishedReviewFixture } from './published-fixture';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
  signal: new AbortController().signal,
};

describe('mock published reviews', () => {
  it('keeps the latest review isolated by worktree', async () => {
    const store = createMockStore();
    store.publishedReviews[scope.worktreeId] = publishedReviewFixture(
      scope.worktreeId,
      store.inventory.environmentId,
    );
    const api = createReviewMock(store);
    const review = await api.review(scope);
    expect(review?.revision).toBe(1);
    if (review) review.layers.length = 0;
    expect((await api.review(scope))?.layers).toHaveLength(1);
  });
});

describe('mock change list', () => {
  it('groups dual-scope paths, transitions to stale, and isolates worktrees', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    if (!fixture) throw new Error('Missing fixture review');
    const existing = fixture.git.comparisons[0];
    if (!existing || !('kind' in existing))
      throw new Error('Missing ordinary fixture change');
    fixture.git.comparisons.push({ ...existing, scope: 'unstaged' });
    const path = existing.newPath ?? existing.oldPath;
    if (!path) throw new Error('Missing fixture change path');

    const api = createReviewMock(store);
    const { changes } = await api.changes(scope);
    const grouped = changes.changes.find((entry) => entry.path === path);
    if (!grouped) throw new Error('Missing grouped change');
    expect(grouped.comparisons).toHaveLength(2);
    expect(grouped.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    if (!grouped.fingerprint) throw new Error('Missing change fingerprint');

    await api.reviewed.set({
      ...scope,
      input: { path, reviewed: true, fingerprint: grouped.fingerprint },
    });
    await expect(api.reviewed.list(scope)).resolves.toMatchObject({
      marks: [{ path, fingerprint: grouped.fingerprint }],
    });

    fixture.files[path] = `${fixture.files[path] ?? ''}\nchanged`;
    const changed = (await api.changes(scope)).changes.changes.find(
      (entry) => entry.path === path,
    );
    expect(changed?.fingerprint).not.toBe(grouped.fingerprint);
    expect((await api.reviewed.list(scope)).marks[0]?.fingerprint).toBe(
      grouped.fingerprint,
    );

    const other = {
      ...scope,
      worktreeId: '629a86281cd6456281a29c05fba76b4c',
    };
    await expect(api.reviewed.list(other)).resolves.toEqual({
      worktreeId: other.worktreeId,
      marks: [],
    });
  });

  it('returns null fingerprints for conflicts so the UI can show but not mark them', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    if (!fixture) throw new Error('Missing fixture review');
    fixture.git.comparisons.push({
      scope: 'unmerged',
      path: 'conflict.ts',
      conflict: 'UU',
    });
    const { changes } = await createReviewMock(store).changes(scope);
    expect(
      changes.changes.find((entry) => entry.path === 'conflict.ts'),
    ).toMatchObject({
      fingerprint: null,
      comparisons: [{ scope: 'unmerged', conflict: 'UU' }],
    });
  });
});
