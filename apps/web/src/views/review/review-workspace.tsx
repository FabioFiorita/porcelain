import { useNavigate, useSearch } from '@tanstack/react-router';
import { GitBranchIcon, PanelRightIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
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
import { type Project, worktreeLabel } from '../../domain/inventory';
import type { Surface } from '../../domain/review';
import { useRefreshReview } from '../../query/review';
import { ReviewBoundary } from './review-boundary';
import { ReviewInspection } from './review-inspection';
import { ReviewSidebar } from './review-sidebar';

type Worktree = Project['worktrees'][number];
export function ReviewWorkspace({
  worktree,
  projectId,
}: {
  worktree: Worktree;
  projectId: string;
}) {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <section
        aria-label="Review content"
        className="flex min-w-0 flex-1 flex-col"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b px-5">
          <GitBranchIcon className="size-4 shrink-0 text-muted-foreground" />
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
            onClick={() => void refresh.submit().catch(() => undefined)}
          >
            <RefreshCwIcon />
          </Button>
          <Badge variant="outline">
            {worktree.available ? 'Available' : 'Unavailable'}
          </Badge>
          <Button
            className="hidden xl:inline-flex"
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Hide review sidebar' : 'Show review sidebar'}
            onClick={() => setOpen(!open)}
          >
            <PanelRightIcon />
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="xl:hidden" />
              }
            >
              <PanelRightIcon />
              Review
            </SheetTrigger>
            <SheetContent
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
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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
        <div className="hidden w-80 shrink-0 border-l xl:block">
          <ReviewSidebar {...sidebarProps} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
