import { TriangleAlertIcon } from 'lucide-react';
import { MarkdownView } from '@/features/files/index';
import { cn } from '@/shared/lib/utils';
import { LONG_AGENT_NOTE } from '@/config/limits';

export function AgentNote({
  title,
  text,
  stale = false,
  marker,
  tone = 'agent',
}: {
  title?: string;
  text: string;
  stale?: boolean;
  marker?: string;
  tone?: 'agent' | 'gap';
}) {
  const gap = tone === 'gap';
  const body = <MarkdownView text={text} className="text-sm" />;
  return (
    <aside
      aria-label={`${gap ? 'Not explained' : 'Agent note'}${title ? ` · ${title}` : ''}`}
      className={cn(
        'm-3 flex max-w-3xl gap-2.5 rounded-lg border bg-background px-3 py-2.5 font-sans shadow-xs',
        gap && 'border-graph-4/40 bg-graph-4/5',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-px grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-graph-1/12 px-1 text-2xs font-semibold text-graph-1 tabular-nums',
          gap && 'bg-graph-4/15 text-graph-4',
        )}
      >
        {gap ? <TriangleAlertIcon className="size-3" /> : (marker ?? '•')}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-caption font-medium">{title}</p>}
        {stale && (
          <p role="status" className="text-caption text-graph-4">
            Code changed since the review was written.
          </p>
        )}
        {text.length > LONG_AGENT_NOTE ? (
          <details className="text-muted-foreground">
            <summary className="cursor-pointer text-caption">
              Read the note
            </summary>
            {body}
          </details>
        ) : (
          <div className="text-muted-foreground">{body}</div>
        )}
      </div>
    </aside>
  );
}
