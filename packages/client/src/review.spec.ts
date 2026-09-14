import { describe, expect, it } from 'vitest';
import { createGitActionsClient } from './git-actions.ts';
import { createReviewClient } from './review.ts';

const scope = {
  token: 'disposable-token',
  signal: new AbortController().signal,
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
};
describe('review transport', () => {
  it('encodes literal file paths and validates text without treating it as HTML', async () => {
    const transport: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/text?path=src%2Fa%23b.ts`,
      );
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer disposable-token',
      });
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('error');
      return Response.json({
        worktreeId: scope.worktreeId,
        path: 'src/a#b.ts',
        encoding: 'utf-8',
        byteLength: 8,
        text: '<script>',
      });
    };
    expect(
      (
        await createReviewClient(transport, '/api').text({
          ...scope,
          path: 'src/a#b.ts',
        })
      ).text,
    ).toBe('<script>');
  });
  it('rejects malformed successful responses and sanitizes server diagnostics', async () => {
    const malformed: typeof fetch = async () =>
      Response.json({ text: 'private diagnostic' });
    await expect(
      createReviewClient(malformed, '/api').text({ ...scope, path: 'a' }),
    ).rejects.toThrow('Could not load review data');
    const failure: typeof fetch = async () =>
      new Response('private diagnostic', { status: 500 });
    await expect(
      createReviewClient(failure, '/api').artifacts(scope),
    ).rejects.toThrow('This review surface could not be loaded');
  });
  it('loads artifact content through the scoped artifact endpoint', async () => {
    const artifactId = '901a8628-1cd6-4562-81a2-9c05fba76b4a';
    const transport: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/artifacts/${artifactId}`,
      );
      expect(init?.method).toBeUndefined();
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer disposable-token',
      });
      return Response.json({
        id: artifactId,
        worktreeId: scope.worktreeId,
        name: 'handoff.html',
        sizeBytes: 24,
        createdAt: '2026-09-13T10:00:00.000Z',
        content: '<h1>Ready</h1>',
      });
    };
    await expect(
      createReviewClient(transport, '/api').artifact({
        ...scope,
        artifactId,
      }),
    ).resolves.toMatchObject({
      id: artifactId,
      content: '<h1>Ready</h1>',
    });
  });
  it('adds a selected merge parent to the commit changes request', async () => {
    const oid = 'a'.repeat(40);
    const parent = 2;
    const transport: typeof fetch = async (input) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/commits/${oid}/changes?parent=${parent}`,
      );
      return Response.json({
        commitOid: oid,
        parentOids: ['b'.repeat(40), 'c'.repeat(40)],
        comparison: {
          kind: 'parent',
          parentNumber: parent,
          baseOid: 'c'.repeat(40),
        },
        changes: [],
      });
    };

    await expect(
      createReviewClient(transport, '/api').commit({ ...scope, oid, parent }),
    ).resolves.toMatchObject({
      comparison: { parentNumber: parent, baseOid: 'c'.repeat(40) },
    });
  });
  it('loads complete review evidence and durable reviewed marks through scoped routes', async () => {
    const fingerprint = 'a'.repeat(64);
    const calls: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      calls.push(String(input));
      if (String(input).endsWith('/evidence'))
        return Response.json({
          environmentId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
          worktreeId: scope.worktreeId,
          statusToken: 'b'.repeat(64),
          consistency: 'best-effort',
          evidence: [],
        });
      if (String(input).includes('/reviewed?path=')) {
        expect(init?.method).toBe('DELETE');
        return Response.json({ worktreeId: scope.worktreeId, marks: [] });
      }
      expect(String(input)).toBe(`/api/worktrees/${scope.worktreeId}/reviewed`);
      if (init?.method === 'PUT') {
        expect(JSON.parse(String(init.body))).toEqual({
          path: 'src/review.ts',
          reviewed: true,
          fingerprint,
        });
      }
      return Response.json({ worktreeId: scope.worktreeId, marks: [] });
    };
    const client = createReviewClient(transport, '/api');
    await expect(client.evidence(scope)).resolves.toMatchObject({
      worktreeId: scope.worktreeId,
      evidence: [],
    });
    await expect(client.reviewed.list(scope)).resolves.toEqual({
      worktreeId: scope.worktreeId,
      marks: [],
    });
    await expect(
      client.reviewed.set({
        ...scope,
        input: { path: 'src/review.ts', reviewed: true, fingerprint },
      }),
    ).resolves.toEqual({ worktreeId: scope.worktreeId, marks: [] });
    await expect(
      client.reviewed.remove({ ...scope, path: 'src/review.ts' }),
    ).resolves.toEqual({ worktreeId: scope.worktreeId, marks: [] });
    expect(calls).toEqual([
      `/api/worktrees/${scope.worktreeId}/evidence`,
      `/api/worktrees/${scope.worktreeId}/reviewed`,
      `/api/worktrees/${scope.worktreeId}/reviewed`,
      `/api/worktrees/${scope.worktreeId}/reviewed?path=src%2Freview.ts`,
    ]);
  });
  it('preserves a conflict receipt and its request identity instead of treating it as a retryable write failure', async () => {
    const requestId = '801a8628-1cd6-4562-81a2-9c05fba76b4b';
    const preparationId = '801a8628-1cd6-4562-81a2-9c05fba76b4c';
    const transport: typeof fetch = async (input, init) => {
      expect(String(input)).toContain('/git/stash/pop');
      expect(JSON.parse(String(init?.body))).toEqual({
        requestId,
        preparationId,
      });
      return Response.json(
        {
          requestId,
          preparationId,
          projectId: scope.projectId,
          worktreeId: scope.worktreeId,
          action: 'stash-pop',
          state: 'conflicted',
          refreshRequired: true,
          acceptedAt: 1,
          reason: 'GIT_REJECTED',
        },
        { status: 409 },
      );
    };
    const receipt = await createGitActionsClient(transport, '/api').execute({
      ...scope,
      requestId,
      preparationId,
      action: 'stash-pop',
    });
    expect(receipt.state).toBe('conflicted');
    expect(receipt.requestId).toBe(requestId);
  });
});
