import { useState } from 'react';
import type {
  ReviewRevision,
  ReviewScope,
} from '@porcelain/client/reviews/rules';
import { anchorPath } from '@porcelain/client/reviews/rules';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { Button } from '@/components/ui/button';
import { useComments } from '../queries/comments';
import { InlineComposer } from './inline-composer';
import { ThreadCard } from './thread-card';

export function ReviewComments({
  scope,
  context,
  revision,
  onReveal,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  revision: ReviewRevision;
  onReveal: (path: string) => void;
}) {
  const { threads } = useComments(scope, context);
  const [composing, setComposing] = useState(false);
  return (
    <section aria-label="Review comments" className="flex flex-col gap-2 p-3">
      <Button
        variant="outline"
        className="self-start"
        onClick={() => setComposing(true)}
      >
        Comment on this review
      </Button>
      {composing && (
        <InlineComposer
          scope={scope}
          context={context}
          anchor={{
            kind: 'change',
            revision: revision.headOid,
            comparison: { kind: 'branch', base: revision.base },
          }}
          onClose={() => setComposing(false)}
        />
      )}
      {threads.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">No comments yet.</p>
      )}
      {threads.map((thread) => (
        <div key={thread.id} className="min-w-0 rounded-lg border">
          <p className="px-3 pt-2 text-xs text-muted-foreground">
            Written on r{thread.review?.revision} ·{' '}
            {thread.review?.headOid.slice(0, 7)}
          </p>
          <ThreadCard
            scope={scope}
            context={context}
            thread={thread}
            onReveal={() => {
              const path = anchorPath(thread.anchor);
              if (path) onReveal(path);
            }}
          />
        </div>
      ))}
    </section>
  );
}
