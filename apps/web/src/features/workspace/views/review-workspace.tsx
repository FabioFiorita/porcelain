import { useHotkeysEnabled } from '@/shared/hooks/use-hotkeys-enabled';
import type { ComponentType } from 'react';
import type { DocumentProps, WalkthroughCodeProps } from './documents';
import type { ReviewIndexProps } from './review-index';

import { StateSpinner } from '@/shared/views/state-notice';
import { useElement, type ElementTarget } from '@/shared/hooks/use-element';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
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
  useId,
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
import { TruncatedText } from '@/shared/views/truncated-text';
import { useBranchChanges, useReviewOverview } from '@/features/changes/index';
import { worktreeLabel, type Project } from '@porcelain/client/projects/rules';
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
  entryKey,
  type DocumentFileTarget,
  type OpenDocument,
  parseEntry,
} from '../rules/documents';
import { documentIds, openToSideText, REVIEW_TAB } from '../rules/tab-strip';

import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';

import { BranchBasePicker } from './branch-base-picker';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar, SURFACES, surfaceNames } from './review-sidebar';
import { SideRail } from './side-rail';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { FilesQuickOpen } from '@/features/files/index';

type Worktree = Project['worktrees'][number];

export type FirstDocument = {
  pending: boolean;
  guided: boolean;
};

type ReviewContentProps = {
  review: ComponentType<DocumentProps>;
  changesNavigation: ComponentType<ReviewIndexProps>;
  walkthroughCode: ComponentType<WalkthroughCodeProps>;
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
  review,
  changesNavigation,
  walkthroughCode,
  firstDocument,
}: ReviewWorkspaceProps) {
  const { open: panelOpen, setOpen: setPanelOpen } = useReviewPanelOpen();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sheetReturnsFocus, setSheetReturnsFocus] = useState(true);
  const [sheetWasOpen, setSheetWasOpen] = useState(mobileOpen);
  if (mobileOpen !== sheetWasOpen) {
    setSheetWasOpen(mobileOpen);
    if (mobileOpen) setSheetReturnsFocus(true);
  }
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
  const branchChanges = useBranchChanges(
    firstDocument.guided && search.scope === undefined ? scope : undefined,
    context.connection,
    search.base,
  ).result;
  const onlyUncommitted =
    Option.getOrUndefined(AsyncResult.value(branchChanges))?.files.length ===
      0 &&
    (Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0) >
      0;
  const awaitingChanges = awaitingOverview(overview);
  const needsDefault =
    !saved && !parseEntry(search.entry) && !parseEntry(search.side);
  const ready = !needsDefault || (!awaitingChanges && !firstDocument.pending);
  const defaultEntry =
    firstDocument.guided ||
    (AsyncResult.isFailure(overview) &&
      Option.isNone(AsyncResult.value(overview))) ||
    (Option.getOrUndefined(AsyncResult.value(overview))?.changes.length ?? 0) >
      0
      ? REVIEW_TAB
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

  const [fileTarget, setFileTarget] = useState<
    (DocumentFileTarget & { pane: PaneIndex; key: string }) | undefined
  >();
  const open: OpenDocument = (ref, options) => {
    const key = entryKey(ref);
    const otherPane: PaneIndex = focusedPane === 0 ? 1 : 0;
    const pane = options?.toSide
      ? otherPane
      : layout.open(
          focusedPane,
          key,
          options?.preserveFocus === true && desktop,
        );
    setFileTarget(
      options?.path
        ? {
            path: options.path,
            entry: options.entry,
            nonce: Date.now(),
            pane,
            key,
          }
        : undefined,
    );
    if (options?.toSide) layout.openToSide(focusedPane, key);
    setSheetReturnsFocus(false);
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
  const browseTrigger = useElement<HTMLElement>();
  const browse = (
    next: 'changes' | 'files' | 'history',
    trigger: HTMLElement,
  ) => {
    browseTrigger.attach(trigger);
    showSurface(next);
  };
  const changeScope =
    search.scope ??
    (firstDocument.guided && !onlyUncommitted ? 'branch' : 'uncommitted');
  const changes: PaneContext['changes'] = {
    scope: changeScope,
    baseInPanel:
      desktop && panelOpen && surface === 'changes' && changeScope === 'branch',
    onScope: (next) => onSearch({ scope: next }),
    onBase: (next) => onSearch({ base: next }),
  };
  const activeEntry = layout.panes[focusedPane]?.active ?? undefined;
  const sidebar = (placement: 'docked' | 'sheet') => (
    <ReviewSidebar
      changesNavigation={changesNavigation}
      layout={placement}
      scope={scope}
      context={context}
      worktreePath={worktree.path}
      surface={surface}
      activeEntry={activeEntry}
      available={worktree.available}
      onSurface={setSurface}
      onOpen={open}
      onFilesMoved={(from, to) => layout.moveFiles(from, to)}
      onFilesRemoved={(path) => layout.closeRemovedFiles(path)}
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
              aria-label="Side panel"
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
          Side panel <Kbd>{formatForDisplay(SHORTCUTS.toggleSidebar)}</Kbd>
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
              className="flex h-full min-w-0 flex-col overflow-hidden rounded-paper border bg-card max-md:rounded-none max-md:border-0"
            >
              <InterruptedActionNotice scope={scope} context={context} />
              <ConflictGuidance scope={scope} context={context} onOpen={open} />
              <DocumentArea
                worktreeName={worktreeLabel(worktree.branch)}
                review={review}
                walkthroughCode={walkthroughCode}
                firstDocument={firstDocument}
                changesNavigation={changesNavigation}
                fileTarget={fileTarget}
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
          if (open) return;
          layout.focusDestination();
          if (
            !sheetReturnsFocus &&
            !layout.hasDestinationFocus() &&
            document.activeElement === document.body
          )
            (browseTrigger.element?.isConnected
              ? browseTrigger.element
              : mobileTrigger.element
            )?.focus();
        }}
      >
        <SheetContent
          ref={(element) => {
            mobileSheet.attach(element);
            if (element === null) layout.focusDestination();
          }}
          finalFocus={
            sheetReturnsFocus
              ? () => {
                  if (layout.hasDestinationFocus()) return null;
                  const active = document.activeElement;
                  const stayed =
                    active === document.body ||
                    mobileSheet.element?.contains(active);
                  if (!stayed) return null;
                  return browseTrigger.element?.isConnected
                    ? browseTrigger.element
                    : mobileTrigger.element;
                }
              : 'none'
          }
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
    baseInPanel: boolean;
    onScope: (scope: ChangeScope) => void;
    onBase: (base: string | undefined) => void;
  };
  onOpen: OpenDocument;
  onBrowse: (
    surface: 'changes' | 'files' | 'history',
    trigger: HTMLElement,
  ) => void;
  fileTarget?:
    | (DocumentFileTarget & { pane: PaneIndex; key: string })
    | undefined;
  navigationTrigger: ElementTarget<HTMLButtonElement>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  worktreeName: string;
  tabControls: (pane: PaneIndex) => ReactNode;
};

type DocumentAreaProps = PaneContext & {
  focused: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  overview: ReturnType<typeof useReviewOverview>;
  needsDefault: boolean;
};

function awaitingOverview(overview: DocumentAreaProps['overview']) {
  return (
    Option.isNone(AsyncResult.value(overview)) &&
    !AsyncResult.isFailure(overview)
  );
}

function DocumentArea(props: DocumentAreaProps) {
  const awaitingChanges = awaitingOverview(props.overview);
  if (props.needsDefault && (awaitingChanges || props.firstDocument.pending)) {
    return <StateSpinner label="Loading review" />;
  }
  return <DocumentPanes {...props} />;
}

function DocumentPanes({
  review,
  changesNavigation,
  walkthroughCode,
  firstDocument,
  layout,
  fileTarget,
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
  worktreeName,
  tabControls,
}: DocumentAreaProps) {
  const focusedPane = layout.panes[focused] ?? {
    tabs: [],
    pinned: [],
    active: null,
  };
  const hotkeysEnabled = useHotkeysEnabled();
  const shortcuts = {
    ignoreInputs: true,
    enabled: hotkeysEnabled && (layout.split || focused === 0),
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
    review,
    changesNavigation,
    walkthroughCode,
    firstDocument,
    fileTarget,
    index,
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
    worktreeName,
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
  review,
  walkthroughCode,
  firstDocument,
  fileTarget,
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
  worktreeName,
  tabControls,
}: PaneContext & {
  index: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
}) {
  const { element: toolbarTarget, attach: setToolbarTarget } =
    useElement<HTMLDivElement>();
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  const deferredEntry = useDeferredValue(pane.active);
  const requested = parseEntry(pane.active ?? undefined);
  const shownEntry =
    requested?.kind !== 'file' && pane.tabs.includes(deferredEntry ?? '')
      ? deferredEntry
      : pane.active;
  const pending = shownEntry !== pane.active;
  const paneId = useId();
  const [reviewOpened, setReviewOpened] = useState(false);
  if (!reviewOpened && shownEntry === REVIEW_TAB) setReviewOpened(true);
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
        ids={(key) => documentIds(paneId, key)}
        commitContext={{ connection: context.connection, scope }}
        leading={
          index === 0 ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
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
                  }
                />
                <TooltipContent role="tooltip" className="break-all">
                  Toggle Sidebar{' '}
                  <Kbd>{formatForDisplay(SHORTCUTS.toggleNavigator)}</Kbd>
                </TooltipContent>
              </Tooltip>
              {navigatorIsMobile && pane.tabs.length <= 1 && (
                <TruncatedText
                  className="ml-1 max-w-32 min-w-0 font-mono text-caption text-foreground-2"
                  text={worktreeName}
                />
              )}
            </>
          ) : undefined
        }
        tabs={pane.tabs}
        pinned={pane.pinned}
        active={shownEntry}

        side={paneSide(split, index)}
        {...paneTabActions(layout, index)}
        trailing={
          <>
            <div
              ref={setToolbarTarget}
              data-pane-controls=""
              role="toolbar"
              aria-label="Document controls"
              className="flex items-center gap-1 empty:hidden"
            >
              {activeDocument?.kind === 'branch' &&
                !firstDocument.guided &&
                !changes.baseInPanel && (
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
      {activeDocument?.kind === 'branch-file' &&
        !firstDocument.guided &&
        !changes.baseInPanel && (
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
      {[
        {
          slot: REVIEW_TAB,
          entry:
            reviewOpened && pane.tabs.includes(REVIEW_TAB) ? REVIEW_TAB : null,
        },
        {
          slot: 'document',
          entry: shownEntry === REVIEW_TAB ? null : shownEntry,
        },
      ].map(({ slot, entry }) => {
        const ref = parseEntry(entry ?? undefined);
        const showing = ref !== null && entry === shownEntry;
        const ids = entry ? documentIds(paneId, entry) : undefined;
        return (
          <div
            key={slot}
            role={ref ? 'tabpanel' : undefined}
            id={ids?.panel}
            aria-labelledby={ids?.tab}
            aria-hidden={!showing}
            inert={!showing || pending}
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              !showing &&
                'pointer-events-none invisible absolute opacity-0 inset-x-0 top-12 bottom-0',
            )}
          >
            <ReviewBoundary
              documentKey={entry ?? undefined}
              connection={context.connection}
              scope={scope}
            >
              {ref && (
                <DocumentView
                  review={review}
                  walkthroughCode={walkthroughCode}
                  scope={scope}
                  context={context}
                  document={ref}
                  sideLabel={openToSideText(paneSide(split, index))}
                  base={base}
                  onOpen={onOpen}
                  onBrowse={onBrowse}
                  active={showing && focused && !pending}
                  hidden={!showing}
                  toolbarTarget={showing && !pending ? toolbarTarget : null}
                  fileTarget={
                    showing &&
                    fileTarget?.pane === index &&
                    fileTarget.key === shownEntry
                      ? fileTarget
                      : undefined
                  }
                />
              )}
            </ReviewBoundary>
          </div>
        );
      })}
    </section>
  );
}
