import { describe, expect, it } from 'vitest';
import { createGitActionsClient } from './git-actions.ts';
import { createReviewClient } from './review.ts';

const scope = {
  signal: new AbortController().signal,
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '801a86281cd6456281a29c05fba76b4a',
};
describe('review transport', () => {
  it('encodes literal file paths and validates text without treating it as HTML', async () => {
    const transport: typeof fetch = async (input, init) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/text?path=src%2Fa%23b.ts`,
      );
      expect(init?.headers).not.toHaveProperty('authorization');
      expect(init?.credentials).toBe('same-origin');
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
      expect(init?.headers).not.toHaveProperty('authorization');
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
  it('adds a selected merge parent to the commit files request', async () => {
    const oid = 'a'.repeat(40);
    const parent = 2;
    const transport: typeof fetch = async (input) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/commits/${oid}/files?parent=${parent}`,
      );
      return Response.json({
        commit: {
          oid,
          parentOids: ['b'.repeat(40), 'c'.repeat(40)],
          author: { name: 'Ada', timestamp: '2026-09-14T00:00:00Z' },
          subject: 'Subject',
          subjectTruncated: false,
          body: null,
          bodyTruncated: false,
          refs: [],
        },
        comparison: {
          kind: 'parent',
          parentNumber: parent,
          baseOid: 'c'.repeat(40),
        },
        files: [],
      });
    };

    await expect(
      createReviewClient(transport, '/api').commit({ ...scope, oid, parent }),
    ).resolves.toMatchObject({
      comparison: { parentNumber: parent, baseOid: 'c'.repeat(40) },
    });
  });
  it('validates commit body truncation metadata and refs from history', async () => {
    const oid = 'a'.repeat(40);
    const transport: typeof fetch = async (input) => {
      expect(String(input)).toBe(
        `/api/worktrees/${scope.worktreeId}/commits?limit=50`,
      );
      return Response.json({
        snapshot: {
          tipOid: oid,
          head: { kind: 'attached', ref: 'refs/heads/main' },
        },
        commits: [
          {
            oid,
            parentOids: [],
            author: { name: 'Ada', timestamp: '2026-09-14T00:00:00Z' },
            subject: 'Subject',
            subjectTruncated: false,
            body: 'line one\nline two',
            bodyTruncated: false,
            refs: ['main', 'v1'],
          },
        ],
        nextAfter: null,
        tip: oid,
        boundary: null,
        restarted: false,
      });
    };

    await expect(
      createReviewClient(transport, '/api').history(scope),
    ).resolves.toMatchObject({
      commits: [
        {
          body: 'line one\nline two',
          bodyTruncated: false,
          refs: ['main', 'v1'],
        },
      ],
    });
  });
  it('loads the change list, its diffs and durable reviewed marks through scoped routes', async () => {
    const fingerprint = 'a'.repeat(64);
    const calls: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      calls.push(String(input));
      if (String(input).endsWith('/changes/diffs')) {
        expect(init?.method).toBe('POST');
        return Response.json({
          environmentId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
          worktreeId: scope.worktreeId,
          statusToken: 'b'.repeat(64),
          diffs: [
            {
              selection: {
                scope: 'unstaged',
                oldPath: 'src/review.ts',
                newPath: 'src/review.ts',
              },
              content: { kind: 'text', patch: '@@ -1 +1 @@\n-a\n+b\n' },
            },
          ],
        });
      }
      if (String(input).endsWith('/changes'))
        return Response.json({
          environmentId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
          worktreeId: scope.worktreeId,
          statusToken: 'b'.repeat(64),
          headOid: null,
          branch: null,
          changes: [],
        });
      if (String(input).endsWith('/review-layers'))
        return Response.json({
          worktreeId: scope.worktreeId,
          revision: 0,
          layers: [],
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
    await expect(client.changes(scope)).resolves.toMatchObject({
      changes: { worktreeId: scope.worktreeId, changes: [] },
      layers: { worktreeId: scope.worktreeId, layers: [] },
    });
    // The hunks are their own request, made against the observation the list
    // was read at and naming the exact comparisons asked for.
    await expect(
      client.diffs({
        ...scope,
        input: {
          expectedStatusToken: 'b'.repeat(64),
          expectedFiles: [
            { path: 'src/review.ts', fingerprint: 'c'.repeat(64) },
          ],
          selections: [
            {
              scope: 'unstaged',
              oldPath: 'src/review.ts',
              newPath: 'src/review.ts',
            },
          ],
        },
      }),
    ).resolves.toMatchObject({ diffs: [{ content: { kind: 'text' } }] });
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
      `/api/worktrees/${scope.worktreeId}/changes`,
      `/api/worktrees/${scope.worktreeId}/review-layers`,
      `/api/worktrees/${scope.worktreeId}/changes/diffs`,
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

it('preserves typed file refusal codes without accepting malformed errors', async () => {
  const transport: typeof fetch = async () =>
    Response.json(
      {
        code: 'UNSUPPORTED_TEXT',
        message: 'Not UTF-8 text',
      },
      { status: 422 },
    );
  await expect(
    createReviewClient(transport, '/api').text({ ...scope, path: 'image.png' }),
  ).rejects.toMatchObject({
    name: 'RequestError',
    code: 'UNSUPPORTED_TEXT',
    status: 422,
  });
});

it('reads image assets through the authenticated private transport', async () => {
  const transport: typeof fetch = async (input, init) => {
    expect(String(input)).toBe(
      `/api/worktrees/${scope.worktreeId}/asset?path=img%2Fa%23b.png`,
    );
    expect(init?.headers).not.toHaveProperty('authorization');
    expect(init?.cache).toBe('no-store');
    expect(init?.credentials).toBe('same-origin');
    return Response.json({
      path: 'img/a#b.png',
      mediaType: 'image/png',
      base64: 'AA==',
    });
  };
  expect(
    (
      await createReviewClient(transport, '/api').asset({
        ...scope,
        path: 'img/a#b.png',
      })
    ).mediaType,
  ).toBe('image/png');
});
