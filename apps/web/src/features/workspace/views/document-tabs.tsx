import { Button } from '@/components/ui/button';
import { readCommit } from '@porcelain/client/history';
import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';
import { TruncatedText } from '@/shared/views/truncated-text';
import { WindowDragRegion } from '@/shared/views/window-drag-region';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  Columns2Icon,
  ChevronDownIcon,
  FileDiffIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  GitCommitHorizontalIcon,
  FileCodeIcon,
  HistoryIcon,
  ListChecksIcon,
  ListXIcon,
  PinIcon,
  PinOffIcon,
  SquareXIcon,
  XIcon,
} from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Kbd } from '@/components/ui/kbd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ScrollAreaRoot,
  ScrollStripViewport,
  ScrollBar,
} from '@/components/ui/scroll-area';
import { shortOid } from '@porcelain/client/history/rules';
import { cn } from '@/shared/lib/utils';
import { parseEntry } from '../rules/documents';
import {
  permanentTab,
  openToSideText,
  REVIEW_TAB,
  type DocumentIds,
} from '../rules/tab-strip';
import { basename } from '@porcelain/client/changes/rules';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function revealTab(tab: HTMLElement | null) {
  const viewport = tab?.closest<HTMLElement>('[data-tab-viewport]');
  if (!tab || !viewport) return;
  const chip = tab.getBoundingClientRect();
  const frame = viewport.getBoundingClientRect();
  const left =
    chip.left < frame.left
      ? chip.left - frame.left
      : Math.max(0, chip.right - frame.right);
  viewport.scrollBy({ left });
}

function describeTab(key: string) {
  const ref = parseEntry(key);
  switch (ref?.kind) {
    case 'review':
      return {
        Icon: ListChecksIcon,
        title: 'Review',
        hint: "The branch's review",
      };
    case 'walkthrough-step':
      return {
        Icon: FileDiffIcon,
        title: `Step ${ref.step}`,
        hint: `Changes in step ${ref.step}`,
      };
    case 'all-changes':
      return {
        Icon: FileDiffIcon,
        title: 'All changes',
        hint: 'Every changed file, including specs',
      };
    case 'specs':
      return {
        Icon: FlaskConicalIcon,
        title: 'Specs',
        hint: 'Changed spec and test files',
      };
    case 'change':
      return {
        Icon: FileCodeIcon,
        title: basename(ref.path),
        accessibleName: ref.path,
        hint: `${ref.path} · changes`,
      };
    case 'file':
      return {
        Icon: FileCodeIcon,
        title: basename(ref.path),
        accessibleName: ref.path,
        hint: ref.path,
      };
    case 'commit':
      return {
        Icon: GitCommitHorizontalIcon,
        title: shortOid(ref.oid),
        hint: `Commit ${ref.oid}`,
      };
    case 'branch':
      return {
        Icon: GitBranchIcon,
        title: 'Branch',
        hint: 'Every change on the branch',
      };
    case 'branch-file':
      return {
        Icon: FileCodeIcon,
        title: basename(ref.path),
        accessibleName: ref.path,
        hint: `${ref.path} · branch`,
      };
    case 'pull-request':
      return {
        Icon: GitPullRequestIcon,
        title: `PR #${ref.number}`,
        hint: `Pull request #${ref.number}`,
      };
    case 'graph':
      return {
        Icon: GitBranchIcon,
        title: 'Graph',
        hint: 'Commit graph of the checked-out branch',
      };
    case 'timeline':
      return {
        Icon: HistoryIcon,
        title: `Timeline of ${basename(ref.path)}`,
        accessibleName: `Timeline of ${ref.path}`,
        hint: `${ref.path} · timeline`,
      };
    default:
      return { Icon: FileTextIcon, title: key, hint: key };
  }
}

type TabActions = {
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onCloseOthers: (key: string) => void;
  onCloseUnpinned: () => void;
  onTogglePin: (key: string) => void;
  onOpenToSide?: ((key: string) => void) | undefined;
  onClosePane?: (() => void) | undefined;
};

export function DocumentTabs({
  tabs,
  pinned,
  active,
  side,
  leading,
  trailing,
  commitContext,
  ids,
  ...actions
}: TabActions & {
  ids: (key: string) => DocumentIds;
  tabs: readonly string[];
  pinned: readonly string[];
  active: string | null;
  side: 'left' | 'right' | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  commitContext?: { connection: Connection; scope: HistoryScope };
}) {
  return (
    <div
      data-pane-bar=""
      className={cn(
        'relative flex h-12 shrink-0 items-center gap-1.5 border-b px-2.5 text-ui',
        side !== null && side !== undefined && 'gap-2',
      )}
    >
      <WindowDragRegion />
      {leading !== null && leading !== undefined && (
        <div className="flex shrink-0 items-center">{leading}</div>
      )}
      <div
        role="tablist"
        aria-label={
          side === null || side === undefined
            ? 'Open documents'
            : `Open documents, ${side} pane`
        }
        className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden"
      >
        {tabs.includes(REVIEW_TAB) && (
          <span className="flex shrink-0">
            <DocumentTab
              tabKey={REVIEW_TAB}
              ids={ids(REVIEW_TAB)}
              active={active === REVIEW_TAB}
              pinned={false}
              hasUnpinned={tabs.some(
                (key) => !permanentTab(key) && !pinned.includes(key),
              )}
              hasOthers={tabs.some(
                (key) => !permanentTab(key) && !pinned.includes(key),
              )}
              side={side}
              {...actions}
            />
          </span>
        )}
        <ScrollAreaRoot className="@container/tabs relative h-full min-w-0 flex-1">
          <ScrollStripViewport
            data-tab-viewport=""
            className="size-full overflow-y-hidden"
            ref={(viewport) => {
              if (!viewport) return;
              const reveal = () =>
                revealTab(
                  viewport.querySelector<HTMLElement>(
                    '[role="tab"][aria-selected="true"]',
                  ),
                );
              let frame = 0;
              const observer = new ResizeObserver(() => {
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(reveal);
              });
              observer.observe(viewport);
              return () => {
                cancelAnimationFrame(frame);
                observer.disconnect();
              };
            }}
          >
            <div className="flex h-full w-max min-w-full items-center gap-1 px-1.5">
              {tabs
                .filter((key) => !permanentTab(key))
                .map((key, index) => {
                  const isPinned = pinned.includes(key);
                  const endOfPinned =
                    isPinned &&
                    !pinned.includes(tabs[index + 1] ?? '') &&
                    index < tabs.length - 1;
                  const document = parseEntry(key);
                  const tabProps = {
                    tabKey: key,
                    ids: ids(key),
                    active: key === active,
                    pinned: isPinned,
                    hasUnpinned: tabs.some(
                      (item) => !permanentTab(item) && !pinned.includes(item),
                    ),
                    hasOthers: tabs.some(
                      (item) =>
                        item !== key &&
                        !permanentTab(item) &&
                        !pinned.includes(item),
                    ),
                    side,
                    ...actions,
                  };
                  return (
                    <span
                      key={key}
                      className="flex min-w-0 shrink-0 items-center"
                    >
                      {commitContext && document?.kind === 'commit' ? (
                        <CommitTab
                          {...tabProps}
                          commitContext={commitContext}
                          oid={document.oid}
                        />
                      ) : (
                        <DocumentTab {...tabProps} />
                      )}
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
          </ScrollStripViewport>
          <ScrollBar
            orientation="horizontal"
            className="absolute inset-x-0 bottom-0 data-horizontal:h-1.5"
          />
        </ScrollAreaRoot>
      </div>
      {tabs.length > 1 && (
        <DropdownMenu>
          <Tooltip hoverable={false}>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      aria-label="Open document list"
                    />
                  }
                />
              }
            >
              <span className="tabular-nums">
                {tabs.length}
                <span className="max-sm:hidden"> tabs</span>
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </TooltipTrigger>
            <TooltipContent>Open document list</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={active ?? ''}
              onValueChange={(key: unknown) => {
                if (typeof key === 'string' && tabs.includes(key))
                  actions.onActivate(key);
              }}
            >
              {tabs.map((key) => {
                const {
                  Icon,
                  title,
                  hint,
                  accessibleName = title,
                } = describeTab(key);
                return (
                  <DropdownMenuRadioItem
                    key={key}
                    value={key}
                    closeOnSelect
                    aria-label={accessibleName}
                    className="items-start"
                  >
                    <Icon className="mt-0.5" />
                    <span className="min-w-0 whitespace-normal break-all">
                      {hint}
                    </span>
                    {pinned.includes(key) && (
                      <PinIcon aria-label="Pinned" className="mt-0.5" />
                    )}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {trailing !== null && trailing !== undefined && (
        <div className="relative flex shrink-0 items-center gap-1">
          {trailing}
        </div>
      )}
    </div>
  );
}

function DocumentTab({
  tabKey,
  commitSubject,
  ids,
  active,
  pinned,
  hasUnpinned,
  hasOthers,
  side,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseUnpinned,
  onTogglePin,
  onOpenToSide,
  onClosePane,
}: TabActions & {
  tabKey: string;
  ids: DocumentIds;
  commitSubject?: string | undefined;
  active: boolean;
  pinned: boolean;
  hasUnpinned: boolean;
  hasOthers: boolean;
  side: 'left' | 'right' | null;
}) {
  const { Icon, title, hint, accessibleName = title } = describeTab(tabKey);
  const tabTitle = commitSubject ? `${title} ${commitSubject}` : title;
  const tabHint = commitSubject ? `${hint} · ${commitSubject}` : hint;
  const [openingSide, setOpeningSide] = useState(false);
  const openToSideLabel = openToSideText(side);
  const activateTab = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(tabKey);
    }
  };

  return (
    <span className="inline-flex min-w-0 flex-1">
      <ContextMenu
        onOpenChange={(open) => {
          if (open) setOpeningSide(false);
        }}
      >
        <TruncatedText
          className="min-w-0 flex-1"
          text={pinned ? `${tabHint} · pinned` : tabHint}
          disclose="always"
          renderTrigger={(label) => (
            <ContextMenuTrigger
              render={
                <div
                  ref={(tab) => {
                    if (active) revealTab(tab);
                  }}
                  role="tab"
                  id={ids.tab}
                  aria-controls={active ? ids.panel : undefined}
                  tabIndex={0}
                  aria-selected={active}
                  aria-label={commitSubject ? tabTitle : accessibleName}
                  data-entry={tabKey}
                  className={cn(
                    'group flex h-7 min-w-0 max-w-[min(100cqw,calc(var(--spacing)*45))] cursor-default items-center gap-1.5 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60',
                    active
                      ? 'bg-muted text-foreground ring-1 ring-border ring-inset'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    active && !permanentTab(tabKey) && !pinned && 'pr-0.5',
                  )}
                  onClick={() => onActivate(tabKey)}
                  onAuxClick={(event) => {
                    if (
                      event.button === 1 &&
                      !pinned &&
                      !permanentTab(tabKey)
                    ) {
                      event.preventDefault();
                      onClose(tabKey);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget)
                      activateTab(event);
                  }}
                />
              }
            >
              <Icon
                className="size-3.5 shrink-0"
                strokeWidth={permanentTab(tabKey) ? 1.75 : undefined}
              />
              {label}
              {!permanentTab(tabKey) && pinned && (
                <Tooltip hoverable={false}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        aria-label={`Unpin ${title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePin(tabKey);
                        }}
                        variant="ghost"
                        size="icon-xs"
                      />
                    }
                  >
                    <PinIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{`Unpin ${title}`}</TooltipContent>
                </Tooltip>
              )}
              {!permanentTab(tabKey) && active && (
                <Tooltip hoverable={false}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        aria-label={`Close ${title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onClose(tabKey);
                        }}
                        variant="ghost"
                        size="icon-xs"
                        className="mr-0.5"
                      />
                    }
                  >
                    <XIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Close ${title}`}
                    <Kbd>{formatForDisplay(SHORTCUTS.closeTab)}</Kbd>
                  </TooltipContent>
                </Tooltip>
              )}
            </ContextMenuTrigger>
          )}
        >
          {tabTitle}
        </TruncatedText>
        <ContextMenuContent finalFocus={openingSide ? 'none' : 'trigger'}>
          <ContextMenuItem
            disabled={permanentTab(tabKey)}
            onSelect={() => onTogglePin(tabKey)}
          >
            {pinned ? <PinOffIcon /> : <PinIcon />}
            {pinned ? 'Unpin' : 'Pin'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={onOpenToSide === undefined || permanentTab(tabKey)}
            onSelect={() => {
              flushSync(() => setOpeningSide(true));
              onOpenToSide?.(tabKey);
            }}
          >
            <Columns2Icon />
            {openToSideLabel}
            <ContextMenuShortcut>
              {formatForDisplay(SHORTCUTS.openToSide)}
            </ContextMenuShortcut>
          </ContextMenuItem>
          {onClosePane && (
            <ContextMenuItem onSelect={onClosePane}>
              <Columns2Icon />
              Close pane
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={permanentTab(tabKey)}
            onSelect={() => onClose(tabKey)}
          >
            <XIcon />
            Close
            <ContextMenuShortcut>
              {formatForDisplay(SHORTCUTS.closeTab)}
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!hasOthers}
            onSelect={() => onCloseOthers(tabKey)}
          >
            <SquareXIcon />
            Close others
          </ContextMenuItem>
          <ContextMenuItem disabled={!hasUnpinned} onSelect={onCloseUnpinned}>
            <ListXIcon />
            Close unpinned
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </span>
  );
}

function CommitTab(
  props: Parameters<typeof DocumentTab>[0] & {
    commitContext: { connection: Connection; scope: HistoryScope };
    oid: string;
  },
) {
  const { commitContext, oid, ...tab } = props;
  const result = useAtomValue(readCommit({ ...commitContext, oid, parent: 1 }));
  const commit = Option.getOrUndefined(AsyncResult.value(result));
  return <DocumentTab {...tab} commitSubject={commit?.commit.subject} />;
}
