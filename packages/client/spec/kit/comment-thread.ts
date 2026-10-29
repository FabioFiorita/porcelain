import type { CommentThread } from '../../src/features/reviews/rules/comments.ts';

export function commentThread(
  authors: CommentThread['messages'][number]['author'][],
  resolved = false,
): CommentThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    worktreeId: 'a'.repeat(32),
    anchor: { kind: 'file', filePath: 'a.ts' },
    resolved,
    revision: 1,
    messages: authors.map((author, index) => ({
      id: `00000000-0000-4000-8000-00000000001${index}`,
      body: 'Comment',
      author,
    })),
  };
}
