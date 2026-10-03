import { describe, expect, it } from 'vitest';
import {
  readEnvironmentEndpoint,
  clearBrowserSessionEndpoint,
} from '@porcelain/contracts/access';
import {
  editFileEndpoint,
  readTextFileEndpoint,
  type EditFileRequest,
} from '@porcelain/contracts/files';
import {
  listCommitsEndpoint,
  readChangeDiffsEndpoint,
} from '@porcelain/contracts/changes';
import { runGitActionEndpoint } from '@porcelain/contracts/git-actions';
import { requestEndpoint, isEndpointError, RequestError } from './request.ts';

const worktreeId = '0123456789abcdef0123456789abcdef';
const environment = {
  environmentId: 'remote',
  name: 'Computer',
  version: null,
  protocol: 1,
};

describe('requestEndpoint', () => {
  it('uses the contract method, parses the response and forwards cancellation', async () => {
    const controller = new AbortController();
    const received: { path: string; init: RequestInit | undefined }[] = [];
    const value = await requestEndpoint(
      (path, init) => {
        received.push({ path, init });
        return Promise.resolve(Response.json(environment));
      },
      readEnvironmentEndpoint,
      { signal: controller.signal },
    );
    expect(value).toEqual({
      environmentId: 'remote',
      name: 'Computer',
      version: undefined,
      protocol: 1,
    });
    expect(received).toEqual([
      {
        path: '/api/environment',
        init: {
          method: 'GET',
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
        },
      },
    ]);
  });

  it('encodes query codecs and reserved characters once', async () => {
    const paths: string[] = [];
    await expect(
      requestEndpoint(
        (path) => {
          paths.push(path);
          return Promise.resolve(
            Response.json(
              { statusCode: 404, error: 'Not Found', message: 'Missing' },
              { status: 404 },
            ),
          );
        },
        readTextFileEndpoint,
        { params: { worktreeId }, query: { path: 'a b/#?.txt' } },
      ),
    ).rejects.toThrow('Missing');
    await expect(
      requestEndpoint(
        (path) => {
          paths.push(path);
          return Promise.resolve(new Response(null, { status: 503 }));
        },
        listCommitsEndpoint,
        {
          params: { worktreeId },
          query: { after: ['a'.repeat(40), 'b'.repeat(40)] },
        },
      ),
    ).rejects.toThrow('503');
    expect(paths).toEqual([
      '/api/worktrees/0123456789abcdef0123456789abcdef/text?path=a+b%2F%23%3F.txt',
      `/api/worktrees/0123456789abcdef0123456789abcdef/commits?after=${'a'.repeat(40)}%2C${'b'.repeat(40)}`,
    ]);
  });

  it('validates a body before sending and supplies the JSON header', async () => {
    const requests: RequestInit[] = [];
    const body: EditFileRequest = {
      kind: 'write',
      path: 'README.md',
      text: 'Saved',
      expectedFingerprint: 'a'.repeat(64),
    };
    await expect(
      requestEndpoint(
        (_path, init) => {
          if (init) requests.push(init);
          return Promise.resolve(new Response(null, { status: 503 }));
        },
        editFileEndpoint,
        { params: { worktreeId }, body },
      ),
    ).rejects.toThrow('503');
    expect(requests).toEqual([
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'error',
        cache: 'no-store',
      },
    ]);
    await expect(
      requestEndpoint(
        () => {
          throw new Error('Must not send');
        },
        editFileEndpoint,
        {
          params: { worktreeId },
          body: { ...body, expectedFingerprint: 'bad' },
        },
      ),
    ).rejects.toThrow();
  });

  it('preserves declared errors and checks their declared status', async () => {
    const error = await requestEndpoint(
      () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: 'The file changed on disk.',
              code: 'content_changed',
            },
            { status: 409 },
          ),
        ),
      editFileEndpoint,
      {
        params: { worktreeId },
        body: {
          kind: 'write',
          path: 'README.md',
          text: 'Saved',
          expectedFingerprint: 'a'.repeat(64),
        },
      },
    ).catch((error: unknown) => error);
    expect(error).toMatchObject({
      name: 'RequestError',
      status: 409,
      message: 'The file changed on disk.',
      code: 'content_changed',
    });
    expect(isEndpointError(error, editFileEndpoint, 'content_changed')).toBe(
      true,
    );
    expect(
      isEndpointError(
        new RequestError(422, 'Wrong status', 'content_changed'),
        editFileEndpoint,
        'content_changed',
      ),
    ).toBe(false);
    expect(
      isEndpointError(error, readChangeDiffsEndpoint, 'worktree_changed'),
    ).toBe(false);
  });

  it('does not treat an undeclared code as a typed endpoint error', async () => {
    await expect(
      requestEndpoint(
        () =>
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
        readEnvironmentEndpoint,
        {},
      ),
    ).rejects.toMatchObject({ status: 409, code: undefined });
  });

  it('parses a declared non-success receipt rather than throwing for its status', async () => {
    const error = {
      statusCode: 409,
      error: 'Conflict',
      message: 'Expectation mismatch',
    };
    await expect(
      requestEndpoint(
        () => Promise.resolve(Response.json(error, { status: 409 })),
        runGitActionEndpoint,
        {
          params: { worktreeId },
          body: {
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
        },
      ),
    ).resolves.toEqual(error);
  });

  it('accepts an empty success response without trying to parse JSON', async () => {
    await expect(
      requestEndpoint(
        () => Promise.resolve(new Response(null, { status: 204 })),
        clearBrowserSessionEndpoint,
        {},
      ),
    ).resolves.toBeUndefined();
  });

  it('reports an unreadable rejection and retains transport failures', async () => {
    await expect(
      requestEndpoint(
        () => Promise.resolve(new Response('unavailable', { status: 503 })),
        readEnvironmentEndpoint,
        {},
      ),
    ).rejects.toMatchObject({
      name: 'RequestError',
      status: 503,
      message: 'Request failed (503)',
      code: undefined,
    });
    const failure = new TypeError('Network request failed');
    await expect(
      requestEndpoint(
        () => Promise.reject(failure),
        readEnvironmentEndpoint,
        {},
      ),
    ).rejects.toMatchObject({ name: 'ConnectionError', cause: failure });
  });

  it('keeps cancellation distinct from an unreachable server', async () => {
    const controller = new AbortController();
    const cancelled = new Error('Workspace disconnected');
    controller.abort(cancelled);
    await expect(
      requestEndpoint(
        () => Promise.reject(cancelled),
        readEnvironmentEndpoint,
        { signal: controller.signal },
      ),
    ).rejects.toBe(cancelled);
  });

  it('rejects a successful response that violates its schema', async () => {
    await expect(
      requestEndpoint(
        () => Promise.resolve(Response.json({ malformed: true })),
        readEnvironmentEndpoint,
        {},
      ),
    ).rejects.toThrow();
  });
});
