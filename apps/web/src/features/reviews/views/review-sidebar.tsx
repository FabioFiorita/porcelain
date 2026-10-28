import { TruncatedText } from '@/shared/views/truncated-text';
import {
  ALL_CHANGES,
  publishedReviewTitle,
  surfaceTitles,
} from '../rules/documents';
import { useElement } from '@/shared/hooks/use-element';
import type { ReactNode } from 'react';
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
import { StateNotice } from '@/shared/views/state-notice';
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
  const { review } = usePublishedReview(props.scope, props.context);
  return (
    <SidePanel
      layout={layout}
      surfaces={SURFACES}
      names={surfaceNames(review)}
      published={Boolean(review)}
      surface={props.surface}
      onSurface={onSurface}
    >
      {(actionsTarget) => (
        <SidebarSurface {...props} actionsTarget={actionsTarget} />
      )}
    </SidePanel>
  );
}

export function SidePanel({
  layout,
  surfaces,
  names,
  published,
  surface,
  onSurface,
  children,
}: {
  layout: 'docked' | 'sheet';
  surfaces: readonly Surface[];
  names: Record<Surface, string>;
  published: boolean;
  surface: Surface;
  onSurface: (surface: Surface) => void;
  children: (actionsTarget: HTMLElement | null) => ReactNode;
}) {
  const { element: actionsTarget, attach: setActionsTarget } =
    useElement<HTMLDivElement>();
  const toolbar = (
    <div
      ref={setActionsTarget}
      className="ml-auto flex shrink-0 items-center gap-0.5"
    />
  );
  const content = children(actionsTarget);
  return (
    <aside
      aria-label="Review sidebar"
      data-testid="review-sidebar"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-paper bg-background shadow-paper"
    >
      {layout === 'docked' ? (
        <>
          <header className="flex h-12 shrink-0 items-center gap-1 border-b pr-2.5 pl-4">
            <TruncatedText
              className="text-ui leading-5 font-semibold"
              render={<h2 />}
              text={names[surface]}
            />
            {toolbar}
          </header>
          <div className="min-h-0 flex-1 text-sm">{content}</div>
        </>
      ) : (
        <Tabs
          value={surface}
          onValueChange={(value) => {
            if (isSurface(value)) onSurface(value);
          }}
          className="min-h-0 flex-1"
        >
          <div className="flex h-12 shrink-0 items-center gap-1 border-b px-1.5">
            <TabsList className="h-8 min-w-0 flex-1">
              {surfaces.map((value) => (
                <TruncatedText
                  propagateEscape
                  key={value}
                  text={names[value]}
                  renderTrigger={(label) => (
                    <TabsTrigger value={value} className="min-w-0">
                      <SurfaceIcon
                        published={published}
                        surface={value}
                        className="size-3.5 shrink-0"
                      />
                      {label}
                    </TabsTrigger>
                  )}
                />
              ))}
            </TabsList>
            {toolbar}
          </div>
          <TabsContent value={surface} className="min-h-0 overflow-hidden">
            {content}
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}

export const SURFACES: readonly Surface[] = ['files', 'changes', 'history'];

export function surfaceNames(
  review: Parameters<typeof publishedReviewTitle>[0],
): Record<Surface, string> {
  return {
    ...surfaceTitles,
    changes: publishedReviewTitle(review) ?? surfaceTitles.changes,
  };
}

export function SurfaceIcon({
  published,
  surface,
  className,
}: {
  published: boolean;
  surface: Surface;
  className?: string;
}) {
  if (surface === 'files') return <FilesIcon className={className} />;
  if (surface === 'history') return <HistoryIcon className={className} />;
  return published ? (
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
        <StateNotice
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
          actionsTarget={actionsTarget}
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
