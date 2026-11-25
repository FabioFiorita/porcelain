import { type Context, Effect } from 'effect';
import type { ReadWorktreeStatusService } from '@porcelain/changes/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type {
  ListCommentedPathsService,
  ListDraftCommentsService,
} from '@porcelain/reviews/services';
import { draftCommentsMarkdown } from '@porcelain/reviews/rules';

export const COMMENTS_COMMAND = 'porcelain comments';

export const readCommentsView = Effect.fn('Comments.readView')(function* (
  capabilities: {
    readonly status: Context.Service.Shape<typeof ReadWorktreeStatusService>;
    readonly texts: Context.Service.Shape<typeof ReadTextFileService>;
    readonly paths: Context.Service.Shape<typeof ListCommentedPathsService>;
    readonly list: Context.Service.Shape<typeof ListDraftCommentsService>;
  },
  worktreeId: string,
) {
  const status = yield* capabilities.status.execute({ worktreeId });
  const branch = status.branch?.name ?? '';
  const headOid = status.headOid ?? '';
  const texts = new Map<string, string | undefined>();
  for (const path of yield* capabilities.paths.execute({
    worktreeId,
    branch,
  })) {
    const read = yield* capabilities.texts
      .execute({ worktreeId, path, at: 'worktree' })
      .pipe(Effect.option);
    texts.set(path, read._tag === 'Some' ? read.value.text : undefined);
  }
  const comments = yield* capabilities.list.execute({
    worktreeId,
    branch,
    texts,
  });
  return {
    branch,
    headOid,
    comments,
    markdown: draftCommentsMarkdown({
      branch: branch || 'detached HEAD',
      headOid,
      comments,
      command: COMMENTS_COMMAND,
    }),
  };
});
