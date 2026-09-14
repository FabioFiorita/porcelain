import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from '@tanstack/react-hotkeys';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PanelRightIcon, LayersIcon as ReviewLayersIcon } from 'lucide-react';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import { cn } from '@/lib/utils';
import { entryKey, parseEntry } from '../../domain/documents';
import type { Project } from '../../domain/inventory';
import type { Artifact, Layers, Surface } from '../../domain/review';
import { useArtifactsOverview, useReviewOverview } from '../../query/review';
import { SHORTCUTS } from '../workspace/shortcuts';
import { DocumentTabs } from './document-tabs';
import { DocumentView, type OpenDocument } from './documents';
import { GitButton } from './git-button';
import { ReviewBoundary } from './review-boundary';
import { ReviewSidebar } from './review-sidebar';
import { type PaneIndex, useTabLayout } from './use-tab-layout';

type Worktree = Project['worktrees'][number];
const desktopReviewQuery = '(min-width: 1280px)';

export function ReviewWorkspace({
  worktree,
  projectId,
  navigationTrigger,
}: {
  worktree: Worktree;
  projectId: string;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
}) {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(desktopReviewQuery).matches,
  );
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

  useEffect(() => {
    const media = window.matchMedia(desktopReviewQuery);
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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

  const open = useCallback<OpenDocument>(
    (ref) => {
      const key = entryKey(ref);
      void navigate({
        search: (previous) =>
          focusedPane === 1
            ? { ...previous, side: key }
            : { ...previous, entry: key },
      });
      setMobileOpen(false);
    },
    [focusedPane, navigate],
  );
  const setSurface = useCallback(
    (next: Surface) => {
      // Documents span surfaces. Switching the index must not erase the open tab.
      void navigate({
        search: (previous) => ({ ...previous, surface: next }),
      });
    },
    [navigate],
  );
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
      worktreePath={worktree.path}
      surface={surface}
      activeEntry={focusedPane === 1 ? search.side : search.entry}
      available={worktree.available}
      onSurface={setSurface}
      onOpen={open}
    />
  );

  const tabControls = (
    <>
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
          className="w-[min(90vw,22rem)]! gap-0"
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
      <GitButton scope={scope} />
    </>
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="review-document" minSize={480}>
        <section
          aria-label="Review content"
          className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
        >
          <ReviewBoundary>
            <DocumentArea
              scope={scope}
              worktreeId={worktree.id}
              entry={search.entry}
              side={search.side}
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
  );
}

function DocumentArea({
  scope,
  worktreeId,
  entry,
  side,
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
  worktreeId: string;
  entry: string | undefined;
  side: string | undefined;
  focused: PaneIndex;
  setFocused: (pane: PaneIndex) => void;
  onOpen: OpenDocument;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  tabControls: ReactNode;
}) {
  const overview = useReviewOverview(scope);
  const artifacts = useArtifactsOverview(scope);
  const layers = overview?.layers.layers ?? [];
  const hasHandoff =
    overview != null &&
    (overview.status.changes.length > 0 || layers.length > 0);
  const layout = useTabLayout({
    worktreeId,
    entry,
    side,
    fallback: hasHandoff ? entryKey({ kind: 'handoff' }) : null,
    focused,
    setFocused,
  });

  const paneProps = (index: PaneIndex) => ({
    index,
    layout,
    split: layout.split,
    focused: focused === index,
    setFocused,
    scope,
    layers,
    artifacts,
    hasHandoff,
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
  index,
  layout,
  split,
  focused,
  setFocused,
  scope,
  layers,
  artifacts,
  hasHandoff,
  onOpen,
  navigationTrigger,
  navigatorIsMobile,
  navigatorOpen,
  navigatorOpenMobile,
  tabControls,
}: {
  index: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
  setFocused: (pane: PaneIndex) => void;
  scope: { projectId: string; worktreeId: string };
  layers: Layers['layers'];
  artifacts: readonly Artifact[];
  hasHandoff: boolean;
  onOpen: OpenDocument;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
  navigatorIsMobile: boolean;
  navigatorOpen: boolean;
  navigatorOpenMobile: boolean;
  tabControls: ReactNode;
}) {
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  const document = parseEntry(pane.active ?? undefined);
  useHotkey(SHORTCUTS.nextTab, () => layout.step(index, 1), {
    ignoreInputs: true,
    enabled: focused,
  });
  useHotkey(SHORTCUTS.previousTab, () => layout.step(index, -1), {
    ignoreInputs: true,
    enabled: focused,
  });
  useHotkey(
    SHORTCUTS.closeTab,
    () => pane.active != null && layout.close(index, pane.active),
    { ignoreInputs: true, enabled: focused },
  );
  useHotkey(
    SHORTCUTS.openToSide,
    () => pane.active != null && layout.openToSide(index, pane.active),
    { ignoreInputs: true, enabled: focused },
  );

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
        artifacts={artifacts}
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
            <DocumentView scope={scope} document={document} onOpen={onOpen} />
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
