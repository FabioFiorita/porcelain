import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Switch } from '@/components/ui/switch';
import {
  anchorPlacement,
  type CommentThread,
  GENERAL_ANCHOR,
  threadPath,
} from '../../domain/comments';
import type { DocumentRef } from '../../domain/documents';
import { changePath, type ReviewScope } from '../../domain/review';
import { useComments, useCreateComment } from '../../query/comments';
import { useChanges } from '../../query/review';
import { reportFailure } from '../workspace/notify';
import { InlineComposer } from './inline-composer';
import type { OpenDocument } from './review-workspace';
import { ThreadCard } from './thread-card';

// Oldest activity first, so a fresh reply lands at the end and the scroller follows it.
const lastActivity = (thread: CommentThread) =>
  thread.messages.at(-1)?.createdAt ?? '';
const byActivity = (left: CommentThread, right: CommentThread) =>
  lastActivity(left).localeCompare(lastActivity(right));

/**
 * Every thread of the worktree, one card each: on lines, on a whole file, or on
 * the whole worktree (a general thread, started with New comment). Resolved
 * threads hide behind Show resolved. Nothing here is sent to the agent: it reads
 * threads when the reviewer tells it to, in its own session.
 */
export function CommentsList({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: OpenDocument;
}) {
  const threads = useComments(scope);
  const { changes } = useChanges(scope);
  const [showResolved, setShowResolved] = useState(false);
  const [composing, setComposing] = useState(false);
  const create = useCreateComment(scope);
  const changed = new Set(changes.map(changePath));

  /** Where a thread's code is now: its commit, its diff while the file is changed, else the file. */
  const revealer = (thread: CommentThread) => {
    const path = threadPath(thread);
    if (path == null || thread.anchor.kind === 'worktree') return undefined;
    const revision = thread.anchor.revision;
    const ref: DocumentRef =
      revision != null
        ? { kind: 'commit', oid: revision }
        : changed.has(path)
          ? { kind: 'change', path }
          : { kind: 'file', path };
    const place = anchorPlacement(thread);
    // On a merge commit, the comment's lines are in the diff against its parent.
    const parent = thread.anchor.parent;
    return () =>
      onOpen(ref, {
        path,
        lineNumber: place?.lineNumber ?? 0,
        side: place?.side,
        parent,
      });
  };

  const open = threads.filter((thread) => !thread.resolved).sort(byActivity);
  const resolved = threads.filter((thread) => thread.resolved).sort(byActivity);
  // Resolved threads sit above the open ones: done, and out of the way of new activity.
  const visible = showResolved ? [...resolved, ...open] : open;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-1.5 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums">{open.length} open</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          Show resolved
          {resolved.length > 0 && (
            <span className="tabular-nums">({resolved.length})</span>
          )}
          <Switch
            size="sm"
            checked={showResolved}
            onCheckedChange={setShowResolved}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="flex-1 px-4 py-6 text-center text-[12px] text-muted-foreground">
          No open comments. Press ＋ beside a line, drag it across a block, or
          start a general comment below.
        </p>
      ) : (
        <MessageScrollerProvider
          key={String(showResolved)}
          autoScroll
          defaultScrollPosition="end"
        >
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Comments">
              <MessageScrollerContent className="gap-2.5 p-2">
                {visible.map((thread, index) => (
                  <MessageScrollerItem
                    key={thread.id}
                    messageId={thread.id}
                    scrollAnchor={index === visible.length - 1}
                  >
                    <ThreadCard
                      thread={thread}
                      scope={scope}
                      onReveal={revealer(thread)}
                      listed
                    />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="shrink-0 border-t p-2">
        {composing ? (
          <InlineComposer
            label="General comment · the whole worktree"
            placeholder="Something about the whole change…"
            pending={create.isPending}
            onCancel={() => setComposing(false)}
            onSubmit={(body) =>
              reportFailure(
                create
                  .submit({ anchor: GENERAL_ANCHOR, body })
                  .then(() => setComposing(false)),
                'The comment was not posted',
              )
            }
          />
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setComposing(true)}
          >
            <MessageSquarePlus className="size-3.5" />
            New comment
          </Button>
        )}
      </div>
    </div>
  );
}
