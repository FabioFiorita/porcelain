import { formatDistanceToNowStrict } from 'date-fns';
import { CopyIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { copyText } from '@/shared/workspace/copy';
import { commitMessage, type CommitSummary } from '../rules/commit';
import { historyRefLabel, shortOid } from '../rules/graph';

export function CommitRow({
  commit,
  selected,
  height,
  onSelect,
  children,
}: {
  commit: CommitSummary;
  selected: boolean;
  height?: number | undefined;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            style={height === undefined ? undefined : { height }}
            aria-pressed={selected}
            title={commit.subject}
            onClick={onSelect}
            className={cn(
              'flex w-full flex-col justify-center gap-0.5 rounded-lg px-2 text-left transition-colors hover:bg-accent',
              height === undefined && 'py-1.5',
              selected && 'bg-accent',
            )}
          />
        }
      >
        <span className="truncate text-[12.5px] leading-tight">
          {commit.subject}
        </span>
        <span className="flex gap-1.5 text-[10.5px] text-muted-foreground">
          <code className="font-mono">{shortOid(commit.oid)}</code>
          <span className="truncate">{commit.author.name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">
            {formatDistanceToNowStrict(new Date(commit.author.timestamp), {
              addSuffix: true,
            })}
          </span>
        </span>
        {children}
        {commit.refs.length > 0 && (
          <span className="flex gap-1 overflow-hidden">
            {commit.refs.map((ref) => (
              <Badge
                key={ref}
                title={ref}
                variant="secondary"
                className="h-4 shrink-0"
              >
                {historyRefLabel(ref)}
              </Badge>
            ))}
          </span>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => copyText(commit.oid, 'commit id')}>
          <CopyIcon />
          Copy commit id
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => copyText(commitMessage(commit), 'commit message')}
        >
          <CopyIcon />
          Copy message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
