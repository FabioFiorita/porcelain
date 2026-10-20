import { publishedReviewTitle } from '../rules/documents';
import {
  FileDiffIcon,
  FilesIcon,
  HistoryIcon,
  ListChecksIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileNavigation } from '@/features/files/index';
import { HistoryNavigation } from '@/features/history/index';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePublishedReview } from '../queries/published-review';
import type { OpenDocument } from '../rules/documents';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import {
  type ChangeScope,
  isSurface,
  type Surface,
} from '@/shared/workspace/search';
import { ReviewBoundary } from './review-boundary';
import { ReviewEmpty } from './review-empty';
import { ReviewIndex } from './review-index';
import { type ConnectionContext } from '@/shared/workspace/connection';

type ChangesScope = {
  scope: ChangeScope;
  base: string | undefined;
  onScope: (scope: ChangeScope) => void;
  onBase: (base: string | undefined) => void;
};

export function ReviewSidebar({
  scope,
  context,
  worktreePath,
  surface,
  activeEntry,
  available,
  onSurface,
  onOpen,
  sideLabel,
  changes,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  worktreePath: string;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onSurface: (surface: Surface) => void;
  onOpen: OpenDocument;
  sideLabel: string;
  changes: ChangesScope;
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
            <TabsTrigger value="files" className="min-w-0">
              <FilesIcon className="size-3.5" />
              <span className="truncate">Files</span>
            </TabsTrigger>
            <TabsTrigger value="changes" className="min-w-0">
              <ChangesSurfaceLabel scope={scope} context={context} />
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
            context={context}
            worktreePath={worktreePath}
            surface="changes"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
            sideLabel={sideLabel}
            changes={changes}
          />
        </TabsContent>
        <TabsContent value="files" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            context={context}
            worktreePath={worktreePath}
            surface="files"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
            sideLabel={sideLabel}
            changes={changes}
          />
        </TabsContent>
        <TabsContent value="history" className="min-h-0 overflow-hidden">
          <SidebarSurface
            scope={scope}
            context={context}
            worktreePath={worktreePath}
            surface="history"
            activeEntry={activeEntry}
            available={available}
            onOpen={onOpen}
            sideLabel={sideLabel}
            changes={changes}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ChangesSurfaceLabel({
  scope,
  context,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
}) {
  const { review } = usePublishedReview(scope, context);
  const title = publishedReviewTitle(review);
  const hasReview = review !== null && review !== undefined;
  const Icon = hasReview ? ListChecksIcon : FileDiffIcon;
  return (
    <>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{title ?? 'Changes'}</span>
    </>
  );
}

function SidebarSurface({
  scope,
  context,
  worktreePath,
  surface,
  activeEntry,
  available,
  onOpen,
  sideLabel,
  changes,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  worktreePath: string;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onOpen: OpenDocument;
  sideLabel: string;
  changes: ChangesScope;
}) {
  const published = usePublishedReview(scope, context);
  if (!available)
    return (
      <div className="p-3">
        {published.review && surface === 'changes' && (
          <Button variant="ghost" onClick={() => onOpen({ kind: 'handoff' })}>
            Review
          </Button>
        )}
        <ReviewEmpty
          title="Worktree unavailable"
          description="Restore the checkout and return to Porcelain to browse its files and Git state."
        />
      </div>
    );

  const content = (
    <ReviewBoundary
      connection={context.connection}
      scope={scope}
      key={`${scope.worktreeId}:${surface}`}
    >
      {surface === 'changes' && (
        <ReviewIndex
          scope={scope}
          context={context}
          activeEntry={activeEntry}
          onOpen={onOpen}
          sideLabel={sideLabel}
          changeScope={changes.scope}
          base={changes.base}
          onChangeScope={changes.onScope}
          onBase={changes.onBase}
        />
      )}
      {surface === 'files' && (
        <FileNavigation
          scope={scope}
          connection={context.connection}
          worktreePath={worktreePath}
          selected={
            activeEntry?.startsWith('file:') ? activeEntry.slice(5) : ''
          }
          onOpen={onOpen}
          sideLabel={sideLabel}
        />
      )}
      {surface === 'history' && (
        <HistoryNavigation
          scope={scope}
          connection={context.connection}
          selected={
            activeEntry?.startsWith('commit:') ? activeEntry.slice(7) : ''
          }
          onSelect={(oid, toSide) =>
            onOpen({ kind: 'commit', oid }, undefined, {
              toSide: toSide === true,
            })
          }
          sideLabel={sideLabel}
          onOpenGraph={() => onOpen({ kind: 'graph' })}
        />
      )}
    </ReviewBoundary>
  );
  return surface === 'changes' ? (
    <ScrollArea className="h-full">{content}</ScrollArea>
  ) : (
    <div className="flex h-full min-h-0 flex-col">{content}</div>
  );
}
