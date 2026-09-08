import type { CommentThread } from './comment-thread.ts';
// Reserve the longer boolean encoding so reopening remains possible at capacity.
export function commentStorageSize(thread: CommentThread): number {
  return new TextEncoder().encode(
    JSON.stringify({ ...thread, resolved: false }),
  ).byteLength;
}
