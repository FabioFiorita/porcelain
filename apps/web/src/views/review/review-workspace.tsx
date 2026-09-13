import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { GitBranchIcon, PanelRightIcon, RefreshCwIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
  SheetTrigger,
} from '@/components/ui/sheet';
import { type Project, worktreeLabel } from '../../domain/inventory';
import type { Surface } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import { useRefreshReview } from '../../query/review';
import { WorkspaceControls } from '../workspace/workspace-controls';
import { ReviewBoundary } from './review-boundary';
import { ReviewInspection } from './review-inspection';
import { ReviewSidebar } from './review-sidebar';

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
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(
    () => window.matchMedia(desktopReviewQuery).matches,
  );
  const desktopTrigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia(desktopReviewQuery);
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const toggleDesktop = () => {
    if (open) desktopTrigger.current?.focus();
    setOpen(!open);
  };
  useHotkey(
    'Alt+Shift+R',
    () => {
      if (desktop) toggleDesktop();
      else setMobileOpen((current) => !current);
    },
    { ignoreInputs: true },
  );
  const surface = search.surface ?? 'changes';
  const entry = search.entry ?? '';
  const scope = { projectId, worktreeId: worktree.id };
  const refresh = useRefreshReview(scope);
  const openGitActions = () => {
    void navigate({ search: { worktree: worktree.id, surface: 'git' } });
    if (desktop) setOpen(true);
    else setMobileOpen(true);
  };
  const sidebarProps = {
    scope,
    surface,
    entry,
    available: worktree.available,
    onSurface: (surface: Surface) => {
      void navigate({ search: { worktree: worktree.id, surface } });
    },
    onSelect: (entry: string) => {
      void navigate({ search: { worktree: worktree.id, surface, entry } });
      setMobileOpen(false);
    },
  };
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="review-document" minSize={480}>
        <section
          aria-label="Review content"
          className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
        >
          <WorkspaceControls navigationTrigger={navigationTrigger}>
            <GitBranchIcon className="mx-1 hidden size-4 shrink-0 text-muted-foreground sm:block" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">
                {worktreeLabel(worktree.branch)}
              </h2>
              <p
                className="truncate text-xs text-muted-foreground"
                title={worktree.path}
              >
                {worktree.path}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh review"
              disabled={refresh.isPending}
              onClick={() => discardRejection(refresh.submit())}
            >
              <RefreshCwIcon />
            </Button>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {worktree.available ? 'Available' : 'Unavailable'}
            </Badge>
            <Button
              variant={surface === 'git' ? 'secondary' : 'outline'}
              size="sm"
              aria-label="Git actions"
              aria-pressed={surface === 'git'}
              onClick={openGitActions}
            >
              <GitBranchIcon />
              Git
            </Button>
            <Button
              ref={desktopTrigger}
              className="hidden xl:inline-flex"
              variant="ghost"
              size="icon-sm"
              aria-label={open ? 'Hide review sidebar' : 'Show review sidebar'}
              aria-expanded={open}
              aria-keyshortcuts="Alt+Shift+R"
              title={`Toggle review sidebar (${formatForDisplay('Alt+Shift+R')})`}
              onClick={toggleDesktop}
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
                    aria-keyshortcuts="Alt+Shift+R"
                    title={`Toggle review sidebar (${formatForDisplay('Alt+Shift+R')})`}
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
                    Choose a review surface and entry.
                  </SheetDescription>
                </SheetHeader>
                <ReviewSidebar
                  {...sidebarProps}
                  onClose={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </WorkspaceControls>
          <div className="min-h-0 flex-1 overflow-auto border-t bg-background">
            <ReviewBoundary key={`${worktree.id}:${surface}:${entry}`}>
              <ReviewInspection
                scope={scope}
                surface={surface}
                entry={entry}
                available={worktree.available}
              />
            </ReviewBoundary>
          </div>
        </section>
      </ResizablePanel>
      {open && desktop && (
        <>
          <ResizableHandle className="w-2 bg-transparent after:w-2" />
          <ResizablePanel
            id="review-sidebar"
            defaultSize={320}
            minSize={260}
            maxSize={520}
          >
            <div className="workspace-glass h-full overflow-hidden rounded-xl border">
              <ReviewSidebar {...sidebarProps} onClose={toggleDesktop} />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
