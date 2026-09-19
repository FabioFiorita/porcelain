import {
  FileDiff,
  FolderTree,
  History as HistoryIcon,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Worktree } from '../../domain/inventory';
import {
  type ReviewScope,
  SURFACE_LABELS,
  SURFACES,
  type Surface,
} from '../../domain/review';
import { useHasReview } from '../../query/review';
import { FilesSurface } from './files-surface';
import { HistorySurface } from './history-surface';
import { ReviewBoundary } from './review-boundary';
import { ReviewIndex } from './review-index';
import type { OpenDocument } from './review-workspace';

type Props = {
  scope: ReviewScope;
  worktree: Worktree;
  surface: Surface;
  onSurface: (surface: Surface) => void;
  activeEntry: string | undefined;
  onOpen: OpenDocument;
};

const SURFACE_ICONS: Record<Surface, LucideIcon> = {
  changes: ListChecks,
  files: FolderTree,
  history: HistoryIcon,
};

/**
 * The first surface is only a review once the agent has published one. Until
 * then, and while the review loads, it is plain Changes.
 */
function ChangesSurfaceLabel({ scope }: { scope: ReviewScope }) {
  const review = useHasReview(scope) === true;
  const Icon = review ? ListChecks : FileDiff;
  return (
    <>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{review ? 'Review' : 'Changes'}</span>
    </>
  );
}

/** Every surface is an index into the centre; none of them renders code itself. */
export function ReviewSidebar({
  scope,
  worktree,
  surface,
  onSurface,
  activeEntry,
  onOpen,
}: Props) {
  const props = { scope, activeEntry, onOpen };
  return (
    <aside
      aria-label="Review sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      <div className="shrink-0 border-b p-1.5">
        <Tabs
          value={surface}
          onValueChange={(value) => onSurface(value as Surface)}
        >
          <TabsList className="w-full">
            {SURFACES.map((entry) => {
              const Icon = SURFACE_ICONS[entry];
              return (
                // Tight gap and padding: at the sidebar's 260px minimum all three labels still fit.
                <TabsTrigger
                  key={entry}
                  value={entry}
                  className="min-w-0 flex-1 gap-1 px-1.5"
                >
                  {entry === 'changes' ? (
                    <ChangesSurfaceLabel scope={scope} />
                  ) : (
                    <>
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{SURFACE_LABELS[entry]}</span>
                    </>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewBoundary key={surface}>
          {surface === 'changes' && <ReviewIndex {...props} />}
          {surface === 'files' && (
            <FilesSurface {...props} worktreePath={worktree.path} />
          )}
          {surface === 'history' && <HistorySurface {...props} />}
        </ReviewBoundary>
      </div>
    </aside>
  );
}
