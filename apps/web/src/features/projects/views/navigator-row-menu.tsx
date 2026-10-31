import { ClipboardIcon, Trash2Icon, GitBranchIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
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
  connection,
  children,
}: {
  entry: NavigatorEntry;
  connection: Connection;
  children: ReactNode;
}) {
  const worktreeId = entry.worktreeId;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="min-w-0 flex-1 py-0.5" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          {entry.path && (
            <ContextMenuItem
              className="cursor-pointer"
              onClick={() =>
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
              disabled={!entry.available}
              onClick={() =>
                switchWorktreeBranchDialog.openWithPayload({
                  entry,
                  connection,
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
              variant="destructive"
              className="cursor-pointer"
              disabled={!entry.available}
              onClick={() =>
                deleteWorktreeDialog.openWithPayload({
                  entry,
                  connection,
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
