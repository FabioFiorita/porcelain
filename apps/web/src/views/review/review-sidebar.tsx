import {
  FileDiffIcon,
  FilesIcon,
  HistoryIcon,
  ListChecksIcon,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentRef } from '../../domain/documents';
import type { ReviewScope, Surface } from '../../domain/review';
import { useArtifacts, useHasReviewLayers } from '../../query/review';
import { FileNavigation } from './file-navigation';
import { HistoryNavigation } from './history-navigation';
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
  onOpen: (ref: DocumentRef) => void;
}) {
  return (
    <aside
      aria-label="Review sidebar"
      data-testid="review-sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      <Tabs
        value={surface}
        onValueChange={(value) => onSurface(value as Surface)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="shrink-0 border-b p-1.5">
          <TabsList className="h-8 w-full gap-0">
            <TabsTrigger value="changes" className="min-w-0 gap-1 px-1.5">
              <ChangesSurfaceLabel scope={scope} />
            </TabsTrigger>
            <TabsTrigger value="files" className="min-w-0 gap-1 px-1.5">
              <FilesIcon className="size-3.5" />
              <span className="truncate">Files</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-0 gap-1 px-1.5">
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
  onOpen: (ref: DocumentRef) => void;
}) {
  if (!available && surface === 'changes')
    return (
      <ScrollArea className="h-full">
        <ReviewBoundary>
          <ArchivedArtifacts scope={scope} onOpen={onOpen} />
        </ReviewBoundary>
      </ScrollArea>
    );

  if (!available)
    return (
      <div className="p-3">
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

function ArchivedArtifacts({
  scope,
  onOpen,
}: {
  scope: ReviewScope;
  onOpen: (ref: DocumentRef) => void;
}) {
  const artifacts = useArtifacts(scope);
  if (artifacts.length === 0)
    return (
      <div className="p-3">
        <ReviewEmpty
          title="Worktree unavailable"
          description="No stored agent reports are available for this checkout."
        />
      </div>
    );
  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="px-2 py-1 text-xs text-muted-foreground">
        Stored agent reports
      </p>
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
          onClick={() => onOpen({ kind: 'artifact', artifactId: artifact.id })}
        >
          <span className="min-w-0 flex-1 truncate">{artifact.name}</span>
          <span className="text-xs text-muted-foreground">
            {artifact.sizeBytes.toLocaleString()} bytes
          </span>
        </button>
      ))}
    </div>
  );
}
