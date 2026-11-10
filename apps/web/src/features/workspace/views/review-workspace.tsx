import type { ComponentType } from 'react';
import type { DocumentProps, StepDocumentProps } from './documents';
import type { ReviewIndexProps } from './review-index';

import { StateSkeleton } from '@/shared/views/state-notice';
import { type ReviewTitle } from '../rules/documents';
import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import { AsyncResult } from 'effect/reactivity';
import { Cause, Option } from 'effect';
import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { PanelRightIcon } from 'lucide-react';
import {
  type ReactNode,
  type SyntheticEvent,
  useDeferredValue,
  useState,
} from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';

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
  ChangeScope,
} from '@/shared/workspace/search';
import { useDesktopReview } from '../adapters/desktop-review';
import {
  type PaneIndex,
  useTabLayout,
  paneTabActions,
} from '../adapters/tab-layout';
import { useReviewPanelOpen, useTabLayoutStore } from '../store';
import {
  anchorBase,
  type RevealComment,
} from '@porcelain/client/reviews/rules';
import { entryKey, type OpenDocument, parseEntry } from '../rules/documents';
import { openToSideText } from '../rules/tab-strip';

import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';

import { ChangeScopeSwitch } from './change-scope-switch';
import { BranchBasePicker } from './branch-base-picker';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar, SURFACES, surfaceNames } from './review-sidebar';
import { SideRail } from './side-rail';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { FilesQuickOpen } from '@/features/files/index';

type Worktree = Project['worktrees'][number];

export type FirstDocument = {
  title: ReviewTitle | undefined;
  pending: boolean;
  guided: boolean;
  companion: boolean;
};

type ReviewContentProps = {
  walkthrough: ComponentType<DocumentProps>;
  changesNavigation: ComponentType<ReviewIndexProps>;
  stepDocument: ComponentType<StepDocumentProps>;
  firstDocument: FirstDocument;
};

export type ReviewWorkspaceProps = {
  worktree: Worktree;
  projectId: string;
  context: ConnectionContext;
  search: WorkspaceSearch;
  onSearch: SetWorkspaceSearch;
  navigationTrigger: ElementTarget<HTMLButtonElement>;
} & ReviewContentProps;

export function ReviewWorkspace({
  worktree,
  projectId,
  search,
  onSearch,
  context,
  navigationTrigger,
  walkthrough,
  changesNavigation,
  stepDocument,
  firstDocument,
}: ReviewWorkspaceProps) {
  const { open: panelOpen, setOpen: setPanelOpen } = useReviewPanelOpen();
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktop = useDesktopReview();
  const [docked, setDocked] = useState(desktop);
  if (docked !== desktop) {
    setDocked(desktop);
    if (desktop && mobileOpen) {
      setPanelOpen(true);
      setMobileOpen(false);
    }
  }
  const railToggle = useElement<HTMLButtonElement>();
  const mobileTrigger = useElement<HTMLButtonElement>();
  const mobileSheet = useElement<HTMLDivElement>();
  const {
    isMobile: navigatorIsMobile,
    open: navigatorOpen,
    openMobile: navigatorOpenMobile,
  } = useSidebar();
  const surface =
    search.surface ?? (firstDocument.guided ? 'changes' : 'files');
  const scope = { projectId, worktreeId: worktree.id };
  const {
    saved,
    focused: focusedPane,
    setFocused: setFocusedPane,
  } = useTabLayoutStore(worktree.id);
  const overview = useReviewOverview(scope, context.connection);
  const awaitingChanges = Option.isNone(AsyncResult.value(overview));
  const needsDefault =
    !saved && !parseEntry(search.entry) && !parseEntry(search.side);
  const ready = !needsDefault || (!awaitingChanges && !firstDocument.pending);
  const firstEntry =
    firstDocument.title === 'Walkthrough' ? 'walkthrough' : 'handoff';
  const defaultEntry =
    firstDocument.title === 'Walkthrough' ||
    (Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0) >
      0
      ? firstEntry
      : null;
  const layout = useTabLayout({
    firstDocument: firstEntry,
    companion: firstDocument.companion,
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
    const pane = options?.toSide
      ? otherPane
      : layout.open(
          focusedPane,
          key,
          options?.preserveFocus === true && desktop,
        );
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
  useHotkey(SHORTCUTS.surfaceChanges, () => showSurface('changes'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceFiles, () => showSurface('files'), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceHistory, () => showSurface('history'), {
    ignoreInputs: true,
  });
  const browseTrigger = useElement<HTMLButtonElement>();
  const browse = (
    next: 'changes' | 'files' | 'history',
    trigger: HTMLButtonElement,
  ) => {
    browseTrigger.attach(trigger);
    showSurface(next);
  };
  const changes: PaneContext['changes'] = {
    scope: search.scope ?? (firstDocument.guided ? 'branch' : 'uncommitted'),
    onScope: (next) =>
      onSearch({
        scope: firstDocument.guided || next === 'branch' ? next : undefined,
      }),
    onBase: (next) => onSearch({ base: next }),
  };
  const activeEntry = layout.panes[focusedPane]?.active ?? undefined;
  const sidebar = (layout: 'docked' | 'sheet') => (
    <ReviewSidebar
      changesNavigation={changesNavigation}
      guided={firstDocument.title === 'Walkthrough'}
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
        ...changes,
        base: search.base,
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
            <Button
              variant="ghost"
              size="icon-sm"
              ref={(element) => mobileTrigger.attach(element)}
              className="xl:hidden"
              aria-label="Review"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen && !desktop}
              aria-keyshortcuts={SHORTCUTS.toggleSidebar}
              onClick={() => {
                browseTrigger.attach(null);
                layout.selectPane(pane);
                setMobileOpen(true);
              }}
            >
              <PanelRightIcon />
            </Button>
          }
        />
        <TooltipContent role="tooltip" className="break-all">
          Review <Kbd>{formatForDisplay(SHORTCUTS.toggleSidebar)}</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <>
      <FilesQuickOpen
        bindPopup={layout.bindQuickOpen}
        openFiles={layout.recentFiles}
        scope={scope}
        connection={context.connection}
        onOpen={(path) => open({ kind: 'file', path })}
      />
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
                walkthrough={walkthrough}
                stepDocument={stepDocument}
                firstDocument={firstDocument}
                changesNavigation={changesNavigation}
                reveal={reveal}
                scope={scope}
                context={context}
                overview={overview}
                needsDefault={needsDefault}
                layout={layout}
                base={search.base}
                changes={changes}
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
              <ResizableHandle
                aria-label="Document panes and side panel"
                className="w-2 bg-transparent after:w-2"
              />
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
            names={surfaceNames()}
            published={false}
            surface={surface}
            open={panelOpen}
            onSelect={showSurface}
            onHide={() => setPanelOpen(false)}
            onToggle={toggleSidebar}
            toggleRef={(element) => railToggle.attach(element)}
          />
        )}
      </div>
      <Sheet
        open={mobileOpen && !desktop}
        onOpenChange={setMobileOpen}
        onOpenChangeComplete={(open) => {
          if (!open) layout.focusDestination();
        }}
      >
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
    </>
  );
}

type PaneContext = ReviewContentProps & {
  scope: { projectId: string; worktreeId: string };
  context: ConnectionContext;
  base: string | undefined;
  changes: {
    scope: ChangeScope;
    onScope: (scope: ChangeScope) => void;
    onBase: (base: string | undefined) => void;
  };
  onOpen: OpenDocument;
  onBrowse: (
    surface: 'changes' | 'files' | 'history',
    trigger: HTMLButtonElement,
  ) => void;
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
  needsDefault: boolean;
};

function DocumentArea(props: DocumentAreaProps) {
  const awaitingChanges = Option.isNone(AsyncResult.value(props.overview));
  if (
    props.needsDefault &&
    awaitingChanges &&
    AsyncResult.isFailure(props.overview)
  )
    throw Cause.squash(props.overview.cause);
  if (props.needsDefault && (awaitingChanges || props.firstDocument.pending)) {
    return <StateSkeleton label="Loading review" />;
  }
  return <DocumentPanes {...props} />;
}

function DocumentPanes({
  overview,
  walkthrough,
  changesNavigation,
  stepDocument,
  firstDocument,
  layout,
  reveal,
  scope,
  context,
  base,
  changes,
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
    walkthrough,
    changesNavigation,
    stepDocument,
    firstDocument,
    reveal,
    index,
    changeCount:
      Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0,
    layout,
    split: layout.split,
    focused: focused === index,
    scope,
    context,
    base,
    changes,
    onOpen,
    onBrowse,
    navigationTrigger,
    navigatorIsMobile,
    navigatorOpen,
    navigatorOpenMobile,
    tabControls,
  });

  return (
    <ResizablePanelGroup
      orientation={navigatorIsMobile ? 'vertical' : 'horizontal'}
      className="min-h-0 flex-1"
    >
      <ResizablePanel id="pane-left" minSize={navigatorIsMobile ? 200 : 320}>
        <PaneView {...paneProps(0)} />
      </ResizablePanel>
      {layout.split && (
        <>
          <ResizableHandle
            aria-label={
              navigatorIsMobile
                ? 'Top and bottom document panes'
                : 'Left and right document panes'
            }
            withHandle
          />
          <ResizablePanel
            id="pane-right"
            minSize={navigatorIsMobile ? 200 : 320}
          >
            <PaneView {...paneProps(1)} />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

function paneSide(split: boolean, index: PaneIndex): 'left' | 'right' | null {
  if (!split) return null;
  return index === 0 ? 'left' : 'right';
}

function PaneView({
  changeCount,
  walkthrough,
  stepDocument,
  firstDocument,
  reveal,
  index,
  layout,
  split,
  focused,
  scope,
  context,
  base,
  changes,
  onOpen,
  onBrowse,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: PaneContext & {
  index: PaneIndex;
  changeCount: number;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
}) {
  const { element: toolbarTarget, attach: setToolbarTarget } =
    useElement<HTMLDivElement>();
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  const deferredEntry = useDeferredValue(pane.active);
  const shownEntry =
    pane.active !== 'handoff' && pane.tabs.includes(deferredEntry ?? '')
      ? deferredEntry
      : pane.active;
  const pending = shownEntry !== pane.active;
  const activeDocument = parseEntry(shownEntry ?? undefined);
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
      aria-busy={pending}
      onPointerDownCapture={focusPane}
      onFocusCapture={focusPane}
      className={cn(
        '@container/pane relative flex h-full min-h-0 min-w-0 flex-col',
        split && index === 1 && 'border-l',
        index === 1 &&
          'motion-safe:animate-in motion-safe:fade-in-0 duration-150',
      )}
    >
      <DocumentTabs
        changeCount={changeCount}
        commitContext={{ connection: context.connection, scope }}
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
        active={shownEntry}

        side={paneSide(split, index)}
        focused={focused}
        {...paneTabActions(layout, index)}
        trailing={
          <>
            <div
              ref={setToolbarTarget}
              data-pane-controls=""
              role="toolbar"
              aria-label="Document controls"
              className="flex items-center gap-1"
            >
              {activeDocument?.kind === 'handoff' && (
                <ChangeScopeSwitch
                  value={changes.scope}
                  onValueChange={changes.onScope}
                />
              )}
              {(activeDocument?.kind === 'branch' ||
                (activeDocument?.kind === 'handoff' &&
                  changes.scope === 'branch')) &&
                !firstDocument.guided && (
                  <BranchBasePicker
                    scope={scope}
                    connection={context.connection}
                    base={base}
                    onBase={changes.onBase}
                    compact
                  />
                )}
            </div>
            {(!split || index === 1) && tabControls(index)}
          </>
        }
      />
      {activeDocument?.kind === 'branch-file' && !firstDocument.guided && (
        <div
          role="group"
          aria-label="Branch comparison"
          className="flex items-center gap-2 border-b px-3.5 py-2 text-xs text-muted-foreground"
        >
          <span>Branch comparison</span>
          <BranchBasePicker
            scope={scope}
            connection={context.connection}
            base={base}
            onBase={changes.onBase}
            compact
          />
        </div>
      )}
      {pane.tabs
        .filter((key) => key === shownEntry || key === 'walkthrough')
        .map((key) => {
          const ref = parseEntry(key);
          if (!ref) return null;
          const showing = key === shownEntry;
          let shownDocument = ref;
          if (ref.kind === 'handoff')
            shownDocument = {
              kind: changes.scope === 'branch' ? 'branch' : 'all-changes',
            };
          return (
            <div
              key={ref.kind === 'walkthrough' ? 'walkthrough' : 'document'}
              aria-hidden={!showing}
              inert={!showing || pending}
              className={cn(
                'flex min-h-0 flex-1 flex-col overflow-hidden',
                !showing &&
                  'pointer-events-none invisible absolute opacity-0 inset-x-0 top-12 bottom-0',
              )}
            >
              <ReviewBoundary
                documentKey={key}
                connection={context.connection}
                scope={scope}
              >
                <DocumentView
                  walkthrough={walkthrough}
                  stepDocument={stepDocument}
                  changeScope={changes.scope}
                  singleHeader={firstDocument.guided}
                  scope={scope}
                  context={context}
                  document={shownDocument}
                  sideLabel={openToSideText(paneSide(split, index))}
                  base={base}
                  onOpen={onOpen}
                  onBrowse={onBrowse}
                  active={showing && focused && !pending}
                  toolbarTarget={showing && !pending ? toolbarTarget : null}
                  reveal={
                    showing &&
                    reveal?.pane === index &&
                    reveal.key === shownEntry
                      ? reveal
                      : undefined
                  }
                />
              </ReviewBoundary>
            </div>
          );
        })}
    </section>
  );
}
