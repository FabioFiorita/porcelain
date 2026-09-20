import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  artifactContentSchema,
  artifactListSchema,
} from '@porcelain/contracts/artifacts';
import {
  type ChangeDiffsRequest,
  changeDiffsResponseSchema,
  changeLinesResponseSchema,
  changesResponseSchema,
} from '@porcelain/contracts/changes';
import {
  commitDiffsResponseSchema,
  commitFilesResponseSchema,
} from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import {
  assetResponseSchema,
  directoryResponseSchema,
  type FileEdit,
  fileEditResultSchema,
  previewAssetsResponseSchema,
  textResponseSchema,
  worktreePathsSchema,
} from '@porcelain/contracts/files';
import { gitStatusResponseSchema } from '@porcelain/contracts/git-status';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import {
  reviewedMarksResponseSchema,
  setReviewedRequestSchema,
} from '@porcelain/contracts/reviewed-files';
import { ConnectionError } from './errors/connection-error.ts';
import { RequestError } from './errors/request-error.ts';
import { UnauthorizedError } from './errors/unauthorized-error.ts';

type Request = { signal: AbortSignal; worktreeId: string };
export function createReviewClient(transport: typeof fetch, endpoint: string) {
  async function read<T>(
    request: Request,
    path: string,
    schema: { parse: (value: unknown) => T },
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
    prefix = `${endpoint}/worktrees/${encodeURIComponent(request.worktreeId)}`,
  ): Promise<T> {
    try {
      const response = await transport(`${prefix}/${path}`, {
        ...(body === undefined && method === 'GET'
          ? {}
          : {
              method,
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
        headers: {
          'content-type': 'application/json',
        },
        signal: request.signal,
        redirect: 'error',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        if (response.status === 401) throw new UnauthorizedError();
        const failure = apiErrorSchema.safeParse(
          await response.json().catch(() => null),
        );
        if (failure.success)
          throw new RequestError(
            response.status,
            failure.data.code,
            failure.data.message,
          );
        throw new ConnectionError(
          'This review surface could not be loaded. Refresh and try again.',
        );
      }
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
    worktreePaths: (request: Request) =>
      read(request, 'paths', worktreePathsSchema),
    editFile: (request: Request & { input: FileEdit }) =>
      read(request, 'files', fileEditResultSchema, request.input),
    previewAssets: (request: Request & { document: string; paths: string[] }) =>
      read(request, 'preview-assets', previewAssetsResponseSchema, {
        document: request.document,
        paths: request.paths,
      }),
    asset: (request: Request & { path: string }) =>
      read(
        request,
        `asset?path=${encodeURIComponent(request.path)}`,
        assetResponseSchema,
      ),
    text: (request: Request & { path: string }) =>
      read(
        request,
        `text?${new URLSearchParams({ path: request.path })}`,
        textResponseSchema,
      ),
    // Only the action UI reads this: it is the change list plus the remote
    // name, source ref and stashes, which cost two more Git processes.
    status: (request: Request) =>
      read(request, 'git/status', gitStatusResponseSchema),
    diffs: (request: Request & { input: ChangeDiffsRequest }) =>
      read(request, 'changes/diffs', changeDiffsResponseSchema, request.input),
    lines: (
      request: Request & {
        path: string;
        from: number;
        to: number;
        at: 'head' | 'worktree';
      },
    ) =>
      read(
        request,
        `changes/lines?${new URLSearchParams({
          path: request.path,
          from: String(request.from),
          to: String(request.to),
          at: request.at,
        })}`,
        changeLinesResponseSchema,
      ),
    commit: (request: Request & { oid: string; parent?: number }) =>
      read(
        request,
        `commits/${encodeURIComponent(request.oid)}/files${
          request.parent === undefined
            ? ''
            : `?${new URLSearchParams({ parent: String(request.parent) })}`
        }`,
        commitFilesResponseSchema,
      ),
    commitDiffs: (
      request: Request & {
        oid: string;
        parent?: number;
        paths: string[][];
      },
    ) =>
      read(
        request,
        `commits/${encodeURIComponent(request.oid)}/diffs`,
        commitDiffsResponseSchema,
        {
          paths: request.paths,
          ...(request.parent === undefined ? {} : { parent: request.parent }),
        },
      ),
    directory: (request: Request & { path: string }) =>
      read(
        request,
        `directory?${new URLSearchParams({ path: request.path })}`,
        directoryResponseSchema,
      ),
    changes: async (request: Request) => {
      const [changes, layers] = await Promise.all([
        read(request, 'changes', changesResponseSchema),
        read(request, 'review-layers', reviewLayersResponseSchema),
      ]);
      return { changes, layers };
    },
    history: (request: Request & { after?: string[]; tip?: string }) =>
      read(
        request,
        `commits?${new URLSearchParams(
          request.after?.length && request.tip
            ? { limit: '50', after: request.after.join(','), tip: request.tip }
            : { limit: '50' },
        )}`,
        commitPageResponseSchema,
      ),
    artifacts: (request: Request) =>
      read(request, 'artifacts', artifactListSchema),
    reviewed: {
      list: (request: Request) =>
        read(request, 'reviewed', reviewedMarksResponseSchema),
      set: (
        request: Request & {
          input: Parameters<typeof setReviewedRequestSchema.parse>[0];
        },
      ) =>
        read(
          request,
          'reviewed',
          reviewedMarksResponseSchema,
          setReviewedRequestSchema.parse(request.input),
          'PUT',
        ),
      remove: (request: Request & { path: string }) =>
        read(
          request,
          `reviewed?${new URLSearchParams({ path: request.path })}`,
          reviewedMarksResponseSchema,
          undefined,
          'DELETE',
        ),
    },
    artifact: (request: Request & { artifactId: string }) =>
      read(
        request,
        `artifacts/${encodeURIComponent(request.artifactId)}`,
        artifactContentSchema,
      ),
  };
}
