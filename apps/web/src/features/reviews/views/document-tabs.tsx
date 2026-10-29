import { TruncatedText } from '@/shared/views/truncated-text';
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { formatForDisplay } from '@tanstack/react-hotkeys';
import {
  Columns2Icon,
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
import { ScrollBar } from '@/components/ui/scroll-area';
import { shortOid } from '@porcelain/client/history/rules';
import { cn } from '@/shared/lib/utils';
import { parseEntry, type ReviewTitle } from '../rules/documents';
import { openToSideText } from '../rules/tab-strip';
import { basename } from '@porcelain/client/reviews/rules';
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

function describeTab(key: string, reviewTitle: ReviewTitle | undefined) {
  const ref = parseEntry(key);
  switch (ref?.kind) {
    case 'handoff':
      return reviewTitle
        ? {
            Icon: ListChecksIcon,
            title: reviewTitle,
            hint: 'Walkthrough of the decisions',
          }
        : { Icon: FileDiffIcon, title: 'Changes', hint: 'All changes' };
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
    case 'review-file':
    case 'review-change':
      return {
        Icon: FileCodeIcon,
        title: basename(ref.path),
        accessibleName: ref.path,
        hint: `${ref.path} · file`,
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
  reviewTitle,
  side,
  focused,
  leading,
  trailing,
  reviewCount,
  ...actions
}: TabActions & {
  tabs: readonly string[];
  pinned: readonly string[];
  active: string | null;
  reviewTitle: ReviewTitle | undefined;
  side: 'left' | 'right' | null;
  focused: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  reviewCount?: ReactNode;
}) {
  return (
    <div
      data-pane-bar=""
      className={cn(
        'flex h-12 shrink-0 items-center gap-1.5 border-b px-2.5 text-[length:var(--text-ui)] leading-[1.4]',
        side !== null && side !== undefined && 'gap-2',
        side !== null && side !== undefined && focused && 'bg-muted/40',
      )}
    >
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
        className="flex h-full min-w-0 flex-1 items-center gap-1"
      >
        {tabs.includes('handoff') && (
          <span className="flex shrink-0">
            <DocumentTab
              tabKey="handoff"
              reviewCount={reviewCount}
              active={active === 'handoff'}
              pinned={false}
              hasUnpinned={tabs.some(
                (key) => key !== 'handoff' && !pinned.includes(key),
              )}
              reviewTitle={reviewTitle}
              side={side}
              {...actions}
            />
          </span>
        )}
        <ScrollAreaPrimitive.Root className="@container/tabs relative h-full min-w-0 flex-1">
          <ScrollAreaPrimitive.Viewport
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
                .filter((key) => key !== 'handoff')
                .map((key, index) => {
                  const isPinned = pinned.includes(key);
                  const endOfPinned =
                    isPinned &&
                    !pinned.includes(tabs[index + 1] ?? '') &&
                    index < tabs.length - 1;
                  return (
                    <span
                      key={key}
                      className="flex min-w-0 shrink-0 items-center"
                    >
                      <DocumentTab
                        tabKey={key}
                        reviewCount={reviewCount}
                        active={key === active}
                        pinned={isPinned}
                        hasUnpinned={tabs.some(
                          (item) =>
                            item !== 'handoff' && !pinned.includes(item),
                        )}
                        reviewTitle={reviewTitle}
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
      </div>
      {trailing !== null && trailing !== undefined && (
        <div className="flex shrink-0 items-center gap-0.5">{trailing}</div>
      )}
    </div>
  );
}

function DocumentTab({
  tabKey,
  reviewCount,
  active,
  pinned,
  hasUnpinned,
  reviewTitle,
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
  reviewCount?: ReactNode;
  active: boolean;
  pinned: boolean;
  hasUnpinned: boolean;
  reviewTitle: ReviewTitle | undefined;
  side: 'left' | 'right' | null;
}) {
  const {
    Icon,
    title,
    hint,
    accessibleName = title,
  } = describeTab(tabKey, reviewTitle);
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
          className={cn(
            'min-w-0 flex-1',
            tabKey.startsWith('file:') && 'italic',
          )}
          text={pinned ? `${hint} · pinned` : hint}
          disclose="always"
          renderTrigger={(label) => (
            <ContextMenuTrigger
              render={
                <div
                  ref={(tab) => {
                    if (active) revealTab(tab);
                  }}
                  role="tab"
                  tabIndex={0}
                  aria-selected={active}
                  aria-label={accessibleName}
                  data-entry={tabKey}
                  className={cn(
                    'group flex h-7 min-w-0 max-w-[min(100cqw,calc(var(--spacing)*45))] cursor-default items-center gap-1.5 rounded-[--spacing(1.75)] px-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground ring-1 ring-border ring-inset'
                      : 'text-muted-foreground hover:bg-accent/50',
                    active && tabKey !== 'handoff' && !pinned && 'pr-0.5',
                  )}
                  onClick={() => onActivate(tabKey)}
                  onAuxClick={(event) => {
                    if (event.button === 1 && !pinned && tabKey !== 'handoff') {
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
              <Icon className="size-3.5 shrink-0" />
              {label}
              {tabKey === 'handoff' && reviewCount && (
                <span className="shrink-0 text-2xs leading-4 whitespace-nowrap text-muted-foreground">
                  {reviewCount}
                </span>
              )}
              {tabKey !== 'handoff' && pinned && (
                <Tooltip disableHoverablePopup>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Unpin ${title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTogglePin(tabKey);
                        }}
                        className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                      />
                    }
                  >
                    <PinIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{`Unpin ${title}`}</TooltipContent>
                </Tooltip>
              )}
              {tabKey !== 'handoff' && active && (
                <Tooltip disableHoverablePopup>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Close ${title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onClose(tabKey);
                        }}
                        className="mr-0.5 grid size-5 place-items-center rounded-[--spacing(1.25)] text-ui leading-[normal] font-normal text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
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
          {title}
        </TruncatedText>
        <ContextMenuContent className="min-w-52" finalFocus={!openingSide}>
          <ContextMenuItem
            disabled={tabKey === 'handoff'}
            onClick={() => onTogglePin(tabKey)}
          >
            {pinned ? <PinOffIcon /> : <PinIcon />}
            {pinned ? 'Unpin' : 'Pin'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={onOpenToSide === undefined}
            onClick={() => {
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
            <ContextMenuItem onClick={onClosePane}>
              <Columns2Icon />
              Close pane
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={tabKey === 'handoff'}
            onClick={() => onClose(tabKey)}
          >
            <XIcon />
            Close
            <ContextMenuShortcut>
              {formatForDisplay(SHORTCUTS.closeTab)}
            </ContextMenuShortcut>
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
    </span>
  );
}
