import { describe, expect, it } from 'vitest';
import { ContentChangedError } from '@porcelain/files/errors';
import { filesApi } from './api.ts';
import { runRequest } from '@porcelain/client/transport';

const worktreeId = '0123456789abcdef0123456789abcdef';
const params = { worktreeId };
const signal = new AbortController().signal;
const write = {
  kind: 'write',
  path: 'README.md',
  text: 'Saved',
  expectedFingerprint: 'a'.repeat(64),
} as const;

describe('generated Files client', () => {
  it('encodes reserved path characters once and uses the transport policy', async () => {
    const sent: { path: string; init: RequestInit | undefined }[] = [];
    const api = filesApi({
      transport: (path, init) => {
        sent.push({ path, init });
        return Promise.resolve(
          Response.json({
            worktreeId,
            path: 'a b/#?.txt',
            text: 'Hello',
            encoding: 'utf-8',
            byteLength: 5,
          }),
        );
      },
    });
    await expect(
      runRequest(
        api.readTextFile({ params, query: { path: 'a b/#?.txt' } }),
        signal,
      ),
    ).resolves.toMatchObject({ text: 'Hello' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe(
      `/api/worktrees/${worktreeId}/text?path=a+b%2F%23%3F.txt`,
    );
    expect(sent[0]?.init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
    });
    expect(sent[0]?.init?.signal?.aborted).toBe(false);
  });

  it('validates the write payload before transport and encodes JSON', async () => {
    const sent: RequestInit[] = [];
    const api = filesApi({
      transport: (_path, init) => {
        if (init) sent.push(init);
        return Promise.resolve(Response.json({ path: 'README.md' }));
      },
    });
    await expect(
      runRequest(api.editFile({ params, payload: write }), signal),
    ).resolves.toEqual({ path: 'README.md' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const body = sent[0]?.body;
    if (!(body instanceof Uint8Array))
      throw new Error('Expected a JSON request encoded as bytes');
    expect(new TextDecoder().decode(body)).toBe(JSON.stringify(write));
    await expect(
      runRequest(
        api.editFile({
          params,
          payload: { ...write, expectedFingerprint: 'bad' },
        }),
        signal,
      ),
    ).rejects.toThrow();
    expect(sent).toHaveLength(1);
  });

  it('decodes the declared conflict into its domain failure', async () => {
    const api = filesApi({
      transport: () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: 'Content changed; retry the operation',
              code: 'content_changed',
            },
            { status: 409 },
          ),
        ),
    });
    const failure = await runRequest(
      api.editFile({ params, payload: write }),
      signal,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ContentChangedError);
    expect(failure).toMatchObject({ _tag: 'ContentChangedError' });
  });

  it('does not decode a conflict code received at the wrong status', async () => {
    const api = filesApi({
      transport: () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 422,
              error: 'Unprocessable Entity',
              message: 'Wrong status',
              code: 'content_changed',
            },
            { status: 422 },
          ),
        ),
    });
    const failure = await runRequest(
      api.editFile({ params, payload: write }),
      signal,
    ).catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(ContentChangedError);
  });

  it('rejects malformed success data', async () => {
    const api = filesApi({
      transport: () => Promise.resolve(Response.json({ malformed: true })),
    });
    await expect(
      runRequest(
        api.readTextFile({ params, query: { path: 'README.md' } }),
        signal,
      ),
    ).rejects.toThrow();
  });

  it('does not start a request after its caller disconnects', async () => {
    const controller = new AbortController();
    const cancelled = new Error('Workspace disconnected');
    controller.abort(cancelled);
    let sent = 0;
    const api = filesApi({
      transport: () => {
        sent += 1;
        return Promise.resolve(Response.json({}));
      },
    });
    await expect(
      runRequest(
        api.readTextFile({ params, query: { path: 'README.md' } }),
        controller.signal,
      ),
    ).rejects.toBe(cancelled);
    expect(sent).toBe(0);
  });
});
