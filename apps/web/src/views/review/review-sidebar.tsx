import {
  FileDiffIcon,
  FilesIcon,
  HistoryIcon,
  ListChecksIcon,
  PanelRightCloseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentRef } from '../../domain/documents';
import type { ReviewScope, Surface } from '../../domain/review';
import { useArtifacts, useReviewOverview } from '../../query/review';
import { FileNavigation } from './file-navigation';
import { HistoryNavigation } from './history-navigation';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewIndex } from './review-index';

export function ReviewSidebar({
  scope,
  surface,
  activeEntry,
  available,
  onSurface,
  onOpen,
  onClose,
}: {
  scope: ReviewScope;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onSurface: (surface: Surface) => void;
  onOpen: (ref: DocumentRef) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Review sidebar"
      data-testid="review-sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Worktree</p>
          <h2 className="truncate text-sm font-medium">Review navigator</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close review sidebar"
          onClick={onClose}
        >
          <PanelRightCloseIcon />
        </Button>
      </div>
      <Tabs
        value={surface}
        onValueChange={(value) => onSurface(value as Surface)}
        className="min-h-0 flex-1 gap-0"
      >
        <TabsList className="mx-2 mt-2 h-8 w-auto gap-0 rounded-lg">
          <TabsTrigger value="changes" className="min-w-0 flex-1 gap-1 px-2">
            <ChangesSurfaceLabel scope={scope} />
          </TabsTrigger>
          <TabsTrigger value="files" className="min-w-0 flex-1 gap-1 px-2">
            <FilesIcon />
            <span>Files</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="min-w-0 flex-1 gap-1 px-2">
            <HistoryIcon />
            <span>History</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="changes" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            surface="changes"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
        <TabsContent value="files" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            surface="files"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
        <TabsContent value="history" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            surface="history"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
          />
        </TabsContent>
      </Tabs>
      <p className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
        {available ? 'Scoped to selected worktree' : 'Worktree unavailable'}
      </p>
    </aside>
  );
}

function ChangesSurfaceLabel({ scope }: { scope: ReviewScope }) {
  const overview = useReviewOverview(scope);
  const review = (overview?.layers.layers.length ?? 0) > 0;
  const Icon = review ? ListChecksIcon : FileDiffIcon;
  return (
    <>
      <Icon />
      <span>{review ? 'Review' : 'Changes'}</span>
    </>
  );
}

function SidebarSurface({
  scope,
  surface,
  activeEntry,
  available,
  onOpen,
}: {
  scope: ReviewScope;
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
          description="Reconnect the checkout and refresh the environment to browse its files and Git state."
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
          selected={
            activeEntry?.startsWith('file:') ? activeEntry.slice(5) : ''
          }
          onSelect={(path) => onOpen({ kind: 'file', path })}
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
