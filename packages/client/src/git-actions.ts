import {
  type commitDraftRequestSchema,
  commitDraftResponseSchema,
  commitModelsSchema,
} from '@porcelain/contracts/commit-draft';
import {
  branchesResponseSchema,
  gitActionReceiptSchema,
  type RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
import { ConnectionError } from './errors/connection-error.ts';

type Request = {
  signal: AbortSignal;
  projectId: string;
  worktreeId: string;
};
export function createGitActionsClient(
  transport: typeof fetch,
  endpoint: string,
) {
  async function send<T>(
    request: Pick<Request, 'signal'>,
    path: string,
    schema: { parse: (value: unknown) => T },
    body?: unknown,
  ) {
    try {
      const response = await transport(endpoint + path, {
        method: body ? 'POST' : 'GET',
        ...(body ? { body: JSON.stringify(body) } : {}),
        headers: { 'content-type': 'application/json' },
        signal: request.signal,
        redirect: 'error',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const value: unknown = await response.json();
      if (
        response.ok ||
        (typeof value === 'object' && value !== null && 'requestId' in value)
      )
        return schema.parse(value);
      throw new ConnectionError(
        typeof value === 'object' &&
          value !== null &&
          'message' in value &&
          typeof value.message === 'string'
          ? value.message
          : 'Git could not complete this request. Check the current state before continuing.',
      );
    } catch (error) {
      if (request.signal.aborted || error instanceof ConnectionError)
        throw error;
      throw new ConnectionError(
        'The Git response was lost or incompatible. Check the receipt before taking another action.',
        { cause: error },
      );
    }
  }
  const prefix = (request: Request) =>
    `/projects/${encodeURIComponent(request.projectId)}/worktrees/${encodeURIComponent(request.worktreeId)}/git`;
  return {
    run: (request: Request & { input: RunGitActionRequest }) =>
      send(
        request,
        `${prefix(request)}/actions`,
        gitActionReceiptSchema,
        request.input,
      ),
    branches: (request: Request) =>
      send(request, `${prefix(request)}/branches`, branchesResponseSchema),
    models: (request: Pick<Request, 'signal'>) =>
      send(request, '/git/commit-models', commitModelsSchema),
    draft: (
      request: Request & {
        input: ReturnType<typeof commitDraftRequestSchema.parse>;
      },
    ) =>
      send(
        request,
        `${prefix(request)}/commit-draft`,
        commitDraftResponseSchema,
        request.input,
      ),
    receipt: (request: Request & { requestId: string }) =>
      send(
        request,
        `/git-action-requests/${encodeURIComponent(request.requestId)}`,
        gitActionReceiptSchema,
      ),
    dismissInterrupted: async (
      request: Request & { requestId: string },
    ): Promise<void> => {
      const response = await transport(
        endpoint +
          `${prefix(request)}/interrupted/${encodeURIComponent(request.requestId)}`,
        {
          method: 'DELETE',
          signal: request.signal,
          redirect: 'error',
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      if (!response.ok)
        throw new ConnectionError(
          'The interrupted action could not be dismissed.',
        );
    },
  };
}
