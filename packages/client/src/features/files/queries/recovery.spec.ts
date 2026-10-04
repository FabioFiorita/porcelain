import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  directoryQueryOptions,
  pathsQueryOptions,
  textQueryOptions,
} from '@porcelain/client/files';

const environmentId = '87deba35-c65b-4fb6-9dfd-52bfbe76f64c';
const scope = {
  projectId: '156b8f7b-5513-4a0d-a4ae-e58e2d73a40f',
  worktreeId: '00000000000000000000000000000000',
};
const directory = {
  worktreeId: scope.worktreeId,
  path: 'src',
  entries: [{ name: 'index.ts', kind: 'file' }],
};
const paths = { worktreeId: scope.worktreeId, paths: ['src/index.ts'] };
const text = {
  worktreeId: scope.worktreeId,
  path: 'src/index.ts',
  encoding: 'utf-8',
  byteLength: 5,
  text: 'Hello',
};
const changed = {
  statusCode: 409,
  error: 'Conflict',
  message: 'Refresh status and retry inspection',
  code: 'worktree_changed',
};

function inventory(available = true): ReadInventoryResponse {
  return {
    environmentId,
    environment: { name: 'Computer', custom: true },
    projects: [
      {
        id: scope.projectId,
        name: 'Project',
        available: true,
        worktrees: [
          {
            id: scope.worktreeId,
            path: '/repository',
            main: true,
            branch: 'refs/heads/main',
            available,
            status: 'pending',
          },
        ],
      },
    ],
  };
}

function port(
  surface: 'directory' | 'paths' | 'text',
  options: {
    persistent?: boolean;
    available?: boolean;
    code?: string;
    cancel?: AbortController;
  } = {},
) {
  const requests: string[] = [];
  let failures = 0;
  const controller = new AbortController();
  const connected = {
    environmentId,
    request: (signal?: AbortSignal) => ({
      signal: AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]),
    }),
    transport: (path: string) => {
      const endpoint =
        new URL(path, 'http://porcelain.test').pathname.split('/').at(-1) ?? '';
      requests.push(endpoint);
      if (endpoint === surface && (failures++ === 0 || options.persistent))
        return Promise.resolve(
          Response.json(
            {
              ...changed,
              message:
                failures > 1
                  ? 'The worktree changed again during the reread.'
                  : changed.message,
              code: options.code ?? changed.code,
            },
            { status: 409 },
          ),
        );
      if (endpoint === 'inventory') {
        options.cancel?.abort();
        return Promise.resolve(
          Response.json(inventory(options.available ?? true)),
        );
      }
      return Promise.resolve(
        Response.json(
          endpoint === 'directory'
            ? directory
            : endpoint === 'paths'
              ? paths
              : text,
        ),
      );
    },
  };
  const query =
    surface === 'directory'
      ? directoryQueryOptions(scope, connected, 'src')
      : surface === 'paths'
        ? pathsQueryOptions(scope, connected)
        : textQueryOptions(scope, connected, 'src/index.ts');
  return { connected, query, requests, controller };
}

describe('recovering a Files read after the worktree changed', () => {
  it.each([
    ['directory', ['directory', 'inventory', 'directory'], directory],
    ['paths', ['paths', 'inventory', 'paths'], paths],
    ['text', ['text', 'inventory', 'directory', 'paths', 'text'], text],
  ] as const)(
    'refreshes the selection and affected lists before rereading %s',
    async (surface, requests, expected) => {
      const read = port(surface);
      const client = new QueryClient();
      client.setQueryData(['inventory', environmentId], inventory(false));
      expect(await client.query<unknown>(read.query)).toEqual(expected);
      expect(read.requests).toEqual(requests);
      expect(client.getQueryData(['inventory', environmentId])).toEqual(
        inventory(),
      );
      if (surface === 'text') {
        expect(
          client.getQueryData(
            directoryQueryOptions(scope, read.connected, 'src').queryKey,
          ),
        ).toEqual(directory);
        expect(
          client.getQueryData(
            pathsQueryOptions(scope, read.connected).queryKey,
          ),
        ).toEqual(paths);
      }
      client.clear();
    },
  );

  it.each([
    ['directory', ['directory', 'inventory', 'directory']],
    ['paths', ['paths', 'inventory', 'paths']],
    ['text', ['text', 'inventory', 'directory', 'paths', 'text']],
  ] as const)(
    'stops when %s still fails after one recovery',
    async (surface, requests) => {
      const read = port(surface, { persistent: true });
      const client = new QueryClient();
      await expect(client.query<unknown>(read.query)).rejects.toMatchObject({
        status: 409,
        code: 'worktree_changed',
        message: 'The worktree changed again during the reread.',
      });
      expect(read.requests).toEqual(requests);
      client.clear();
    },
  );

  it('stops before reading lists or text when the selected worktree is unavailable', async () => {
    const read = port('text', { available: false });
    const client = new QueryClient();
    await expect(client.query<unknown>(read.query)).rejects.toMatchObject({
      code: 'worktree_changed',
    });
    expect(read.requests).toEqual(['text', 'inventory']);
    client.clear();
  });

  it('does not start recovery for a content conflict', async () => {
    const read = port('text', { code: 'content_changed' });
    const client = new QueryClient();
    await expect(client.query<unknown>(read.query)).rejects.toMatchObject({
      code: 'content_changed',
    });
    expect(read.requests).toEqual(['text']);
    client.clear();
  });

  it('does not reread after the caller cancels during inventory refresh', async () => {
    const cancel = new AbortController();
    const read = port('text', { cancel });
    const client = new QueryClient();
    await expect(
      read.query.queryFn({ signal: cancel.signal, client }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(read.requests).toEqual(['text', 'inventory']);
    client.clear();
  });
});
