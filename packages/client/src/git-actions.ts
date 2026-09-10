import {
  gitActionPreparationSchema,
  gitActionReceiptSchema,
} from '@porcelain/contracts/git-actions';
import { ConnectionError } from './errors/connection-error.ts';

type Request = {
  token: string;
  signal: AbortSignal;
  projectId: string;
  worktreeId: string;
};
type Action = ReturnType<typeof gitActionPreparationSchema.parse>['action'];
function actionPath(action: Action) {
  return action.replace('stash-', 'stash/');
}
export function createGitActionsClient(
  transport: typeof fetch,
  endpoint: string,
) {
  async function send<T>(
    request: Request,
    path: string,
    schema: { parse: (value: unknown) => T },
    body?: unknown,
  ) {
    try {
      const response = await transport(endpoint + path, {
        method: body ? 'POST' : 'GET',
        ...(body ? { body: JSON.stringify(body) } : {}),
        headers: {
          authorization: `Bearer ${request.token}`,
          'content-type': 'application/json',
        },
        signal: request.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });
      const value: unknown = await response.json();
      // Execution may return a terminal receipt with a non-2xx HTTP status.
      if (
        response.ok ||
        (typeof value === 'object' && value !== null && 'requestId' in value)
      )
        return schema.parse(value);
      throw new ConnectionError(
        'Git could not complete this request. Check the current state before continuing.',
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
    prepare: (request: Request & { action: Action; input: unknown }) =>
      send(
        request,
        `${prefix(request)}/${actionPath(request.action)}/prepare`,
        gitActionPreparationSchema,
        request.input,
      ),
    execute: (
      request: Request & {
        action: Action;
        preparationId: string;
        requestId: string;
      },
    ) =>
      send(
        request,
        `${prefix(request)}/${actionPath(request.action)}`,
        gitActionReceiptSchema,
        { preparationId: request.preparationId, requestId: request.requestId },
      ),
    receipt: (request: Request & { requestId: string }) =>
      send(
        request,
        `/git-action-requests/${encodeURIComponent(request.requestId)}`,
        gitActionReceiptSchema,
      ),
  };
}
