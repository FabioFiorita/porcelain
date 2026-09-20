import {
  commentThreadsSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import { ConnectionError } from './errors/connection-error.ts';
import { UnauthorizedError } from './errors/unauthorized-error.ts';

type Request = { signal: AbortSignal; worktreeId: string };
export function createCommentsClient(
  transport: typeof fetch,
  endpoint: string,
) {
  const commentsPath = (input: Request) =>
    `${endpoint}/worktrees/${encodeURIComponent(input.worktreeId)}/comments`;
  async function request(
    input: Request,
    path = commentsPath(input),
    body?: unknown,
    bodySchema: {
      parse: (value: unknown) => unknown;
    } = createCommentThreadSchema,
    method = body === undefined ? 'GET' : 'POST',
  ) {
    try {
      const response = await transport(path, {
        method,
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(bodySchema.parse(body)) }),
        headers: { 'content-type': 'application/json' },
        signal: input.signal,
        redirect: 'error',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401) throw new UnauthorizedError();
      if (!response.ok)
        throw new ConnectionError(
          'Comments could not be saved or loaded. Refresh the discussion before trying again.',
        );
      const threads = commentThreadsSchema.parse(await response.json());
      if (threads.some((thread) => thread.worktreeId !== input.worktreeId))
        throw new ConnectionError(
          'The comment context changed. Refresh the discussion.',
        );
      return threads;
    } catch (error) {
      if (error instanceof ConnectionError) throw error;
      throw new ConnectionError(
        'Could not reach the discussion. Refresh before trying again; your comment may have been saved.',
        { cause: error },
      );
    }
  }
  return {
    list: (input: Request) => request(input),
    create: (
      input: Request & {
        input: Parameters<typeof createCommentThreadSchema.parse>[0];
      },
    ) => request(input, commentsPath(input), input.input),
    reply: (
      input: Request & {
        threadId: string;
        input: Parameters<typeof replyToCommentSchema.parse>[0];
      },
    ) =>
      request(
        input,
        `${commentsPath(input)}/${encodeURIComponent(input.threadId)}/replies`,
        input.input,
        replyToCommentSchema,
      ),
    resolve: (
      input: Request & {
        threadId: string;
        input: Parameters<typeof resolveCommentSchema.parse>[0];
      },
    ) =>
      request(
        input,
        `${commentsPath(input)}/${encodeURIComponent(input.threadId)}/resolution`,
        input.input,
        resolveCommentSchema,
        'PUT',
      ),
  };
}
