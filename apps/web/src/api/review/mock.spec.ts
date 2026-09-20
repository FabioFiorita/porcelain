import { describe, expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createReviewMock } from './mock';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
  signal: new AbortController().signal,
};

describe('mock review artifacts', () => {
  it('returns deterministic content and resolves duplicate names by ID', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    if (!fixture) throw new Error('Missing fixture review');
    const first = fixture.artifacts[0];
    if (!first) throw new Error('Missing fixture artifact');
    const duplicateId = 'afa08127-5c27-46bf-9d06-e8401f2aa104';
    fixture.artifacts.push({
      ...first,
      id: duplicateId,
      content: 'The duplicate report has different content.',
      sizeBytes: 'The duplicate report has different content.'.length,
    });

    const api = createReviewMock(store);
    const metadata = await api.artifacts(scope);
    expect(metadata.every((artifact) => !('content' in artifact))).toBe(true);
    expect(
      metadata.filter((artifact) => artifact.name === first.name),
    ).toHaveLength(2);
    await expect(
      api.artifact({ ...scope, artifactId: first.id }),
    ).resolves.toMatchObject({
      id: first.id,
      content: expect.stringContaining('Fieldnotes launch review'),
    });
    await expect(
      api.artifact({ ...scope, artifactId: duplicateId }),
    ).resolves.toMatchObject({
      id: duplicateId,
      name: first.name,
      content: 'The duplicate report has different content.',
    });
  });
});

describe('mock reviewed evidence', () => {
  it('groups dual-scope paths, transitions to stale, and isolates worktrees', async () => {
    const store = createMockStore();
    const fixture = store.review[scope.worktreeId];
    if (!fixture) throw new Error('Missing fixture review');
    const existing = fixture.status.changes[0];
    if (!existing || !('kind' in existing))
      throw new Error('Missing ordinary fixture change');
    fixture.status.changes.push({ ...existing, scope: 'unstaged' });
    const path = existing.newPath ?? existing.oldPath;
    if (!path) throw new Error('Missing fixture change path');

    const api = createReviewMock(store);
    const evidence = await api.evidence(scope);
    const grouped = evidence.evidence.find((entry) => entry.path === path);
    if (!grouped) throw new Error('Missing grouped evidence');
    expect(grouped.comparisons).toHaveLength(2);
    expect(grouped.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    if (!grouped.fingerprint) throw new Error('Missing evidence fingerprint');

    await api.reviewed.set({
      ...scope,
      input: { path, reviewed: true, fingerprint: grouped.fingerprint },
    });
    await expect(api.reviewed.list(scope)).resolves.toMatchObject({
      marks: [{ path, fingerprint: grouped.fingerprint }],
    });

    fixture.files[path] = `${fixture.files[path] ?? ''}\nchanged`;
    const changed = (await api.evidence(scope)).evidence.find(
      (entry) => entry.path === path,
    );
    expect(changed?.fingerprint).not.toBe(grouped.fingerprint);
    expect((await api.reviewed.list(scope)).marks[0]?.fingerprint).toBe(
      grouped.fingerprint,
    );

    const other = {
      ...scope,
      worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4c',
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
    fixture.status.changes.push({
      scope: 'unmerged',
      path: 'conflict.ts',
      conflict: 'UU',
    });
    const evidence = await createReviewMock(store).evidence(scope);
    expect(
      evidence.evidence.find((entry) => entry.path === 'conflict.ts'),
    ).toMatchObject({
      fingerprint: null,
      comparisons: [{ content: { kind: 'omitted', reason: 'conflict' } }],
    });
  });
});
