import {
  ClipboardIcon,
  Trash2Icon,
  GitBranchIcon,
  RefreshCwIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import {
  useWorkspaceWriteBlock,
  type ConnectionContext,
} from '@/shared/workspace/connection';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { copyText } from '@/shared/workspace/copy';
import { deleteWorktreeDialog, switchWorktreeBranchDialog } from '../overlays';

export function NavigatorRowMenu({
  entry,
  context,
  children,
  onRetryChanges,
}: {
  entry: NavigatorEntry;
  context: ConnectionContext;
  children: ReactNode;
  onRetryChanges: () => void;
}) {
  const writeBlock = useWorkspaceWriteBlock(context);
  const worktreeId = entry.worktreeId;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="min-w-0 flex-1 py-0.5" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          {entry.available &&
            entry.kind === 'worktree' &&
            entry.changes.state === 'unavailable' && (
              <ContextMenuItem onSelect={onRetryChanges}>
                <RefreshCwIcon />
                Retry changes
              </ContextMenuItem>
            )}
          {entry.path && (
            <ContextMenuItem
              className="cursor-pointer"
              onSelect={() =>
                entry.path && copyText(entry.path, 'worktree path')
              }
            >
              <ClipboardIcon />
              Copy worktree path
            </ContextMenuItem>
          )}
          {entry.kind === 'worktree' && worktreeId && (
            <ContextMenuItem
              className="cursor-pointer"
              disabled={!entry.available || Boolean(writeBlock)}
              aria-description={writeBlock}
              onSelect={() =>
                switchWorktreeBranchDialog.openWithPayload({
                  entry,
                  context,
                  worktreeId,
                  requestId: crypto.randomUUID(),
                })
              }
            >
              <GitBranchIcon />
              Switch branch
            </ContextMenuItem>
          )}
          {!entry.main && entry.kind === 'worktree' && worktreeId && (
            <ContextMenuItem
              destructive
              className="cursor-pointer"
              disabled={!entry.available || Boolean(writeBlock)}
              aria-description={writeBlock}
              onSelect={() =>
                deleteWorktreeDialog.openWithPayload({
                  entry,
                  context,
                  worktreeId,
                  requestId: crypto.randomUUID(),
                })
              }
            >
              <Trash2Icon />
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
