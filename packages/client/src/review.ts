import { artifactListSchema } from '@porcelain/contracts/artifacts';
import { commitChangesResponseSchema } from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import {
  directoryResponseSchema,
  textResponseSchema,
} from '@porcelain/contracts/files';
import {
  type GitDiffRequest,
  gitDiffResponseSchema,
} from '@porcelain/contracts/git-diff';
import { gitStatusResponseSchema } from '@porcelain/contracts/git-status';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import { ConnectionError } from './errors/connection-error.ts';

type Request = { token: string; signal: AbortSignal; worktreeId: string };
export function createReviewClient(transport: typeof fetch, endpoint: string) {
  async function read<T>(
    request: Request,
    path: string,
    schema: { parse: (value: unknown) => T },
    body?: unknown,
  ): Promise<T> {
    try {
      const response = await transport(
        `${endpoint}/worktrees/${encodeURIComponent(request.worktreeId)}/${path}`,
        {
          ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${request.token}`,
          },
          signal: request.signal,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
        },
      );
      if (!response.ok)
        throw new ConnectionError(
          response.status === 401
            ? 'Access token was rejected. Disconnect and connect again.'
            : 'This review surface could not be loaded. Refresh and try again.',
        );
      return schema.parse(await response.json());
    } catch (error) {
      if (request.signal.aborted || error instanceof ConnectionError)
        throw error;
      throw new ConnectionError(
        'Could not load review data from the environment.',
        { cause: error },
      );
    }
  }
  return {
    text: (request: Request & { path: string }) =>
      read(
        request,
        `text?${new URLSearchParams({ path: request.path })}`,
        textResponseSchema,
      ),
    diff: (request: Request & { input: GitDiffRequest }) =>
      read(request, 'git/diff', gitDiffResponseSchema, request.input),
    commit: (request: Request & { oid: string }) =>
      read(
        request,
        `commits/${encodeURIComponent(request.oid)}/changes`,
        commitChangesResponseSchema,
      ),
    directory: (request: Request & { path: string }) =>
      read(
        request,
        `directory?${new URLSearchParams({ path: request.path })}`,
        directoryResponseSchema,
      ),
    changes: async (request: Request) => {
      const [status, layers] = await Promise.all([
        read(request, 'git/status', gitStatusResponseSchema),
        read(request, 'review-layers', reviewLayersResponseSchema),
      ]);
      return { status, layers };
    },
    history: (request: Request & { cursor?: string }) =>
      read(
        request,
        `commits?${new URLSearchParams(request.cursor ? { cursor: request.cursor } : { limit: '50' })}`,
        commitPageResponseSchema,
      ),
    artifacts: (request: Request) =>
      read(request, 'artifacts', artifactListSchema),
  };
}
