import { StateSkeleton } from '@/shared/views/state-notice';
import { publishedReviewTitle, type ReviewTitle } from '../rules/documents';
import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { PanelRightIcon } from 'lucide-react';
import { type ReactNode, type SyntheticEvent, useState } from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';
import { useAtomValue } from '@effect/atom-react';
import { readReview, readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionProgress,
  type ReviewResponse,
} from '@porcelain/client/reviews/rules';
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
import { useTabLayoutStore, useReviewRevisionSelection } from '../store';
import { useSpecsApart } from '@/features/preferences/index';
import {
  anchorBase,
  type RevealComment,
} from '@porcelain/client/reviews/rules';
import { entryKey, type OpenDocument, parseEntry } from '../rules/documents';
import { openToSideText } from '../rules/tab-strip';
import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar, SURFACES, surfaceNames } from './review-sidebar';
import { SideRail } from './side-rail';
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktop = useDesktopReview();
  const [focusedPane, setFocusedPane] = useState<PaneIndex>(0);
  const railToggle = useElement<HTMLButtonElement>();
  const mobileTrigger = useElement<HTMLButtonElement>();
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
  const defaultEntry =
    Boolean(published.review) ||
    (Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0) >
      0
      ? entryKey({ kind: 'handoff' })
      : null;
  const layout = useTabLayout({
    worktreeId: worktree.id,
    entry: search.entry,
    side: search.side,
    onSearch,
    fallback: defaultEntry,
    focused: focusedPane,
    setFocused: setFocusedPane,
    ready,
    focusBoundary: mobileSheet.element,
    focusBoundaryOpen: mobileOpen && !desktop,
  });
  const sideLabel = openToSideText(paneSide(layout.split, focusedPane));

  const toggleSidebar = () => {
    if (panelOpen) railToggle.element?.focus();
    setPanelOpen((open) => !open);
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
  const showSurface = (next: Surface) => {
    setSurface(next);
    if (desktop) setPanelOpen(true);
    else setMobileOpen(true);
  };
  useHotkey(SHORTCUTS.surfaceReview, () => showSurface('changes'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceFiles, () => showSurface('files'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceHistory, () => showSurface('history'), {
    ignoreInputs: true,
  });
  const browseTrigger = useElement<HTMLButtonElement>();
  const browse = (next: 'files' | 'history', trigger: HTMLButtonElement) => {
    browseTrigger.attach(trigger);
    showSurface(next);
  };
  const activeEntry = layout.panes[focusedPane]?.active ?? undefined;
  const sidebar = (layout: 'docked' | 'sheet') => (
    <ReviewSidebar
      layout={layout}
      scope={scope}
      context={context}
      worktreePath={worktree.path}
      surface={surface}
      activeEntry={activeEntry}
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
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <GitButton scope={scope} context={context} />
      <Tooltip>
        <TooltipTrigger
          render={
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  ref={(element) => mobileTrigger.attach(element)}
                  className="xl:hidden"
                  aria-label="Review"
                  aria-keyshortcuts={SHORTCUTS.toggleSidebar}
                  onClick={() => {
                    browseTrigger.attach(null);
                    layout.selectPane(pane);
                  }}
                />
              }
            >
              <PanelRightIcon />
            </SheetTrigger>
          }
        />
        <TooltipContent role="tooltip" className="break-all">
          Review <Kbd>{formatForDisplay(SHORTCUTS.toggleSidebar)}</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <Sheet
      open={mobileOpen && !desktop}
      onOpenChange={setMobileOpen}
      onOpenChangeComplete={(open) => {
        if (!open) layout.focusDestination();
      }}
    >
      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            id="review-document"
            minSize={navigatorIsMobile ? 0 : 480}
          >
            <section
              aria-label="Review content"
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-paper border bg-card"
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
                layout={layout}
                base={search.base}
                focused={focusedPane}
                onOpen={open}
                onBrowse={browse}
                navigationTrigger={navigationTrigger}
                navigatorIsMobile={navigatorIsMobile}
                navigatorOpen={navigatorOpen}
                navigatorOpenMobile={navigatorOpenMobile}
                tabControls={tabControls}
              />
            </section>
          </ResizablePanel>
          {panelOpen && desktop && (
            <>
              <ResizableHandle className="w-2 bg-transparent after:w-2" />
              <ResizablePanel
                id="review-sidebar"
                defaultSize={320}
                minSize={260}
                maxSize={520}
              >
                {sidebar('docked')}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        {desktop && (
          <SideRail
            surfaces={SURFACES}
            names={surfaceNames(published.review)}
            published={Boolean(published.review)}
            surface={surface}
            open={panelOpen}
            onSelect={showSurface}
            onHide={() => setPanelOpen(false)}
            onToggle={toggleSidebar}
            toggleRef={(element) => railToggle.attach(element)}
          />
        )}
      </div>
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
          return browseTrigger.element?.isConnected
            ? browseTrigger.element
            : mobileTrigger.element;
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
        {!desktop && sidebar('sheet')}
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
    review: published.review ?? undefined,
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
    <ResizablePanelGroup
      orientation={navigatorIsMobile ? 'vertical' : 'horizontal'}
      className="min-h-0 flex-1"
    >
      <ResizablePanel id="pane-left" minSize={navigatorIsMobile ? 200 : 320}>
        <PaneView {...paneProps(0)} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="pane-right" minSize={navigatorIsMobile ? 200 : 320}>
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
  review,
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
  review: ReviewResponse | undefined;
}) {
  const { element: toolbarTarget, attach: setToolbarTarget } =
    useElement<HTMLDivElement>();
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
        '@container/pane flex h-full min-h-0 min-w-0 flex-col',
        split && index === 1 && 'border-l',
      )}
    >
      <DocumentTabs
        reviewCount={
          review?.reviewId ? (
            <ReviewTabProgress review={review} context={context} />
          ) : undefined
        }
        leading={
          index === 0 ? (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <SidebarTrigger
                  ref={(element) => navigationTrigger.attach(element)}
                  aria-label="Toggle Sidebar"
                  aria-expanded={
                    navigatorIsMobile ? navigatorOpenMobile : navigatorOpen
                  }
                  aria-keyshortcuts={
                    detectPlatform() === 'mac' ? 'Meta+B' : 'Control+B'
                  }
                  onClick={() => {
                    if (!navigatorIsMobile && navigatorOpen) {
                      requestAnimationFrame(() =>
                        navigationTrigger.element?.focus(),
                      );
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipContent role="tooltip" className="break-all">
                Toggle Sidebar{' '}
                <Kbd>{formatForDisplay(SHORTCUTS.toggleNavigator)}</Kbd>
              </TooltipContent>
            </Tooltip>
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
        onClosePane={split ? () => layout.closePane(index) : undefined}
        trailing={
          <>
            <div
              ref={setToolbarTarget}
              data-pane-controls=""
              role="toolbar"
              aria-label="Document controls"
              className="flex items-center gap-1"
            />
            {(!split || index === 1) && tabControls(index)}
          </>
        }
      />
      {document === null || document === undefined ? null : (
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
              onBrowse={onBrowse}
              active={focused}
              toolbarTarget={toolbarTarget}
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

function ReviewTabProgress({
  review,
  context,
}: {
  review: ReviewResponse;
  context: ConnectionContext;
}) {
  const selection = useReviewRevisionSelection(review.reviewId ?? '');
  const specsApart = useSpecsApart(context.connection);
  const read = useAtomValue(
    readReview({
      connection: context.connection,
      reviewId: review.reviewId ?? '',
      ...(selection.revision === undefined
        ? {}
        : { revision: selection.revision }),
    }),
  );
  const revision = Option.getOrUndefined(AsyncResult.value(read))?.revision;
  const result = useAtomValue(
    readReviewMarks({
      connection: context.connection,
      reviewId: review.reviewId ?? '',
    }),
  );
  const marks = Option.getOrUndefined(AsyncResult.value(result));
  const reviewed = revision
    ? revisionDecisionProgress(revision, marks, {
        specsApart,
      }).reviewed
    : 0;
  return (
    <span
      aria-hidden="true"
      className="text-2xs text-muted-foreground tabular-nums"
    >
      {reviewed}/{revision?.content.layers.length ?? review.layers.length}
    </span>
  );
}
