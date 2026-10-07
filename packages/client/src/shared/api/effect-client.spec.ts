import { AccessApi } from '@porcelain/contracts/access';
import { ChangesApi } from '@porcelain/contracts/changes';
import { GitActionsApi } from '@porcelain/contracts/git-actions';
import {
  ContentChangedError,
  FileTooLargeError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { Cause, Effect, Exit, Layer } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { describe, expect, it } from 'vitest';

import {
  mapRequestErrors,
  requestEffect,
  transportLayer,
} from './effect-client.ts';
import {
  createWorktreeConnection,
  RequestError,
} from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

const worktreeId = '0123456789abcdef0123456789abcdef';
const signal = () => new AbortController().signal;
const access = (transport: Transport) =>
  Effect.runSync(
    HttpApiClient.make(AccessApi).pipe(
      Effect.provide(transportLayer(transport)),
    ),
  );
const changes = (transport: Transport) =>
  Effect.runSync(
    HttpApiClient.make(ChangesApi).pipe(
      Effect.provide(transportLayer(transport)),
    ),
  ).changes;
const linesInput = {
  params: { worktreeId },
  query: { path: 'README.md', from: 1, to: 2, at: 'worktree' as const },
};
const environment = {
  environmentId: 'remote',
  name: 'Computer',
  version: null,
  protocol: 1,
};

describe('native HTTP client boundary', () => {
  it('uses the contract method and decodes its nullable wire value', async () => {
    const sent: { path: string; init: RequestInit | undefined }[] = [];
    const result = await Effect.runPromise(
      mapRequestErrors(
        access((path, init) => {
          sent.push({ path, init });
          return Promise.resolve(Response.json(environment));
        }).publicAccess.readEnvironment({}),
      ),
      { signal: signal() },
    );
    expect(result).toEqual({
      environmentId: 'remote',
      name: 'Computer',
      version: undefined,
      protocol: 1,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe('/api/environment');
    expect(sent[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(sent[0]?.init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
    });
    expect([...new Headers(sent[0]?.init?.headers).keys()]).toEqual([]);
  });

  it('encodes reserved query characters and the OID frontier exactly once', async () => {
    const paths: string[] = [];
    const api = changes((path) => {
      paths.push(path);
      return Promise.resolve(new Response('unavailable', { status: 503 }));
    });
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          api.readChangeLines({
            ...linesInput,
            query: { ...linesInput.query, path: 'a b/#?.txt' },
          }),
        ),
        { signal: signal() },
      ),
    ).rejects.toBeInstanceOf(RequestError);
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          api.listCommits({
            params: { worktreeId },
            query: { after: ['a'.repeat(40), 'b'.repeat(40)] },
          }),
        ),
        { signal: signal() },
      ),
    ).rejects.toBeInstanceOf(RequestError);
    expect(paths).toEqual([
      `/api/worktrees/${worktreeId}/changes/lines?path=a+b%2F%23%3F.txt&from=1&to=2&at=worktree`,
      `/api/worktrees/${worktreeId}/commits?after=${'a'.repeat(40)}%2C${'b'.repeat(40)}`,
    ]);
  });

  it.each([
    {
      code: 'content_changed',
      status: 409,
      error: 'Conflict',
      message: 'Content changed; retry the operation',
      failure: ContentChangedError,
    },
    {
      code: 'worktree_changed',
      status: 409,
      error: 'Conflict',
      message: 'Refresh status and retry inspection',
      failure: WorktreeChangedError,
    },
    {
      code: 'file_too_large',
      status: 422,
      error: 'Unprocessable Entity',
      message: 'File exceeds the read limit',
      failure: FileTooLargeError,
    },
    {
      code: 'unsupported_text',
      status: 422,
      error: 'Unprocessable Entity',
      message: 'File is not supported UTF-8 text',
      failure: UnsupportedTextError,
    },
  ])(
    'decodes the declared $code into its domain failure',
    async ({ code, status, error, message, failure }) => {
      const failed = await Effect.runPromise(
        mapRequestErrors(
          changes(() =>
            Promise.resolve(
              Response.json(
                { statusCode: status, error, message, code },
                { status },
              ),
            ),
          ).readChangeLines(linesInput),
        ),
        { signal: signal() },
      ).catch((error: unknown) => error);
      expect(failed).toBeInstanceOf(failure);
    },
  );

  it.each([
    {
      status: 422,
      message: 'Wrong status',
      code: 'content_changed',
      expectedMessage: 'Wrong status',
    },
    {
      status: 409,
      message: 'Unknown code',
      code: 'other_code',
      expectedMessage: 'Request failed (409)',
    },
  ])('refuses to manufacture a domain failure from $message', async (body) => {
    const error = await Effect.runPromise(
      mapRequestErrors(
        changes(() =>
          Promise.resolve(
            Response.json(
              { ...body, statusCode: body.status, error: 'Refused' },
              { status: body.status },
            ),
          ),
        ).readChangeLines(linesInput),
      ),
      { signal: signal() },
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({
      status: body.status,
      message: body.expectedMessage,
      code: undefined,
    });
  });

  it('does not grant an undeclared code to another endpoint', async () => {
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          access(() =>
            Promise.resolve(
              Response.json(
                {
                  statusCode: 409,
                  error: 'Conflict',
                  message: 'Conflict',
                  code: 'content_changed',
                },
                { status: 409 },
              ),
            ),
          ).publicAccess.readEnvironment({}),
        ),
        { signal: signal() },
      ),
    ).rejects.toMatchObject({ status: 409, code: undefined });
  });

  it('decodes a declared non-success Git-action body', async () => {
    const body = {
      statusCode: 409,
      error: 'Conflict',
      message: 'Expectation mismatch',
    };
    const api = Effect.runSync(
      HttpApiClient.make(GitActionsApi).pipe(
        Effect.provide(
          transportLayer(() =>
            Promise.resolve(Response.json(body, { status: 409 })),
          ),
        ),
      ),
    ).gitActions;
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          api.runGitAction({
            params: { worktreeId },
            payload: {
              requestId: '8d349263-380b-4f05-946c-09f8220e5c93',
              input: {
                action: 'fetch',
                remoteName: 'origin',
                sourceRef: 'refs/heads/main',
              },
              expected: {
                headOid: undefined,
                branch: undefined,
                inProgress: undefined,
                mergeHeadOid: undefined,
              },
            },
          }),
        ),
        { signal: signal() },
      ),
    ).resolves.toEqual(body);
  });

  it('accepts an empty acknowledgement without parsing JSON', async () => {
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          access(() =>
            Promise.resolve(new Response(null, { status: 204 })),
          ).browserAccess.clearBrowserSession({}),
        ),
        { signal: signal() },
      ),
    ).resolves.toBeUndefined();
  });

  it('reports unreadable HTTP failures and retains the original transport cause', async () => {
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          access(() =>
            Promise.resolve(new Response('unavailable', { status: 503 })),
          ).publicAccess.readEnvironment({}),
        ),
        { signal: signal() },
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Request failed (503)',
      code: undefined,
    });
    const failure = new TypeError('Network request failed');
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          access(() => Promise.reject(failure)).publicAccess.readEnvironment(
            {},
          ),
        ),
        { signal: signal() },
      ),
    ).rejects.toMatchObject({ name: 'ConnectionError', cause: failure });
  });

  it('does no IO for a request admitted after connection close', async () => {
    let calls = 0;
    const lifetime = createWorktreeConnection(
      {
        environmentId: 'closed',
        transport: () => Promise.resolve(Response.json(environment)),
        timeoutMs: 1000,
      },
      undefined,
      Layer.empty,
    );
    await lifetime.close();
    const exit = await Effect.runPromiseExit(
      requestEffect(
        access(() => {
          calls += 1;
          return Promise.resolve(Response.json(environment));
        }).publicAccess.readEnvironment({}),
        lifetime.connection.request,
      ),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(calls).toBe(0);
  });

  it('forwards native interruption to the actual fetch', async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    let aborted = false;
    const request = Effect.runPromiseExit(
      mapRequestErrors(
        access(
          (_path, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => {
                  aborted = true;
                  reject(init.signal?.reason);
                },
                { once: true },
              );
              started.resolve();
            }),
        ).publicAccess.readEnvironment({}),
      ),
      { signal: controller.signal },
    );
    await started.promise;
    controller.abort();
    const exit = await request;
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(aborted).toBe(true);
  });

  it('refuses a successful response that violates its contract', async () => {
    await expect(
      Effect.runPromise(
        mapRequestErrors(
          access(() =>
            Promise.resolve(Response.json({ malformed: true })),
          ).publicAccess.readEnvironment({}),
        ),
        { signal: signal() },
      ),
    ).rejects.toThrow();
  });
  it('opens a fresh request lifetime each time a retained generated read runs', async () => {
    let admitted = 0;
    let sent = 0;
    const retained = requestEffect(
      access(() => {
        sent += 1;
        return Promise.resolve(Response.json(environment));
      }).publicAccess.readEnvironment({}),
      (work) =>
        Effect.suspend(() => {
          admitted += 1;
          return work;
        }),
    );
    expect(await Effect.runPromise(retained)).toMatchObject({
      environmentId: 'remote',
    });
    expect(await Effect.runPromise(retained)).toMatchObject({
      environmentId: 'remote',
    });
    expect(admitted).toBe(2);
    expect(sent).toBe(2);
  });
});
