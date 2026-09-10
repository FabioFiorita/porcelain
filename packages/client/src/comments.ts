import {
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
import { ConnectionError } from './errors/connection-error.ts';

type Request = { token: string; signal: AbortSignal; worktreeId: string };
export function createCommentsClient(
  transport: typeof fetch,
  endpoint: string,
) {
  async function request(input: Request, body?: unknown) {
    try {
      const response = await transport(
        `${endpoint}/worktrees/${encodeURIComponent(input.worktreeId)}/comments`,
        {
          method: body === undefined ? 'GET' : 'POST',
          ...(body === undefined
            ? {}
            : { body: JSON.stringify(createCommentThreadSchema.parse(body)) }),
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${input.token}`,
          },
          signal: input.signal,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
        },
      );
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
    ) => request(input, input.input),
  };
}
