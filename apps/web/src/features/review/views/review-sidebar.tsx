import {
  FileDiffIcon,
  FilesIcon,
  HistoryIcon,
  ListChecksIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryNavigation } from '@/features/history/index';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OpenDocument } from '@/features/review/model/documents';
import {
  isSurface,
  type ReviewScope,
  type Surface,
} from '@/features/review/model/review';
import { usePublishedReview } from '@/features/review/queries/published-review';
import { useHasReviewLayers } from '@/features/review/queries/review';
import { FileNavigation } from './file-navigation';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewIndex } from './review-index';

export function ReviewSidebar({
  scope,
  worktreePath,
  surface,
  activeEntry,
  available,
  onSurface,
  onOpen,
}: {
  scope: ReviewScope;
  worktreePath: string;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onSurface: (surface: Surface) => void;
  onOpen: OpenDocument;
}) {
  return (
    <aside
      aria-label="Review sidebar"
      data-testid="review-sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      <Tabs
        value={surface}
        onValueChange={(value) => {
          if (isSurface(value)) onSurface(value);
        }}
        className="min-h-0 flex-1"
      >
        <div className="shrink-0 p-1.5">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="changes" className="min-w-0">
              <ChangesSurfaceLabel scope={scope} />
            </TabsTrigger>
            <TabsTrigger value="files" className="min-w-0">
              <FilesIcon className="size-3.5" />
              <span className="truncate">Files</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-0">
              <HistoryIcon className="size-3.5" />
              <span className="truncate">History</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="changes" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            worktreePath={worktreePath}
            surface="changes"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
        <TabsContent value="files" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            worktreePath={worktreePath}
            surface="files"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
        <TabsContent value="history" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            worktreePath={worktreePath}
            surface="history"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ChangesSurfaceLabel({ scope }: { scope: ReviewScope }) {
  const hasReview = useHasReviewLayers(scope) === true;
  const Icon = hasReview ? ListChecksIcon : FileDiffIcon;
  return (
    <>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{hasReview ? 'Review' : 'Changes'}</span>
    </>
  );
}

function SidebarSurface({
  scope,
  worktreePath,
  surface,
  activeEntry,
  available,
  onOpen,
}: {
  scope: ReviewScope;
  worktreePath: string;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onOpen: OpenDocument;
}) {
  const published = usePublishedReview(scope);
  if (!available)
    return (
      <div className="p-3">
        {published.data && surface === 'changes' && (
          <Button variant="ghost" onClick={() => onOpen({ kind: 'handoff' })}>
            Saved review
          </Button>
        )}
        <ReviewEmpty
          title="Worktree unavailable"
          description="Restore the checkout and return to Porcelain to browse its files and Git state."
        />
      </div>
    );

  const content = (
    <ReviewBoundary key={`${scope.worktreeId}:${surface}`}>
      {surface === 'changes' && (
        <ReviewIndex scope={scope} activeEntry={activeEntry} onOpen={onOpen} />
      )}
      {surface === 'files' && (
        <FileNavigation
          scope={scope}
          worktreePath={worktreePath}
          selected={
            activeEntry?.startsWith('file:') ? activeEntry.slice(5) : ''
          }
          onOpen={onOpen}
        />
      )}
      {surface === 'history' && (
        <HistoryNavigation
          scope={scope}
          selected={
            activeEntry?.startsWith('commit:') ? activeEntry.slice(7) : ''
          }
          onSelect={(oid) => onOpen({ kind: 'commit', oid })}
        />
      )}
    </ReviewBoundary>
  );
  return surface === 'files' ? (
    <div className="h-full">{content}</div>
  ) : (
    <ScrollArea className="h-full">{content}</ScrollArea>
  );
}
