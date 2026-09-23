import type { CommentThread } from './comment-thread.ts';

export function commentStorageSize(thread: CommentThread): number {
  return new TextEncoder().encode(
    JSON.stringify({ ...thread, resolved: false }),
  ).byteLength;
}
