import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  Columns2,
  FileDiff,
  FileQuestion,
  GitCommitHorizontal,
  Layers,
  ListX,
  type LucideIcon,
  Pin,
  PinOff,
  SquareStack,
  SquareX,
  X,
} from 'lucide-react';
import {
  type ComponentType,
  Fragment,
  type ReactNode,
  type SVGProps,
  useEffect,
  useRef,
} from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ReviewResponse } from '../../contracts/review';
import { parseEntry } from '../../domain/documents';
import { shortOid } from '../../domain/history';
import { basename } from '../../domain/review';
import { SHORTCUTS } from '../workspace/shortcuts';
import { FileTypeIcon } from './file-type-icon';

type TabIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

/** File tabs use the file's own type icon, so a tab reads the same as its row in the tree. */
const fileTypeIcon = (path: string): TabIcon =>
  // Not named FileTypeIcon: that would shadow the import and render itself forever.
  function TabFileIcon(props: SVGProps<SVGSVGElement>) {
    return <FileTypeIcon path={path} className={props.className} />;
  };

function describe(
  key: string,
  review: ReviewResponse | null,
): { Icon: TabIcon; title: string; hint: string } {
  const ref = parseEntry(key);
  switch (ref?.kind) {
    case 'review':
      // A review is something the agent published; without one this is the worktree's changes.
      return review != null
        ? {
            Icon: Layers,
            title: 'Review',
            hint: 'The agent’s summary and graph',
          }
        : {
            Icon: FileDiff,
            title: 'Changes',
            hint: 'Every change in this worktree',
          };
    case 'layer': {
      const index =
        review?.layers.findIndex((layer) => layer.id === ref.layerId) ?? -1;
      const title = review?.layers[index]?.title;
      return title == null
        ? {
            Icon: SquareStack,
            title: 'Layer',
            hint: 'A layer of a review that was replaced',
          }
        : { Icon: SquareStack, title: `${index + 1}. ${title}`, hint: title };
    }
    case 'unexplained':
      return {
        Icon: FileQuestion,
        title: 'Not explained',
        hint: 'Changed lines no step of the review explains',
      };
    case 'change':
      return {
        Icon: fileTypeIcon(ref.path),
        title: basename(ref.path),
        hint: `${ref.path} · changes`,
      };
    case 'file':
      return {
        Icon: fileTypeIcon(ref.path),
        title: basename(ref.path),
        hint: `${ref.path} · file`,
      };
    case 'commit':
      return {
        Icon: GitCommitHorizontal,
        title: shortOid(ref.oid),
        hint: `Commit ${ref.oid}`,
      };
    default:
      return { Icon: fileTypeIcon(key), title: key, hint: key };
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

type Props = TabActions & {
  tabs: readonly string[];
  pinned: readonly string[];
  active: string | null;
  /** The agent's review, which names the review and layer tabs; null in plain Changes. */
  review: ReviewResponse | null;
  /** Which side this strip belongs to, when the centre is split. */
  side: 'left' | 'right' | null;
  focused: boolean;
  /** Pinned at the left end, outside the scrolling tabs (the projects toggle). */
  leading?: ReactNode;
  /** Pinned at the right end, outside the scrolling tabs (the Git button, the sidebar toggle). */
  trailing?: ReactNode;
};

/** The review, its layers, Not explained, diffs, files and commits all open as tabs. */
export function DocumentTabs({
  tabs,
  pinned,
  active,
  review,
  side,
  focused,
  leading,
  trailing,
  ...actions
}: Props) {
  // Horizontal only: a native `overflow-x-auto` also grew a vertical bar and a
  // thick system scrollbar. The shadcn bar overlays the strip's bottom edge.
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center border-b',
        side != null && focused && 'bg-muted/50',
      )}
    >
      {leading != null && (
        <div className="flex shrink-0 items-center pl-1.5">{leading}</div>
      )}
      <ScrollAreaPrimitive.Root
        data-slot="scroll-area"
        className="relative h-full min-w-0 flex-1"
      >
        <ScrollAreaPrimitive.Viewport
          data-slot="scroll-area-viewport"
          className="size-full overflow-y-hidden"
        >
          <div
            role="tablist"
            aria-label={
              side == null ? 'Open documents' : `Open documents, ${side} pane`
            }
            data-focused={focused}
            // h-full, not h-10: the strip's bottom border would leave one pixel to scroll vertically.
            className="flex h-full w-max min-w-full items-center gap-1 px-1.5"
          >
            <TabList
              tabs={tabs}
              pinned={pinned}
              active={active}
              review={review}
              side={side}
              actions={actions}
            />
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar
          orientation="horizontal"
          className="absolute inset-x-0 bottom-0 data-horizontal:h-1.5"
        />
      </ScrollAreaPrimitive.Root>
      {trailing != null && (
        <div className="flex shrink-0 items-center gap-0.5 pr-1.5 pl-1">
          {trailing}
        </div>
      )}
    </div>
  );
}

function TabList({
  tabs,
  pinned,
  active,
  review,
  side,
  actions,
}: Pick<Props, 'tabs' | 'pinned' | 'active' | 'review' | 'side'> & {
  actions: TabActions;
}) {
  return (
    <>
      {tabs.length === 0 && (
        <span className="px-2 text-xs text-muted-foreground">No open tabs</span>
      )}
      {tabs.map((key, index) => {
        const isPinned = pinned.includes(key);
        // A hairline between the pinned group and the rest.
        const endOfPinned =
          isPinned &&
          !pinned.includes(tabs[index + 1] ?? '') &&
          index < tabs.length - 1;
        return (
          <Fragment key={key}>
            <Tab
              tabKey={key}
              active={key === active}
              pinned={isPinned}
              hasUnpinned={tabs.some((entry) => !pinned.includes(entry))}
              review={review}
              side={side}
              {...actions}
            />
            {endOfPinned && (
              <span
                aria-hidden="true"
                className="mx-0.5 h-4 w-px shrink-0 bg-border"
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function Tab({
  tabKey,
  active,
  pinned,
  hasUnpinned,
  review,
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
  review: ReviewResponse | null;
  side: 'left' | 'right' | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { Icon, title, hint } = describe(tabKey, review);

  useEffect(() => {
    if (active)
      ref.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [active]);

  const toSideLabel =
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
            ref={ref}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            title={pinned ? `${hint} · pinned` : hint}
            data-entry={tabKey}
            data-pinned={pinned || undefined}
            onClick={() => onActivate(tabKey)}
            onAuxClick={(event) => {
              // Middle-click closes, except a pinned tab: pinning is how you keep it.
              if (event.button === 1 && !pinned) onClose(tabKey);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ')
                onActivate(tabKey);
            }}
            className={cn(
              'group flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-md pr-1 pl-2 text-xs transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          />
        }
      >
        <Icon className="size-3.5 shrink-0" />
        {/* Italic glyphs lean past their box; the right padding stops `truncate` clipping the last letter. */}
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
            <Pin className="size-3" />
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
              // Touch has no hover, so every tab shows its close button there.
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
            )}
          >
            <X className="size-3" />
          </button>
        )}
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onClick={() => onTogglePin(tabKey)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? 'Unpin' : 'Pin'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpenToSide(tabKey)}>
          <Columns2 />
          {toSideLabel}
          <ContextMenuShortcut>
            {formatForDisplay(SHORTCUTS.openToSide)}
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onClose(tabKey)}>
          <X />
          Close
          <ContextMenuShortcut>
            {formatForDisplay(SHORTCUTS.closeTab)}
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCloseOthers(tabKey)}>
          <SquareX />
          Close others
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasUnpinned} onClick={onCloseUnpinned}>
          <ListX />
          Close unpinned
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
