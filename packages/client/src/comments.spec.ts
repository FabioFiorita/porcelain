import { expect, it } from 'vitest';
import { createCommentsClient } from './comments.ts';

const request = {
  worktreeId: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
  token: 'fixture',
  signal: new AbortController().signal,
};
it('posts a literal file anchor and validates the returned discussion', async () => {
  const input = {
    anchor: { kind: 'file', filePath: 'src/a#b.ts' },
    body: '<script>literal feedback</script>',
  };
  const transport: typeof fetch = async (url, init) => {
    expect(url).toBe(`/api/worktrees/${request.worktreeId}/comments`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(input);
    expect(init?.credentials).toBe('omit');
    expect(init?.redirect).toBe('error');
    return Response.json([
      {
        id: crypto.randomUUID(),
        worktreeId: request.worktreeId,
        anchor: input.anchor,
        resolved: false,
        messages: [{ id: crypto.randomUUID(), body: input.body }],
      },
    ]);
  };
  expect(
    (
      await createCommentsClient(transport, '/api').create({
        ...request,
        input,
      })
    )[0]?.messages[0]?.body,
  ).toBe(input.body);
});
it('rejects malformed data and reports uncertain writes without retrying or exposing diagnostics', async () => {
  const invalid: typeof fetch = async () =>
    Response.json({ secret: 'private' });
  await expect(
    createCommentsClient(invalid, '/api').list(request),
  ).rejects.toThrow('Could not reach the discussion');
  let calls = 0;
  const lost: typeof fetch = async () => {
    calls++;
    throw new Error('private');
  };
  await expect(
    createCommentsClient(lost, '/api').create({
      ...request,
      input: { anchor: { kind: 'file', filePath: 'a.ts' }, body: 'Feedback' },
    }),
  ).rejects.toThrow('your comment may have been saved');
  expect(calls).toBe(1);
});

it('reports a timed-out write as uncertain rather than inviting an immediate retry', async () => {
  const controller = new AbortController();
  const transport: typeof fetch = async () => {
    controller.abort(new DOMException('Timeout', 'TimeoutError'));
    throw controller.signal.reason;
  };
  await expect(
    createCommentsClient(transport, '/api').create({
      ...request,
      signal: controller.signal,
      input: { anchor: { kind: 'file', filePath: 'a.ts' }, body: 'Feedback' },
    }),
  ).rejects.toThrow('your comment may have been saved');
});
