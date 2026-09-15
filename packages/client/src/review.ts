import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  artifactContentSchema,
  artifactListSchema,
} from '@porcelain/contracts/artifacts';
import { commitChangesResponseSchema } from '@porcelain/contracts/commit-changes';
import { commitPageResponseSchema } from '@porcelain/contracts/commit-history';
import { commitReviewLayersResponseSchema } from '@porcelain/contracts/commit-review-layers';
import { evidenceResponseSchema } from '@porcelain/contracts/evidence';
import {
  assetResponseSchema,
  directoryResponseSchema,
  type FileEdit,
  fileEditResultSchema,
  fileTreeSchema,
  textResponseSchema,
} from '@porcelain/contracts/files';
import {
  type GitDiffRequest,
  gitDiffResponseSchema,
} from '@porcelain/contracts/git-diff';
import { gitStatusResponseSchema } from '@porcelain/contracts/git-status';
import { reviewLayersResponseSchema } from '@porcelain/contracts/review-layers';
import {
  reviewedMarksResponseSchema,
  reviewSummarySchema,
  setReviewedRequestSchema,
} from '@porcelain/contracts/reviewed-files';
import { ConnectionError } from './errors/connection-error.ts';
import { RequestError } from './errors/request-error.ts';

type Request = { token: string; signal: AbortSignal; worktreeId: string };
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
          authorization: `Bearer ${request.token}`,
        },
        signal: request.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) {
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
          response.status === 401
            ? 'Access token was rejected. Disconnect and connect again.'
            : 'This review surface could not be loaded. Refresh and try again.',
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
    commitLayers: (request: Request & { projectId: string; oid: string }) =>
      read(
        request,
        `commits/${encodeURIComponent(request.oid)}/review-layers`,
        commitReviewLayersResponseSchema.nullable(),
        undefined,
        'GET',
        `${endpoint}/projects/${encodeURIComponent(request.projectId)}`,
      ),
    fileTree: (request: Request) => read(request, 'file-tree', fileTreeSchema),
    editFile: (request: Request & { input: FileEdit }) =>
      read(request, 'files', fileEditResultSchema, request.input),
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
    diff: (request: Request & { input: GitDiffRequest }) =>
      read(request, 'git/diff', gitDiffResponseSchema, request.input),
    commit: (request: Request & { oid: string; parent?: number }) =>
      read(
        request,
        `commits/${encodeURIComponent(request.oid)}/changes${
          request.parent === undefined
            ? ''
            : `?${new URLSearchParams({ parent: String(request.parent) })}`
        }`,
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
    summary: (request: Request) =>
      read(request, 'review-summary', reviewSummarySchema),
    evidence: (request: Request) =>
      read(request, 'evidence', evidenceResponseSchema),
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
