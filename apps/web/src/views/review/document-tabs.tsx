import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import {
  Columns2Icon,
  FileCode2Icon,
  FileDiffIcon,
  FileTextIcon,
  GitCommitHorizontalIcon,
  LayersIcon,
  ListXIcon,
  PinIcon,
  PinOffIcon,
  SquareXIcon,
  XIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseEntry } from '../../domain/documents';
import {
  type Artifact,
  basename,
  type Layers,
  shortOid,
} from '../../domain/review';

type Layer = Layers['layers'][number];

function describeTab(
  key: string,
  layers: readonly Layer[],
  artifacts: readonly Artifact[],
) {
  const ref = parseEntry(key);
  switch (ref?.kind) {
    case 'handoff':
      return layers.length > 0
        ? { Icon: LayersIcon, title: 'Handoff', hint: 'The whole handoff' }
        : { Icon: FileDiffIcon, title: 'Changes', hint: 'All changes' };
    case 'layer': {
      const index = layers.findIndex((layer) => layer.id === ref.layerId);
      const title = layers[index]?.title ?? 'Layer';
      return {
        Icon: LayersIcon,
        title: `${index >= 0 ? `${index + 1}. ` : ''}${title}`,
        hint: title,
      };
    }
    case 'change':
      return {
        Icon: FileCode2Icon,
        title: basename(ref.path),
        hint: `${ref.path} · changes`,
      };
    case 'file':
      return {
        Icon: FileTextIcon,
        title: basename(ref.path),
        hint: `${ref.path} · file`,
      };
    case 'commit':
      return {
        Icon: GitCommitHorizontalIcon,
        title: shortOid(ref.oid),
        hint: `Commit ${ref.oid}`,
      };
    case 'artifact': {
      const artifact = artifacts.find((item) => item.id === ref.artifactId);
      const name = artifact?.name ?? 'Artifact';
      return {
        Icon: FileTextIcon,
        title: name,
        hint: `${name} · from the agent`,
      };
    }
    default:
      return { Icon: FileTextIcon, title: key, hint: key };
  }
}

export type TabActions = {
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onCloseOthers: (key: string) => void;
  onCloseUnpinned: () => void;
  onTogglePin: (key: string) => void;
  onOpenToSide: (key: string) => void;
};

export function DocumentTabs({
  tabs,
  pinned,
  active,
  layers,
  artifacts = [],
  side,
  focused,
  trailing,
  ...actions
}: TabActions & {
  tabs: readonly string[];
  pinned: readonly string[];
  active: string | null;
  layers: readonly Layer[];
  artifacts?: readonly Artifact[];
  side: 'left' | 'right' | null;
  focused: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center border-b',
        side != null && focused && 'bg-muted/40',
      )}
    >
      <ScrollAreaPrimitive.Root className="relative h-full min-w-0 flex-1">
        <ScrollAreaPrimitive.Viewport className="size-full overflow-y-hidden">
          <div
            role="tablist"
            aria-label={
              side == null ? 'Open documents' : `Open documents, ${side} pane`
            }
            className="flex h-full w-max min-w-full items-center gap-1 px-1.5"
          >
            {tabs.length === 0 && (
              <span className="px-2 text-xs text-muted-foreground">
                No open tabs
              </span>
            )}
            {tabs.map((key, index) => {
              const isPinned = pinned.includes(key);
              const endOfPinned =
                isPinned &&
                !pinned.includes(tabs[index + 1] ?? '') &&
                index < tabs.length - 1;
              return (
                <span key={key} className="contents">
                  <DocumentTab
                    tabKey={key}
                    active={key === active}
                    pinned={isPinned}
                    hasUnpinned={tabs.some((item) => !pinned.includes(item))}
                    layers={layers}
                    artifacts={artifacts}
                    side={side}
                    {...actions}
                  />
                  {endOfPinned && (
                    <span
                      aria-hidden="true"
                      className="mx-0.5 h-4 w-px shrink-0 bg-border"
                    />
                  )}
                </span>
              );
            })}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar
          orientation="horizontal"
          className="absolute inset-x-0 bottom-0 data-horizontal:h-1.5"
        />
      </ScrollAreaPrimitive.Root>
      {trailing != null && (
        <div className="flex shrink-0 items-center px-1.5">{trailing}</div>
      )}
    </div>
  );
}

function DocumentTab({
  tabKey,
  active,
  pinned,
  hasUnpinned,
  layers,
  artifacts,
  side,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseUnpinned,
  onTogglePin,
  onOpenToSide,
}: TabActions & {
  tabKey: string;
  active: boolean;
  pinned: boolean;
  hasUnpinned: boolean;
  layers: readonly Layer[];
  artifacts: readonly Artifact[];
  side: 'left' | 'right' | null;
}) {
  const { Icon, title, hint } = describeTab(tabKey, layers, artifacts);
  const openToSideLabel =
    side == null
      ? 'Open to the side'
      : side === 'left'
        ? 'Open in the right pane'
        : 'Open in the left pane';

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="tab"
            tabIndex={0}
            aria-selected={active}
            title={pinned ? `${hint} · pinned` : hint}
            data-entry={tabKey}
            className={cn(
              'group flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-md pr-1 pl-2 text-xs transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
            onClick={() => onActivate(tabKey)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate(tabKey);
              }
            }}
          />
        }
      >
        <Icon className="size-3.5 shrink-0" />
        <span
          className={cn(
            'max-w-44 truncate pr-0.5',
            tabKey.startsWith('file:') && 'italic',
          )}
        >
          {title}
        </span>
        {pinned ? (
          <button
            type="button"
            aria-label={`Unpin ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(tabKey);
            }}
            className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <PinIcon className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onClose(tabKey);
            }}
            className={cn(
              'grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <XIcon className="size-3" />
          </button>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={() => onTogglePin(tabKey)}>
          {pinned ? <PinOffIcon /> : <PinIcon />}
          {pinned ? 'Unpin' : 'Pin'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpenToSide(tabKey)}>
          <Columns2Icon />
          {openToSideLabel}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onClose(tabKey)}>
          <XIcon />
          Close
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCloseOthers(tabKey)}>
          <SquareXIcon />
          Close others
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasUnpinned} onClick={onCloseUnpinned}>
          <ListXIcon />
          Close unpinned
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
