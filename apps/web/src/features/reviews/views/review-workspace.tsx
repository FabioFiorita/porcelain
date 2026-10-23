import { publishedReviewTitle, type ReviewTitle } from '../rules/documents';
import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { PanelRightIcon, LayersIcon as ReviewLayersIcon } from 'lucide-react';
import { type ReactNode, type SyntheticEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { StateNotice, StateSkeleton } from '@/shared/views/state-notice';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/shared/lib/utils';
import { useReviewOverview } from '@/features/changes/index';
import type { Project } from '@porcelain/client/projects/rules';
import {
  ConflictGuidance,
  GitButton,
  InterruptedActionNotice,
} from '@/features/git-actions/index';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import type {
  SetWorkspaceSearch,
  Surface,
  WorkspaceSearch,
} from '@/shared/workspace/search';
import { useDesktopReview } from '../adapters/desktop-review';
import { type PaneIndex, useTabLayout } from '../adapters/tab-layout';
import { usePublishedReview } from '../queries/published-review';
import { useTabLayoutStore } from '../store';
import {
  anchorBase,
  type RevealComment,
} from '@porcelain/client/reviews/rules';
import { entryKey, type OpenDocument, parseEntry } from '../rules/documents';
import { openToSideText } from '../rules/tab-strip';
import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar } from './review-sidebar';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Worktree = Project['worktrees'][number];

type ReviewWorkspaceProps = {
  worktree: Worktree;
  projectId: string;
  context: ConnectionContext;
  search: WorkspaceSearch;
  onSearch: SetWorkspaceSearch;
  navigationTrigger: ElementTarget<HTMLButtonElement>;
};

export function ReviewWorkspace(props: ReviewWorkspaceProps) {
  return (
    <ReviewBoundary
      connection={props.context.connection}
      scope={{ projectId: props.projectId, worktreeId: props.worktree.id }}
    >
      <ReviewWorkspaceContent {...props} />
    </ReviewBoundary>
  );
}

function ReviewWorkspaceContent({
  worktree,
  projectId,
  search,
  onSearch,
  context,
  navigationTrigger,
}: ReviewWorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktop = useDesktopReview();
  const [focusedPane, setFocusedPane] = useState<PaneIndex>(0);
  const desktopTrigger = useElement<HTMLButtonElement>();
  const mobileTrigger = useElement<HTMLButtonElement>();
  const emptyTrigger = useElement<HTMLButtonElement>();
  const mobileSheet = useElement<HTMLDivElement>();
  const {
    isMobile: navigatorIsMobile,
    open: navigatorOpen,
    openMobile: navigatorOpenMobile,
  } = useSidebar();
  const surface = search.surface ?? 'files';
  const scope = { projectId, worktreeId: worktree.id };
  const { saved } = useTabLayoutStore(worktree.id);
  const overview = useReviewOverview(scope, context.connection);
  const published = usePublishedReview(scope, context);
  const awaitingChanges = Option.isNone(AsyncResult.value(overview));
  const awaitingPublication = Option.isNone(
    AsyncResult.value(published.result),
  );
  const needsDefault =
    !saved && !parseEntry(search.entry) && !parseEntry(search.side);
  const ready = !needsDefault || (!awaitingChanges && !awaitingPublication);
  const hasHandoff =
    Boolean(published.review) ||
    (Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0) >
      0;
  const layout = useTabLayout({
    worktreeId: worktree.id,
    entry: search.entry,
    side: search.side,
    onSearch,
    fallback: hasHandoff ? entryKey({ kind: 'handoff' }) : null,
    focused: focusedPane,
    setFocused: setFocusedPane,
    ready,
    focusBoundary: mobileSheet.element,
    focusBoundaryOpen: mobileOpen,
  });
  const sideLabel = openToSideText(paneSide(layout.split, focusedPane));

  const toggleSidebar = () => {
    if (sidebarOpen) desktopTrigger.element?.focus();
    setSidebarOpen((open) => !open);
  };
  useHotkey(
    SHORTCUTS.toggleSidebar,
    () => {
      if (desktop) toggleSidebar();
      else setMobileOpen((open) => !open);
    },
    { ignoreInputs: true },
  );

  const [reveal, setReveal] = useState<
    (RevealComment & { pane: PaneIndex; key: string }) | undefined
  >();
  const open: OpenDocument = (ref, anchor, options) => {
    const key = entryKey(ref);
    const otherPane: PaneIndex = focusedPane === 0 ? 1 : 0;
    const pane = options?.toSide ? otherPane : layout.open(focusedPane, key);
    setReveal(
      anchor
        ? {
            anchor,
            nonce: Date.now(),
            pane,
            key,
            ...(options?.compose ? { compose: true } : {}),
          }
        : undefined,
    );
    const base = anchor ? anchorBase(anchor) : undefined;
    if (options?.toSide) {
      layout.openToSide(focusedPane, key);
      if (base !== undefined) onSearch({ base });
    } else if (base !== undefined) onSearch({ base });
    setMobileOpen(false);
  };
  const setSurface = (next: Surface) => {
    onSearch({ surface: next });
  };
  useHotkey(SHORTCUTS.surfaceReview, () => setSurface('changes'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceFiles, () => setSurface('files'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceHistory, () => setSurface('history'), {
    ignoreInputs: true,
  });
  const sidebar = (
    <ReviewSidebar
      scope={scope}
      context={context}
      worktreePath={worktree.path}
      surface={surface}
      activeEntry={focusedPane === 1 ? search.side : search.entry}
      available={worktree.available}
      onSurface={setSurface}
      onOpen={open}
      sideLabel={sideLabel}
      changes={{
        scope: search.scope ?? 'uncommitted',
        base: search.base,
        onScope: (next) =>
          onSearch({ scope: next === 'branch' ? next : undefined }),
        onBase: (next) => onSearch({ base: next }),
      }}
    />
  );

  const tabControls = (pane: PaneIndex) => (
    <div data-review-controls="" className="contents">
      <GitButton scope={scope} context={context} />
      <Button
        ref={(element) => desktopTrigger.attach(element)}
        className="hidden xl:inline-flex"
        variant="ghost"
        size="icon-sm"
        aria-label={sidebarOpen ? 'Hide review sidebar' : 'Show review sidebar'}
        aria-expanded={sidebarOpen}
        aria-keyshortcuts={SHORTCUTS.toggleSidebar}
        title={`Toggle review sidebar (${formatForDisplay(SHORTCUTS.toggleSidebar)})`}
        onClick={() => {
          layout.selectPane(pane);
          toggleSidebar();
        }}
      >
        <PanelRightIcon />
      </Button>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            ref={(element) => mobileTrigger.attach(element)}
            className="xl:hidden"
            aria-label="Review"
            aria-keyshortcuts={SHORTCUTS.toggleSidebar}
            title={`Toggle review sidebar (${formatForDisplay(SHORTCUTS.toggleSidebar)})`}
            onClick={() => layout.selectPane(pane)}
          />
        }
      >
        <PanelRightIcon />
      </SheetTrigger>
    </div>
  );

  return (
    <Sheet
      open={mobileOpen}
      onOpenChange={(open) => {
        if (open) emptyTrigger.attach(null);
        setMobileOpen(open);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) layout.focusDestination();
      }}
    >
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          id="review-document"
          minSize={navigatorIsMobile ? 0 : 480}
        >
          <section
            aria-label="Review content"
            className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
          >
            <InterruptedActionNotice scope={scope} context={context} />
            <ConflictGuidance scope={scope} context={context} onOpen={open} />
            <DocumentArea
              reveal={reveal}
              scope={scope}
              context={context}
              overview={overview}
              published={published}
              needsDefault={needsDefault}
              hasHandoff={hasHandoff}
              layout={layout}
              base={search.base}
              focused={focusedPane}
              onOpen={open}
              onBrowse={(next, trigger) => {
                setSurface(next);
                if (desktop) setSidebarOpen(true);
                else {
                  emptyTrigger.attach(trigger);
                  setMobileOpen(true);
                }
              }}
              navigationTrigger={navigationTrigger}
              navigatorIsMobile={navigatorIsMobile}
              navigatorOpen={navigatorOpen}
              navigatorOpenMobile={navigatorOpenMobile}
              tabControls={tabControls}
            />
          </section>
        </ResizablePanel>
        {sidebarOpen && desktop && (
          <>
            <ResizableHandle className="w-2 bg-transparent after:w-2" />
            <ResizablePanel
              id="review-sidebar"
              defaultSize={320}
              minSize={260}
              maxSize={520}
            >
              {sidebar}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      <SheetContent
        ref={(element) => {
          mobileSheet.attach(element);
          if (element === null) layout.focusDestination();
        }}
        finalFocus={() => {
          if (layout.hasDestinationFocus()) return false;
          const active = document.activeElement;
          const stayed =
            active === document.body || mobileSheet.element?.contains(active);
          if (!stayed) return false;
          if (emptyTrigger.element?.isConnected) return emptyTrigger.element;
          return mobileTrigger.element;
        }}
        className="w-[min(90vw,22rem)]!"
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Worktree review</SheetTitle>
          <SheetDescription>
            Choose a review surface and open a document.
          </SheetDescription>
        </SheetHeader>
        {sidebar}
      </SheetContent>
    </Sheet>
  );
}

type PaneContext = {
  scope: { projectId: string; worktreeId: string };
  context: ConnectionContext;
  base: string | undefined;
  onOpen: OpenDocument;
  onBrowse: (surface: 'files' | 'history', trigger: HTMLButtonElement) => void;
  reveal?: (RevealComment & { pane: PaneIndex; key: string }) | undefined;
  navigationTrigger: ElementTarget<HTMLButtonElement>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  tabControls: (pane: PaneIndex) => ReactNode;
};

type DocumentAreaProps = PaneContext & {
  focused: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  overview: ReturnType<typeof useReviewOverview>;
  published: ReturnType<typeof usePublishedReview>;
  needsDefault: boolean;
  hasHandoff: boolean;
};

function DocumentArea(props: DocumentAreaProps) {
  const awaitingChanges = Option.isNone(AsyncResult.value(props.overview));
  const awaitingPublication = Option.isNone(
    AsyncResult.value(props.published.result),
  );
  if (
    props.needsDefault &&
    awaitingChanges &&
    AsyncResult.isFailure(props.overview)
  )
    throw Cause.squash(props.overview.cause);
  if (
    props.needsDefault &&
    awaitingPublication &&
    AsyncResult.isFailure(props.published.result)
  )
    throw Cause.squash(props.published.result.cause);
  if (props.needsDefault && (awaitingChanges || awaitingPublication)) {
    return <StateSkeleton label="Loading review" />;
  }
  return <DocumentPanes {...props} />;
}

function DocumentPanes({
  published,
  hasHandoff,
  layout,
  reveal,
  scope,
  context,
  base,
  focused,
  onOpen,
  onBrowse,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: DocumentAreaProps) {
  const focusedPane = layout.panes[focused] ?? {
    tabs: [],
    pinned: [],
    active: null,
  };
  const shortcuts = {
    ignoreInputs: true,
    enabled: layout.split || focused === 0,
  };
  useHotkey(SHORTCUTS.nextTab, () => layout.step(focused, 1), shortcuts);
  useHotkey(SHORTCUTS.previousTab, () => layout.step(focused, -1), shortcuts);
  useHotkey(
    SHORTCUTS.closeTab,
    () =>
      focusedPane.active !== null &&
      focusedPane.active !== undefined &&
      layout.close(focused, focusedPane.active),
    shortcuts,
  );
  useHotkey(
    SHORTCUTS.openToSide,
    () =>
      focusedPane.active !== null &&
      focusedPane.active !== undefined &&
      layout.openToSide(focused, focusedPane.active),
    shortcuts,
  );

  const paneProps = (index: PaneIndex) => ({
    reveal,
    index,
    layout,
    split: layout.split,
    focused: focused === index,
    scope,
    context,
    reviewTitle: publishedReviewTitle(published.review),
    handoff:
      publishedReviewTitle(published.review) ??
      (hasHandoff ? ('Changes' as const) : null),
    base,
    onOpen,
    onBrowse,
    navigationTrigger,
    navigatorIsMobile,
    navigatorOpen,
    navigatorOpenMobile,
    tabControls,
  });

  if (!layout.split) return <PaneView {...paneProps(0)} />;
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="pane-left" minSize={320}>
        <PaneView {...paneProps(0)} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="pane-right" minSize={320}>
        <PaneView {...paneProps(1)} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function paneSide(split: boolean, index: PaneIndex): 'left' | 'right' | null {
  if (!split) return null;
  return index === 0 ? 'left' : 'right';
}

function PaneView({
  reveal,
  index,
  layout,
  split,
  focused,
  scope,
  context,
  reviewTitle,
  handoff,
  base,
  onOpen,
  onBrowse,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: PaneContext & {
  index: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
  reviewTitle: ReviewTitle | undefined;
  handoff: ReviewTitle | 'Changes' | null;
}) {
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  const document = parseEntry(pane.active ?? undefined);
  const focusPane = (event: SyntheticEvent<HTMLElement>) => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      !event.currentTarget.contains(target) ||
      target.closest('[data-review-controls]') !== null
    )
      return;
    if (event.type === 'pointerdown') layout.selectPane(index);
    else layout.focusPane(index, target);
  };

  return (
    <section
      ref={(element) => layout.bindPane(index, element)}
      aria-label={split ? `${index === 0 ? 'Left' : 'Right'} pane` : undefined}
      data-focused={focused}
      onPointerDownCapture={focusPane}
      onFocusCapture={focusPane}
      className={cn(
        'flex h-full min-h-0 flex-col',
        split && index === 1 && 'border-l',
      )}
    >
      <DocumentTabs
        leading={
          index === 0 ? (
            <SidebarTrigger
              ref={(element) => navigationTrigger.attach(element)}
              aria-label="Toggle Sidebar"
              aria-expanded={
                navigatorIsMobile ? navigatorOpenMobile : navigatorOpen
              }
              aria-keyshortcuts={
                detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'
              }
              title={`Toggle projects (${formatForDisplay(SHORTCUTS.toggleNavigator)})`}
              onClick={() => {
                if (!navigatorIsMobile && navigatorOpen) {
                  requestAnimationFrame(() =>
                    navigationTrigger.element?.focus(),
                  );
                }
              }}
            />
          ) : undefined
        }
        tabs={pane.tabs}
        pinned={pane.pinned}
        active={pane.active}
        reviewTitle={reviewTitle}
        side={paneSide(split, index)}
        focused={focused}
        onActivate={(key) => layout.activate(index, key)}
        onClose={(key) => layout.close(index, key)}
        onCloseOthers={(key) => layout.closeOthers(index, key)}
        onCloseUnpinned={() => layout.closeUnpinned(index)}
        onTogglePin={(key) => layout.togglePin(index, key)}
        onOpenToSide={(key) => layout.openToSide(index, key)}
        trailing={!split || index === 1 ? tabControls(index) : undefined}
      />
      {document === null || document === undefined ? (
        <EmptyDocument handoff={handoff} onOpen={onOpen} onBrowse={onBrowse} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ReviewBoundary
            connection={context.connection}
            scope={scope}
            key={pane.active}
          >
            <DocumentView
              scope={scope}
              context={context}
              document={document}
              sideLabel={openToSideText(paneSide(split, index))}
              base={base}
              onOpen={onOpen}
              active={focused}
              reveal={
                reveal?.pane === index && reveal.key === pane.active
                  ? reveal
                  : undefined
              }
            />
          </ReviewBoundary>
        </div>
      )}
    </section>
  );
}

function EmptyDocument({
  handoff,
  onOpen,
  onBrowse,
}: {
  handoff: ReviewTitle | 'Changes' | null;
  onOpen: OpenDocument;
  onBrowse: PaneContext['onBrowse'];
}) {
  const target =
    handoff &&
    {
      Review: { opens: 'the review', action: 'Open review' },
      Changes: { opens: 'all changes', action: 'Open all changes' },
    }[handoff];
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-8">
      <StateNotice
        icon={<ReviewLayersIcon />}
        title={handoff ? 'Nothing open' : 'No changes to review'}
        description={
          target
            ? `Open ${target.opens}, or choose a file or commit from the right.`
            : 'This worktree matches its last commit. Browse files or history from the right.'
        }
      >
        {target ? (
          <Button onClick={() => onOpen({ kind: 'handoff' })}>
            {target.action}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Files"
              onClick={(event) => onBrowse('files', event.currentTarget)}
            >
              Files <Kbd>{formatForDisplay(SHORTCUTS.surfaceFiles)}</Kbd>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="History"
              onClick={(event) => onBrowse('history', event.currentTarget)}
            >
              History <Kbd>{formatForDisplay(SHORTCUTS.surfaceHistory)}</Kbd>
            </Button>
          </>
        )}
      </StateNotice>
    </div>
  );
}
