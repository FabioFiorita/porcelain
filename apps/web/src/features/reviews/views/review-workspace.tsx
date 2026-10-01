import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { PanelRightIcon, LayersIcon as ReviewLayersIcon } from 'lucide-react';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
import type { Project } from '@/features/projects/index';
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
import { anchorBase, type RevealComment } from '../rules/comments';
import { entryKey, type OpenDocument, parseEntry } from '../rules/documents';
import type { ReviewLayer } from '../rules/review';
import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar } from './review-sidebar';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Worktree = Project['worktrees'][number];

export function ReviewWorkspace({
  worktree,
  projectId,
  search,
  onSearch,
  context,
  navigationTrigger,
}: {
  worktree: Worktree;
  projectId: string;
  context: ConnectionContext;
  search: WorkspaceSearch;
  onSearch: SetWorkspaceSearch;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktop = useDesktopReview();
  const [focusedPane, setFocusedPane] = useState<PaneIndex>(0);
  const desktopTrigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const {
    isMobile: navigatorIsMobile,
    open: navigatorOpen,
    openMobile: navigatorOpenMobile,
  } = useSidebar();
  const surface = search.surface ?? 'changes';
  const scope = { projectId, worktreeId: worktree.id };

  const toggleSidebar = () => {
    if (sidebarOpen) desktopTrigger.current?.focus();
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
    setReveal(
      anchor
        ? {
            anchor,
            nonce: Date.now(),
            pane: focusedPane,
            key,
            ...(options?.compose ? { compose: true } : {}),
          }
        : undefined,
    );
    const base = anchor ? anchorBase(anchor) : undefined;
    onSearch({
      ...(focusedPane === 1 ? { side: key } : { entry: key }),
      ...(base === undefined ? {} : { base }),
    });
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
      changes={{
        scope: search.scope ?? 'uncommitted',
        base: search.base,
        onScope: (next) =>
          onSearch({ scope: next === 'branch' ? next : undefined }),
        onBase: (next) => onSearch({ base: next }),
      }}
    />
  );

  const tabControls = (
    <>
      <GitButton scope={scope} context={context} />
      <Button
        ref={desktopTrigger}
        className="hidden xl:inline-flex"
        variant="ghost"
        size="icon-sm"
        aria-label={sidebarOpen ? 'Hide review sidebar' : 'Show review sidebar'}
        aria-expanded={sidebarOpen}
        aria-keyshortcuts={SHORTCUTS.toggleSidebar}
        title={`Toggle review sidebar (${formatForDisplay(SHORTCUTS.toggleSidebar)})`}
        onClick={toggleSidebar}
      >
        <PanelRightIcon />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              ref={mobileTrigger}
              className="xl:hidden"
              aria-label="Review"
              aria-keyshortcuts={SHORTCUTS.toggleSidebar}
              title={`Toggle review sidebar (${formatForDisplay(SHORTCUTS.toggleSidebar)})`}
            />
          }
        >
          <PanelRightIcon />
        </SheetTrigger>
        <SheetContent
          finalFocus={mobileTrigger}
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
    </>
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="review-document" minSize={480}>
        <section
          aria-label="Review content"
          className={cn(
            'flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card',
            sidebarOpen && desktop && 'mr-1',
          )}
        >
          <ReviewBoundary>
            <InterruptedActionNotice scope={scope} context={context} />
            <ConflictGuidance scope={scope} context={context} onOpen={open} />
            <DocumentArea
              reveal={reveal}
              scope={scope}
              context={context}
              worktreeId={worktree.id}
              entry={search.entry}
              side={search.side}
              base={search.base}
              onSearch={onSearch}
              focused={focusedPane}
              setFocused={setFocusedPane}
              onOpen={open}
              navigationTrigger={navigationTrigger}
              navigatorIsMobile={navigatorIsMobile}
              navigatorOpen={navigatorOpen}
              navigatorOpenMobile={navigatorOpenMobile}
              tabControls={tabControls}
            />
          </ReviewBoundary>
        </section>
      </ResizablePanel>
      {sidebarOpen && desktop && (
        <>
          <ResizableHandle />
          <ResizablePanel
            id="review-sidebar"
            defaultSize={320}
            minSize={260}
            maxSize={520}
          >
            <div className="h-full pl-1">{sidebar}</div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

function DocumentArea({
  reveal,
  scope,
  context,
  worktreeId,
  entry,
  side,
  base,
  onSearch,
  focused,
  setFocused,
  onOpen,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: {
  scope: { projectId: string; worktreeId: string };
  context: ConnectionContext;
  worktreeId: string;
  entry: string | undefined;
  side: string | undefined;
  base: string | undefined;
  onSearch: SetWorkspaceSearch;
  focused: PaneIndex;
  setFocused: (pane: PaneIndex) => void;
  onOpen: OpenDocument;
  reveal?: (RevealComment & { pane: PaneIndex; key: string }) | undefined;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  tabControls: ReactNode;
}) {
  const { connection } = context;
  const overview = useReviewOverview(scope, connection);
  const published = usePublishedReview(scope, context);
  const layers = published.data?.active ? published.data.layers : [];
  const hasHandoff =
    Boolean(published.data?.active) ||
    (overview != null && overview.changes.changes.length > 0);
  const layout = useTabLayout({
    worktreeId,
    entry,
    side,
    onSearch,
    fallback: hasHandoff ? entryKey({ kind: 'handoff' }) : null,
    focused,
    setFocused,
  });

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
      focusedPane.active != null && layout.close(focused, focusedPane.active),
    shortcuts,
  );
  useHotkey(
    SHORTCUTS.openToSide,
    () =>
      focusedPane.active != null &&
      layout.openToSide(focused, focusedPane.active),
    shortcuts,
  );

  const paneProps = (index: PaneIndex) => ({
    reveal,
    index,
    layout,
    split: layout.split,
    focused: focused === index,
    setFocused,
    scope,
    context,
    layers,
    hasHandoff,
    base,
    onOpen,
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

function PaneView({
  reveal,
  index,
  layout,
  split,
  focused,
  setFocused,
  scope,
  context,
  layers,
  hasHandoff,
  base,
  onOpen,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: {
  index: PaneIndex;
  base: string | undefined;
  context: ConnectionContext;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
  setFocused: (pane: PaneIndex) => void;
  scope: { projectId: string; worktreeId: string };
  layers: readonly Pick<ReviewLayer, 'id' | 'title'>[];
  hasHandoff: boolean;
  onOpen: OpenDocument;
  reveal?: (RevealComment & { pane: PaneIndex; key: string }) | undefined;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  tabControls: ReactNode;
}) {
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  const document = parseEntry(pane.active ?? undefined);

  return (
    <section
      aria-label={split ? `${index === 0 ? 'Left' : 'Right'} pane` : undefined}
      data-focused={focused}
      onPointerDownCapture={() => setFocused(index)}
      onFocusCapture={() => setFocused(index)}
      className={cn(
        'flex h-full min-h-0 flex-col',
        split && index === 1 && 'border-l',
      )}
    >
      <DocumentTabs
        leading={
          index === 0 ? (
            <SidebarTrigger
              ref={navigationTrigger}
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
                    navigationTrigger.current?.focus(),
                  );
                }
              }}
            />
          ) : undefined
        }
        tabs={pane.tabs}
        pinned={pane.pinned}
        active={pane.active}
        layers={layers}
        side={split ? (index === 0 ? 'left' : 'right') : null}
        focused={focused}
        onActivate={(key) => layout.activate(index, key)}
        onClose={(key) => layout.close(index, key)}
        onCloseOthers={(key) => layout.closeOthers(index, key)}
        onCloseUnpinned={() => layout.closeUnpinned(index)}
        onTogglePin={(key) => layout.togglePin(index, key)}
        onOpenToSide={(key) => layout.openToSide(index, key)}
        trailing={!split || index === 1 ? tabControls : undefined}
      />
      {document == null ? (
        <EmptyDocument hasHandoff={hasHandoff} onOpen={onOpen} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ReviewBoundary key={pane.active}>
            <DocumentView
              scope={scope}
              context={context}
              document={document}
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
  hasHandoff,
  onOpen,
}: {
  hasHandoff: boolean;
  onOpen: OpenDocument;
  reveal?: (RevealComment & { pane: PaneIndex; key: string }) | undefined;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ReviewLayersIcon />
          </EmptyMedia>
          <EmptyTitle>
            {hasHandoff ? 'Nothing open' : 'No changes to review'}
          </EmptyTitle>
          <EmptyDescription>
            {hasHandoff
              ? 'Open the handoff, or choose a file or commit from the right.'
              : 'Browse files or history from the right.'}
          </EmptyDescription>
        </EmptyHeader>
        {hasHandoff && (
          <Button onClick={() => onOpen({ kind: 'handoff' })}>
            Open all changes
          </Button>
        )}
      </Empty>
    </div>
  );
}
