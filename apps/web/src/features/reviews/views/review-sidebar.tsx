import { ALL_CHANGES, publishedReviewTitle } from '../rules/documents';
import { useElement } from '@/shared/hooks/use-element';
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

type SidebarProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  worktreePath: string;
  surface: Surface;
  activeEntry: string | undefined;
  available: boolean;
  onOpen: OpenDocument;
  sideLabel: string;
  changes: ChangesScope;
};

export function ReviewSidebar({
  layout,
  onSurface,
  ...props
}: SidebarProps & {
  layout: 'docked' | 'sheet';
  onSurface: (surface: Surface) => void;
}) {
  const { element: actionsTarget, attach: setActionsTarget } =
    useElement<HTMLDivElement>();
  const toolbar = (
    <div
      ref={setActionsTarget}
      role="toolbar"
      aria-label="Panel actions"
      className="ml-auto flex shrink-0 items-center gap-0.5"
    />
  );
  const names = useSurfaceNames(props.scope, props.context);
  const surface = <SidebarSurface {...props} actionsTarget={actionsTarget} />;
  return (
    <aside
      aria-label="Review sidebar"
      data-testid="review-sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      {layout === 'docked' ? (
        <>
          <header className="flex h-12 shrink-0 items-center gap-1 border-b pr-2.5 pl-3.5">
            <h2 className="truncate text-ui font-semibold">
              {names[props.surface]}
            </h2>
            {toolbar}
          </header>
          <div className="min-h-0 flex-1">{surface}</div>
        </>
      ) : (
        <Tabs
          value={props.surface}
          onValueChange={(value) => {
            if (isSurface(value)) onSurface(value);
          }}
          className="min-h-0 flex-1"
        >
          <div className="flex h-12 shrink-0 items-center gap-1 border-b px-1.5">
            <TabsList className="h-8 min-w-0 flex-1">
              {SURFACES.map((value) => (
                <TabsTrigger key={value} value={value} className="min-w-0">
                  <SurfaceIcon
                    scope={props.scope}
                    context={props.context}
                    surface={value}
                    className="size-3.5 shrink-0"
                  />
                  <span className="truncate">{names[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {toolbar}
          </div>
          <TabsContent
            value={props.surface}
            className="min-h-0 overflow-hidden"
          >
            {surface}
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}

const SURFACES: readonly Surface[] = ['files', 'changes', 'history'];

export function useSurfaceNames(
  scope: ReviewScope,
  context: ConnectionContext,
): Record<Surface, string> {
  const { review } = usePublishedReview(scope, context);
  return {
    files: 'Files',
    changes: publishedReviewTitle(review) ?? 'Changes',
    history: 'History',
  };
}

export function SurfaceIcon({
  scope,
  context,
  surface,
  className,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  surface: Surface;
  className?: string;
}) {
  const { review } = usePublishedReview(scope, context);
  if (surface === 'files') return <FilesIcon className={className} />;
  if (surface === 'history') return <HistoryIcon className={className} />;
  return review ? (
    <ListChecksIcon className={className} />
  ) : (
    <FileDiffIcon className={className} />
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
  actionsTarget,
}: SidebarProps & { actionsTarget: HTMLElement | null }) {
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
          actionsTarget={actionsTarget}
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
          onOpenChanges={() => onOpen(ALL_CHANGES)}
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
