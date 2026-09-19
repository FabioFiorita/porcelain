import { useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
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
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { ReviewResponse } from '../../contracts/review';
import {
  type DocumentRef,
  entryKey,
  parseEntry,
  REVIEW,
} from '../../domain/documents';
import type { Project, Worktree } from '../../domain/inventory';
import { type ReviewScope, SURFACES, type Surface } from '../../domain/review';
import { useChanges, useReview } from '../../query/review';
import { PanelToggle } from '../workspace/panel-toggle';
import { SHORTCUTS } from '../workspace/shortcuts';
import { useMediaQuery, WIDE_QUERY } from '../workspace/use-media-query';
import type { RevealRequest } from './code-document';
import { DocumentTabs } from './document-tabs';
import { ChangeDocument, CommitDocument, FileDocument } from './documents';
import { GitButton } from './git-button';
import { InterruptedActionBanner } from './interrupted-action';
import { LayerDocument } from './layer-document';
import { OverviewDocument } from './overview-document';
import { ReviewBoundary, ReviewPending } from './review-boundary';
import { ReviewSidebar } from './review-sidebar';
import { UnexplainedDocument } from './unexplained-document';
import { type PaneIndex, useTabLayout } from './use-tab-layout';

export type OpenDocument = (
  ref: DocumentRef,
  reveal?: Omit<RevealRequest, 'nonce'>,
) => void;

/** A jump to some lines, for the one document it opened (its entry key). */
type PendingReveal = RevealRequest & { entry: string };

/** An entry in its current spelling (an old `handoff` link reads `review`), for highlighting the sidebar. */
const currentKey = (value: string | undefined) => {
  const ref = parseEntry(value);
  return ref == null ? undefined : entryKey(ref);
};

type Props = {
  project: Project;
  worktree: Worktree;
  surface: Surface;
  entry: string | undefined;
  side: string | undefined;
  /** At phone width the document is the only column. */
  phone: boolean;
  /** Shows or hides the projects navigator; it leads the first pane's tabs. */
  navigatorToggle: ReactNode;
  /** Whether the sidebar shows as a column on a wide window; kept by the workspace across worktrees. */
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  handleClassName: string;
};

/**
 * The centre document column (one pane or two) and the right sidebar for one worktree.
 * Below 1280px the sidebar is a slide-over with its own open state (as in apps/web), so
 * the column's shown or hidden choice is still there when the window widens again.
 */
export function ReviewWorkspace({
  project,
  worktree,
  surface,
  entry,
  side,
  phone,
  navigatorToggle,
  sidebarOpen,
  onSidebarOpenChange,
  handleClassName,
}: Props) {
  const scope = useMemo<ReviewScope>(
    () => ({ projectId: project.id, worktreeId: worktree.id }),
    [project.id, worktree.id],
  );
  const navigate = useNavigate({ from: '/' });
  const [reveal, setReveal] = useState<PendingReveal | null>(null);
  // Which pane the sidebar opens things into. The right pane only exists while split.
  const [focusedPane, setFocusedPane] = useState<PaneIndex>(0);
  const wide = useMediaQuery(WIDE_QUERY);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  // A slide-over starts closed each time the window narrows (state adjusted while rendering).
  const [wasWide, setWasWide] = useState(wide);
  if (wide !== wasWide) {
    setWasWide(wide);
    setSlideOverOpen(false);
  }
  const sidebarToggle = useRef<HTMLButtonElement>(null);

  const open = useCallback<OpenDocument>(
    (ref, revealAt) => {
      const key = entryKey(ref);
      void navigate({
        search: (previous) =>
          focusedPane === 1
            ? { ...previous, side: key }
            : { ...previous, entry: key },
      });
      setReveal(
        revealAt == null
          ? null
          : { ...revealAt, nonce: Date.now(), entry: key },
      );
      // The slide-over covers the document it just opened.
      setSlideOverOpen(false);
    },
    [navigate, focusedPane],
  );

  const toggleSidebar = () => {
    if (!wide) {
      setSlideOverOpen((current) => !current);
      return;
    }
    // Hidden by shortcut, the sidebar could take focus with it; the toggle keeps it.
    if (sidebarOpen) sidebarToggle.current?.focus();
    onSidebarOpenChange(!sidebarOpen);
  };
  useHotkey(SHORTCUTS.toggleSidebar, toggleSidebar, { ignoreInputs: true });

  // Unlike apps/web, changing surface keeps `entry`: tabs span every surface.
  const setSurface = useCallback(
    (next: Surface) =>
      void navigate({ search: (previous) => ({ ...previous, surface: next }) }),
    [navigate],
  );

  useHotkey(SHORTCUTS.surfaceReview, () => setSurface(SURFACES[0]), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceFiles, () => setSurface(SURFACES[1]), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.surfaceHistory, () => setSurface(SURFACES[2]), {
    ignoreInputs: true,
  });

  const sidebar = (
    <ReviewSidebar
      scope={scope}
      worktree={worktree}
      surface={surface}
      onSurface={setSurface}
      activeEntry={currentKey(focusedPane === 1 ? side : entry)}
      onOpen={open}
    />
  );

  return (
    <>
      <ResizablePanel id="document" minSize={phone ? 0 : 480}>
        <main className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
          {/* A Git action a server restart cut off, shown once; its own boundary so it never blanks the documents. */}
          <ReviewBoundary fallback={null}>
            <InterruptedActionBanner scope={scope} />
          </ReviewBoundary>
          <ReviewBoundary fallback={<ReviewPending rows={12} />}>
            <DocumentArea
              scope={scope}
              worktreeId={worktree.id}
              entry={entry}
              side={side}
              focused={focusedPane}
              setFocused={setFocusedPane}
              onOpen={open}
              reveal={reveal}
              clearReveal={() => setReveal(null)}
              phone={phone}
              navigatorToggle={navigatorToggle}
              sidebarToggle={
                <PanelToggle
                  ref={sidebarToggle}
                  side="right"
                  label="Review sidebar"
                  expanded={wide ? sidebarOpen : slideOverOpen}
                  overlay={!wide}
                  shortcut={SHORTCUTS.toggleSidebar}
                  onToggle={toggleSidebar}
                />
              }
            />
          </ReviewBoundary>
        </main>
      </ResizablePanel>
      {wide && sidebarOpen && (
        <>
          <ResizableHandle className={handleClassName} />
          <ResizablePanel
            id="sidebar"
            defaultSize={320}
            minSize={260}
            maxSize={520}
          >
            {sidebar}
          </ResizablePanel>
        </>
      )}
      {!wide && (
        <Sheet open={slideOverOpen} onOpenChange={setSlideOverOpen}>
          <SheetContent
            finalFocus={sidebarToggle}
            showCloseButton={false}
            className="w-[min(90vw,22rem)]! gap-0 bg-transparent p-2 shadow-none data-[side=right]:border-l-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Review sidebar</SheetTitle>
              <SheetDescription>
                Pick a surface and open a document.
              </SheetDescription>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}
    </>
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
  reveal,
  clearReveal,
  phone,
  navigatorToggle,
  sidebarToggle,
}: {
  scope: ReviewScope;
  worktreeId: string;
  entry: string | undefined;
  side: string | undefined;
  focused: PaneIndex;
  setFocused: (pane: PaneIndex) => void;
  onOpen: OpenDocument;
  reveal: PendingReveal | null;
  clearReveal: () => void;
  phone: boolean;
  navigatorToggle: ReactNode;
  sidebarToggle: ReactNode;
}) {
  const { changes } = useChanges(scope);
  const review = useReview(scope);
  // Something to review: the agent's review, or at least one change.
  const hasOverview = review != null || changes.length > 0;
  const layout = useTabLayout({
    worktreeId,
    entry,
    side,
    fallback: hasOverview ? entryKey(REVIEW) : null,
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
    review,
    hasOverview,
    onOpen,
    reveal: focused === index ? reveal : null,
    clearReveal,
    navigatorToggle,
    sidebarToggle,
  });

  if (!layout.split) return <PaneView {...paneProps(0)} />;
  // Two panes do not fit a phone: it shows the focused one with the whole tab strip, and
  // the split is back on a wider window. Opening a tab to the side switches between them.
  if (phone) return <PaneView {...paneProps(focused)} split={false} />;

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
  review,
  hasOverview,
  onOpen,
  reveal,
  clearReveal,
  navigatorToggle,
  sidebarToggle,
}: {
  index: PaneIndex;
  layout: ReturnType<typeof useTabLayout>;
  split: boolean;
  focused: boolean;
  setFocused: (pane: PaneIndex) => void;
  scope: ReviewScope;
  review: ReviewResponse | null;
  hasOverview: boolean;
  onOpen: OpenDocument;
  reveal: PendingReveal | null;
  clearReveal: () => void;
  navigatorToggle: ReactNode;
  sidebarToggle: ReactNode;
}) {
  const pane = layout.panes[index] ?? { tabs: [], pinned: [], active: null };
  // The jump is for the document it opened. Moving to another tab drops it, so coming
  // back shows the document as you left it, not the jump again.
  const shownReveal = reveal?.entry === pane.active ? reveal : null;
  const moveTo = (move: () => void) => {
    clearReveal();
    move();
  };
  const ref = parseEntry(pane.active ?? undefined);
  const enabled = { ignoreInputs: true, enabled: focused };

  useHotkey(
    SHORTCUTS.nextTab,
    () => moveTo(() => layout.step(index, 1)),
    enabled,
  );
  useHotkey(
    SHORTCUTS.previousTab,
    () => moveTo(() => layout.step(index, -1)),
    enabled,
  );
  useHotkey(
    SHORTCUTS.closeTab,
    () => pane.active != null && layout.close(index, pane.active),
    enabled,
  );
  useHotkey(
    SHORTCUTS.openToSide,
    () => pane.active != null && layout.openToSide(index, pane.active),
    enabled,
  );

  return (
    <section
      aria-label={split ? `${index === 0 ? 'Left' : 'Right'} pane` : undefined}
      data-focused={focused}
      // Any click inside a pane makes it the one the sidebar and shortcuts act on.
      onPointerDownCapture={() => setFocused(index)}
      className={cn(
        'flex h-full min-h-0 flex-col',
        split && index === 1 && 'border-l',
      )}
    >
      <DocumentTabs
        tabs={pane.tabs}
        pinned={pane.pinned}
        active={pane.active}
        review={review}
        side={split ? (index === 0 ? 'left' : 'right') : null}
        focused={focused}
        onActivate={(key) => moveTo(() => layout.activate(index, key))}
        onClose={(key) => layout.close(index, key)}
        onCloseOthers={(key) => layout.closeOthers(index, key)}
        onCloseUnpinned={() => layout.closeUnpinned(index)}
        onTogglePin={(key) => layout.togglePin(index, key)}
        onOpenToSide={(key) => layout.openToSide(index, key)}
        // The panel toggles sit on the side of the panel they show, as in apps/web.
        leading={!split || index === 0 ? navigatorToggle : undefined}
        // One Git button for the worktree: in the only pane, or the right one when split.
        // Its own boundary, so a slow or failed status never takes the tabs with it.
        trailing={
          !split || index === 1 ? (
            <>
              <ReviewBoundary fallback={null}>
                <GitButton scope={scope} onOpen={onOpen} />
              </ReviewBoundary>
              {sidebarToggle}
            </>
          ) : undefined
        }
      />
      {ref == null ? (
        <div className="grid flex-1 place-items-center p-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Layers className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>
                {hasOverview ? 'Nothing open' : 'No changes to review'}
              </EmptyTitle>
              <EmptyDescription>
                {hasOverview
                  ? review != null
                    ? 'Open the review, or pick a layer, file or commit on the right.'
                    : 'Open all changes, or pick a file or commit on the right.'
                  : 'This worktree matches its last commit. Browse its files or history on the right.'}
              </EmptyDescription>
            </EmptyHeader>
            {hasOverview && (
              <EmptyContent>
                <Button onClick={() => onOpen(REVIEW)}>
                  {review != null ? 'Open the review' : 'Open all changes'}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      ) : (
        <ReviewBoundary
          key={pane.active}
          fallback={<ReviewPending rows={14} />}
        >
          <DocumentView
            scope={scope}
            document={ref}
            onOpen={onOpen}
            reveal={shownReveal}
            active={focused}
          />
        </ReviewBoundary>
      )}
    </section>
  );
}

function DocumentView({
  scope,
  document,
  onOpen,
  reveal,
  active,
}: {
  scope: ReviewScope;
  document: DocumentRef;
  onOpen: OpenDocument;
  reveal: RevealRequest | null;
  active: boolean;
}) {
  const props = { scope, onOpen, reveal, active };
  switch (document.kind) {
    case 'review':
      return <OverviewDocument {...props} />;
    case 'layer':
      return <LayerDocument {...props} layerId={document.layerId} />;
    case 'unexplained':
      return <UnexplainedDocument {...props} />;
    case 'change':
      return <ChangeDocument {...props} path={document.path} />;
    case 'file':
      return <FileDocument {...props} path={document.path} />;
    case 'commit':
      return <CommitDocument {...props} oid={document.oid} />;
  }
}
