import { PinOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import type { TreeAction } from '@porcelain/client/files/rules';
import { FileTreeMenuList } from './file-tree-menu';
import { FileTypeIcon } from './file-type-icon';

export function PinnedFiles({
  paths,
  selected,
  onOpen,
  onUnpin,
  menuFor,
}: {
  paths: readonly string[];
  selected: string;
  onOpen: (path: string) => void;
  onUnpin: (path: string) => void;
  menuFor: (path: string) => {
    actions: readonly { id: TreeAction; label: string }[];
    hidden: boolean;
    onAction: (id: TreeAction) => void;
  };
}) {
  if (paths.length === 0) return null;
  return (
    <section aria-label="Pinned files" className="shrink-0 px-2 pt-1.5 pb-1">
      <p className="px-1.5 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
        Pinned
      </p>
      <ul>
        {paths.map((path) => {
          const separator = path.lastIndexOf('/') + 1;
          const menu = menuFor(path);
          return (
            <ContextMenu key={path}>
              <ContextMenuTrigger
                render={<li className="flex items-center gap-0.5" />}
              >
                <button
                  type="button"
                  aria-current={path === selected ? 'page' : undefined}
                  title={path}
                  className={cn(
                    'flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[12.5px] hover:bg-accent',
                    path === selected && 'bg-accent',
                  )}
                  onClick={() => onOpen(path)}
                >
                  <FileTypeIcon path={path} className="size-3.5 shrink-0" />
                  <span className="shrink-0">{path.slice(separator)}</span>
                  {separator > 0 && (
                    <span className="truncate text-muted-foreground">
                      {path.slice(0, separator - 1)}
                    </span>
                  )}
                </button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Unpin ${path}`}
                  title="Unpin"
                  onClick={() => onUnpin(path)}
                >
                  <PinOffIcon />
                </Button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <FileTreeMenuList
                  actions={menu.actions}
                  hidden={menu.hidden}
                  onAction={menu.onAction}
                />
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </ul>
    </section>
  );
}
