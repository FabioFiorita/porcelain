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
