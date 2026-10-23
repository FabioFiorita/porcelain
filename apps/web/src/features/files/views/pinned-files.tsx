import type { GitStatus, GitStatusEntry } from '@pierre/trees';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDownIcon, ChevronRightIcon, PinOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type { TreeAction } from '@porcelain/client/files/rules';
import { FileTreeMenuList } from './file-tree-menu';
import { FileTypeIcon } from './file-type-icon';

const STATUS_MARKS: Partial<Record<GitStatus, string>> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
  untracked: 'U',
};

export function PinnedFiles({
  paths,
  statuses,
  selected,
  onOpen,
  onUnpin,
  menuFor,
}: {
  paths: readonly string[];
  statuses: readonly GitStatusEntry[];
  selected: string;
  onOpen: (path: string, toSide?: boolean) => void;
  onUnpin: (path: string) => void;
  menuFor: (path: string) => {
    actions: readonly { id: TreeAction; label: string }[];
    hidden: boolean;
    onAction: (id: TreeAction) => void;
  };
}) {
  const [openingSide, setOpeningSide] = useState(false);
  const [expanded, setExpanded] = useState(true);
  if (paths.length === 0) return null;
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  const marks = new Map(
    statuses.flatMap((entry) => {
      const mark = STATUS_MARKS[entry.status];
      return mark === undefined ? [] : [[entry.path, mark] as const];
    }),
  );
  return (
    <section aria-label="Pinned files" className="shrink-0 px-2 pt-1.5 pb-1">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-2xs font-medium text-muted-foreground hover:bg-accent"
            />
          }
        >
          <Chevron className="size-3 shrink-0" />
          <span className="flex-1 text-left">Pinned</span>
          <span className="tabular-nums">{paths.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul>
            {paths.map((path) => {
              const separator = path.lastIndexOf('/') + 1;
              const menu = menuFor(path);
              return (
                <ContextMenu
                  key={path}
                  onOpenChange={(open) => {
                    if (open) setOpeningSide(false);
                  }}
                >
                  <ContextMenuTrigger
                    render={<li className="flex items-center gap-0.5" />}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-current={
                              path === selected ? 'page' : undefined
                            }
                            className={cn(
                              'flex h-7.5 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-caption hover:bg-accent',
                              path === selected && 'bg-accent',
                            )}
                            onClick={(event) => onOpen(path, event.altKey)}
                          />
                        }
                      >
                        <FileTypeIcon
                          path={path}
                          className="size-3.5 shrink-0"
                        />
                        <span className="min-w-0 truncate">
                          {path.slice(separator)}
                        </span>
                        {separator > 0 && (
                          <span className="min-w-0 shrink-[100] truncate text-muted-foreground">
                            {path.slice(0, separator - 1)}
                          </span>
                        )}
                        {marks.has(path) && (
                          <span
                            aria-hidden="true"
                            className="ml-auto shrink-0 pl-1 font-mono text-2xs text-muted-foreground"
                          >
                            {marks.get(path)}
                          </span>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>{path}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Unpin ${path}`}
                            onClick={() => onUnpin(path)}
                          />
                        }
                      >
                        <PinOffIcon />
                      </TooltipTrigger>
                      <TooltipContent>Unpin</TooltipContent>
                    </Tooltip>
                  </ContextMenuTrigger>
                  <ContextMenuContent finalFocus={!openingSide}>
                    <FileTreeMenuList
                      actions={menu.actions}
                      hidden={menu.hidden}
                      onAction={(id) => {
                        if (id === 'open-to-side')
                          flushSync(() => setOpeningSide(true));
                        menu.onAction(id);
                      }}
                    />
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
