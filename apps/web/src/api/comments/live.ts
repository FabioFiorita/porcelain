import { createCommentsClient } from '@porcelain/client/comments';
import type { CommentsPort } from './port';
export function createCommentsLive(transport: typeof fetch): CommentsPort {
  return createCommentsClient(transport, '/api');
}
