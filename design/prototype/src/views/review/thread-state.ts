import { type RefObject, useCallback, useEffect, useRef } from 'react';
import {
  type CommentThread,
  threadStarter,
  threadState,
  unseenAgentMessages,
} from '../../domain/comments';
import type { ReviewScope } from '../../domain/review';
import { useMarkSeen } from '../../query/comments';

/** How long a card has to stay on screen before it counts as read. */
const READ_AFTER_MS = 1000;

/** The badge text: whose turn it is, and whether the agent opened the thread. */
export function threadStateLabel(thread: CommentThread): string {
  switch (threadState(thread)) {
    case 'resolved':
      return 'Resolved';
    case 'awaiting-agent':
      return 'Waiting for the agent';
    case 'agent-replied':
      return threadStarter(thread) === 'agent' && thread.messages.length === 1
        ? 'From the agent'
        : 'Agent replied';
  }
}

/**
 * Marks the thread seen up to its last message once the card has been on screen
 * for about a second, or at once through the returned function (revealing it,
 * replying). The server shares the marker with every device, so the worktree's
 * yellow dot clears everywhere. Only threads with unseen agent messages ask.
 */
export function useSeenWhenRead(
  scope: ReviewScope,
  thread: CommentThread,
  card: RefObject<HTMLElement | null>,
) {
  const markSeen = useMarkSeen(scope);
  const unseen = unseenAgentMessages(thread) > 0;
  const lastId = thread.messages.at(-1)?.id;
  const sent = useRef<string | null>(null);
  const { submit } = markSeen;

  const mark = useCallback(() => {
    if (!unseen || lastId == null || sent.current === lastId) return;
    sent.current = lastId;
    // A background write: if it fails the dot stays and the next read tries again.
    submit({ threadId: thread.id, messageId: lastId }).catch(() => {
      sent.current = null;
    });
  }, [unseen, lastId, submit, thread.id]);

  useEffect(() => {
    const element = card.current;
    if (!unseen || element == null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting && document.visibilityState === 'visible')
          timer = setTimeout(mark, READ_AFTER_MS);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [unseen, mark, card]);

  return { unseen, mark };
}
