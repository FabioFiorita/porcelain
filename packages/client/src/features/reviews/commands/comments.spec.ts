import { runRequest } from '@porcelain/client/transport';
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { commentCommands } from './comments.ts';
import { commentsQueryOptions } from '@porcelain/client/reviews';

const scope = {
  projectId: 'project',
  worktreeId: '00000000000000000000000000000000',
};

describe('comment writes report failed intent', () => {
  it('rejects dependent writes and leaves the discussion cache unchanged after a failed create', async () => {
    const requests: string[] = [];
    const controller = new AbortController();
    const connection = {
      environmentId: 'environment',
      request: () => ({ signal: controller.signal }),
      transport: (path: string) => {
        requests.push(path);
        return Promise.resolve(
          Response.json(
            {
              statusCode: 403,
              error: 'Forbidden',
              message: 'Comment was refused',
            },
            { status: 403 },
          ),
        );
      },
    };
    const client = new QueryClient();
    const key = commentsQueryOptions(scope, connection).queryKey;
    client.setQueryData(key, []);
    const commands = commentCommands(scope, connection, client);
    const create = runRequest(
      commands.create({
        anchor: { kind: 'change' },
        body: 'Please explain the change.',
      }),
      controller.signal,
    );
    const reply = runRequest(
      commands.reply({
        threadId: 'bb6a4c6a-4898-426c-ac20-bf4f53fc47d7',
        body: 'A dependent reply.',
        messageId: 'eb90812a-6a3e-464e-92ca-5c962094b867',
      }),
      controller.signal,
    );
    const results = await Promise.allSettled([create, reply]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: {
        message: 'An earlier change failed, so this one was not sent.',
        cause: { message: 'Comment was refused', status: 403 },
      },
    });
    await expect(create).rejects.toMatchObject({
      message: 'Comment was refused',
      status: 403,
    });
    expect(requests).toEqual([
      '/api/worktrees/00000000000000000000000000000000/comments',
    ]);
    expect(client.getQueryData(key)).toEqual([]);
  });
});
