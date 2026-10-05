import { expect, it } from 'vitest';
import { reviewsApi } from './api.ts';
import { runRequest } from '@porcelain/client/transport';
import { reviewedCommands } from '@porcelain/client/reviews';
import { QueryClient } from '@tanstack/query-core';

const worktreeId = 'a'.repeat(32);
const threadId = 'e460d734-9c2d-4769-bf11-ce78d14848c7';
const messageId = 'e34ac2de-0a58-4d9c-9890-8384b4e3d6a8';
const signal = new AbortController().signal;

it('uses the generated contract to encode and decode a comment create', async () => {
  const sent: { path: string; init: RequestInit | undefined }[] = [];
  const thread = {
    id: threadId,
    worktreeId,
    anchor: { kind: 'file', filePath: 'README.md' },
    messages: [
      {
        id: messageId,
        body: 'Ready',
        author: 'reviewer',
        createdAt: '2026-10-05T04:00:00.000Z',
      },
    ],
    resolved: false,
    revision: 1,
  };
  const api = reviewsApi({
    transport: (path, init) => {
      sent.push({ path, init });
      return Promise.resolve(Response.json(thread));
    },
  });
  const answer = await runRequest(
    api.createCommentThread({
      params: { worktreeId },
      payload: {
        anchor: { kind: 'file', filePath: 'README.md' },
        body: 'Ready',
        threadId,
        messageId,
      },
    }),
    signal,
  );
  expect(answer).toEqual(thread);
  expect(sent[0]?.path).toBe(`/api/worktrees/${worktreeId}/comments`);
  expect(sent[0]?.init?.method).toBe('POST');
  const sentBody = sent[0]?.init?.body;
  if (!(sentBody instanceof Uint8Array))
    throw new Error('Expected a JSON request encoded as bytes');
  expect(JSON.parse(new TextDecoder().decode(sentBody))).toEqual({
    anchor: { kind: 'file', filePath: 'README.md' },
    body: 'Ready',
    threadId,
    messageId,
  });
});

it('sends a branch bulk mark against the declared base and preserves the fingerprints', async () => {
  let body: unknown;
  const fingerprint = 'b'.repeat(64);
  const connection = {
    environmentId: 'environment',
    request: () => ({ signal }),
    transport: (_path: string, init?: RequestInit) => {
      const sentBody = init?.body;
      if (!(sentBody instanceof Uint8Array))
        throw new Error('Expected encoded request bytes');
      body = JSON.parse(new TextDecoder().decode(sentBody));
      return Promise.resolve(
        Response.json({ worktreeId, marks: [], marked: [], conflicts: [] }),
      );
    },
  };
  await runRequest(
    reviewedCommands(
      { projectId: 'project', worktreeId },
      connection,
      new QueryClient(),
      {
        kind: 'branch',
        base: 'refs/heads/main',
        branch: 'refs/heads/topic',
      },
      { now: () => '2026-10-05T04:00:00.000Z' },
    ).setAll([{ path: 'README.md', fingerprint }]),
    signal,
  );
  expect(body).toEqual({
    files: [{ path: 'README.md', fingerprint }],
    scope: 'branch',
    base: 'refs/heads/main',
  });
});

it('rejects an already cancelled write before invoking transport', async () => {
  const controller = new AbortController();
  controller.abort();
  let sent = 0;
  const api = reviewsApi({
    transport: () => {
      sent += 1;
      return Promise.resolve(Response.json({}));
    },
  });
  await expect(
    runRequest(
      api.createCommentThread({
        params: { worktreeId },
        payload: {
          anchor: { kind: 'file', filePath: 'README.md' },
          body: 'Ready',
        },
      }),
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(sent).toBe(0);
});
