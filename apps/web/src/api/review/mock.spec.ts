import { describe, expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createReviewMock } from './mock';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
  token: 'fixture-token',
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
