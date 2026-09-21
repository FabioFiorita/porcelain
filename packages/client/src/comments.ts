import {
  commentThreadsSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
  seenCommentsRequestSchema,
  seenCommentsResponseSchema,
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
      const init: RequestInit = {
        method,
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(bodySchema.parse(body)) }),
        headers: { 'content-type': 'application/json' },
        signal: input.signal,
        redirect: 'error',
        credentials: 'same-origin',
        cache: 'no-store',
      };
      let response: Response;
      try {
        response = await transport(path, init);
      } catch (first) {
        if (body === undefined || input.signal.aborted) throw first;
        response = await transport(path, init);
      }
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
        input: ReturnType<typeof createCommentThreadSchema.parse>;
      },
    ) => {
      const submitted = createCommentThreadSchema.parse({
        ...input.input,
        threadId: input.input.threadId ?? crypto.randomUUID(),
        messageId: input.input.messageId ?? crypto.randomUUID(),
      });
      return request(input, commentsPath(input), submitted);
    },
    reply: (
      input: Request & {
        threadId: string;
        input: ReturnType<typeof replyToCommentSchema.parse>;
      },
    ) => {
      const submitted = replyToCommentSchema.parse({
        ...input.input,
        messageId: input.input.messageId ?? crypto.randomUUID(),
      });
      return request(
        input,
        `${commentsPath(input)}/${encodeURIComponent(input.threadId)}/replies`,
        submitted,
        replyToCommentSchema,
      );
    },
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
    seen: async (input: Request & { throughRevision: number }) => {
      try {
        const response = await transport(`${commentsPath(input)}/seen`, {
          method: 'POST',
          body: JSON.stringify(
            seenCommentsRequestSchema.parse({
              throughRevision: input.throughRevision,
            }),
          ),
          headers: { 'content-type': 'application/json' },
          signal: input.signal,
          redirect: 'error',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.status === 401) throw new UnauthorizedError();
        if (!response.ok)
          throw new ConnectionError('The discussion could not be marked read.');
        return seenCommentsResponseSchema.parse(await response.json());
      } catch (error) {
        if (error instanceof ConnectionError) throw error;
        throw new ConnectionError('Could not reach the discussion.', {
          cause: error,
        });
      }
    },
  };
}
