import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { GitBranchIcon, PanelRightIcon, RefreshCwIcon } from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Sidebar } from '@/components/ui/sidebar';
import { type Project, worktreeLabel } from '../../domain/inventory';
import type { Surface } from '../../domain/review';
import { discardRejection } from '../../lib/submit-form';
import { useRefreshReview } from '../../query/review';
import { WorkspaceControls } from '../workspace/workspace-controls';
import { ReviewBoundary } from './review-boundary';
import { ReviewInspection } from './review-inspection';
import { ReviewSidebar } from './review-sidebar';

type Worktree = Project['worktrees'][number];
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
  const desktopTrigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const toggleDesktop = () => {
    if (open) desktopTrigger.current?.focus();
    setOpen(!open);
  };
  useHotkey(
    'Alt+Shift+R',
    () => {
      if (window.matchMedia('(min-width: 1280px)').matches) toggleDesktop();
      else setMobileOpen((current) => !current);
    },
    { ignoreInputs: true },
  );
  const surface = search.surface ?? 'changes';
  const entry = search.entry ?? '';
  const scope = { projectId, worktreeId: worktree.id };
  const refresh = useRefreshReview(scope);
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
    <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
      <section
        aria-label="Review content"
        className="flex min-w-0 flex-1 flex-col gap-2"
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
        <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-background">
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
      {open && (
        <Sidebar
          collapsible="none"
          side="right"
          variant="floating"
          className="workspace-glass hidden w-80! shrink-0 overflow-hidden rounded-xl xl:flex"
        >
          <ReviewSidebar {...sidebarProps} onClose={toggleDesktop} />
        </Sidebar>
      )}
    </div>
  );
}
