import { type ReactNode } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readReviewMarks } from '@porcelain/client/reviews';
import {
  revisionDecisionProgress,
  type ReviewRevision,
  type ReviewScope,
} from '@porcelain/client/reviews/rules';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import type { ConnectionContext } from '@/shared/workspace/connection';
import { useElement } from '@/shared/hooks/use-element';
import { cn } from '@/shared/lib/utils';
import { useInventory } from '@/features/projects/index';
import { GitButton } from '@/features/git-actions/index';
import { useSpecsApart } from '@/features/preferences/index';
import {
  type useTabLayout,
  paneTabActions,
  type PaneIndex,
} from '../adapters/tab-layout';
import { parseEntry, type OpenDocument } from '../rules/documents';
import { openToSideText } from '../rules/tab-strip';
import { DocumentTabs } from './document-tabs';
import { DocumentView } from './documents';
import { ReviewBoundary } from './review-boundary';

export function ReviewDocumentWorkspace({
  revision,
  context,
  navigation,
  layout,
  focused,
  onOpen,
  review,
  reviewActions,
  panelControl,
}: {
  revision: ReviewRevision;
  context: ConnectionContext;
  navigation?: ReactNode;
  layout: ReturnType<typeof useTabLayout>;
  focused: PaneIndex;
  onOpen: OpenDocument;
  review: ReactNode;
  reviewActions: ReactNode;
  panelControl: ReactNode;
}) {
  const pane = layout.panes[focused];
  useHotkey(SHORTCUTS.previousTab, () => layout.step(focused, -1), {
    ignoreInputs: true,
  });
  useHotkey(SHORTCUTS.nextTab, () => layout.step(focused, 1), {
    ignoreInputs: true,
  });
  useHotkey(
    SHORTCUTS.closeTab,
    () => {
      if (pane?.active) layout.close(focused, pane.active);
    },
    { ignoreInputs: true },
  );
  useHotkey(
    SHORTCUTS.openToSide,
    () => {
      if (pane?.active && pane.active !== 'handoff')
        layout.openToSide(focused, pane.active);
    },
    { ignoreInputs: true },
  );
  const inventory = useInventory(context.connection);
  const available = inventory.projects.some(
    (project) =>
      project.id === revision.projectId &&
      project.worktrees.some(
        (worktree) =>
          worktree.id === revision.content.worktreeId && worktree.available,
      ),
  );
  const scope = {
    projectId: revision.projectId,
    worktreeId: revision.content.worktreeId,
  };
  const marks = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(
        readReviewMarks({
          connection: context.connection,
          reviewId: revision.reviewId,
        }),
      ),
    ),
  );
  const specsApart = useSpecsApart(context.connection);
  const progress = revisionDecisionProgress(revision, marks, { specsApart });
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-paper border bg-card md:flex-row">
      {layout.panes.map((_pane, index) => (
        <ReviewDocumentPane
          key={index}
          index={index === 0 ? 0 : 1}
          focused={focused === index}
          layout={layout}
          available={available}
          scope={scope}
          context={context}
          navigation={index === 0 ? navigation : undefined}
          onOpen={onOpen}
          review={review}
          reviewActions={reviewActions}
          panelControl={panelControl}
          reviewCount={
            <span className="text-muted-foreground tabular-nums">
              {progress.reviewed}/{progress.total}
            </span>
          }
        />
      ))}
    </div>
  );
}

function ReviewDocumentPane({
  index,
  layout,
  scope,
  context,
  navigation,
  onOpen,
  review,
  reviewActions,
  panelControl,
  reviewCount,
  available,
  focused,
}: {
  index: PaneIndex;
  available: boolean;
  focused: boolean;
  layout: ReturnType<typeof useTabLayout>;
  scope: ReviewScope;
  context: ConnectionContext;
  navigation?: ReactNode;
  onOpen: OpenDocument;
  review: ReactNode;
  reviewActions: ReactNode;
  panelControl: ReactNode;
  reviewCount: ReactNode;
}) {
  const { element: toolbarTarget, attach: setToolbarTarget } =
    useElement<HTMLDivElement>();
  const pane = layout.panes[index];
  if (!pane) return null;
  const side = layout.split ? paneSide(index) : null;
  const document = parseEntry(pane.active ?? undefined);
  const showingReview = document?.kind === 'handoff';
  return (
    <section
      ref={(element) => layout.bindPane(index, element)}
      aria-label={side ? `${index === 0 ? 'Left' : 'Right'} pane` : undefined}
      onPointerDownCapture={() => layout.selectPane(index)}
      onFocusCapture={(event) => layout.focusPane(index, event.target)}
      className={cn(
        '@container/pane relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        index === 1 && 'border-t md:border-t-0 md:border-l',
      )}
    >
      <DocumentTabs
        tabs={pane.tabs}
        pinned={pane.pinned}
        active={pane.active}
        reviewTitle="Review"
        reviewCount={reviewCount}
        side={side}
        focused={focused}
        leading={navigation}
        {...paneTabActions(layout, index)}
        trailing={
          <>
            {showingReview ? (
              reviewActions
            ) : (
              <div
                ref={setToolbarTarget}
                role="toolbar"
                aria-label="Document controls"
                className="flex items-center gap-1"
              />
            )}
            {panelControl}
            {available && (!layout.split || index === 1) && (
              <>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
                <GitButton scope={scope} context={context} />
              </>
            )}
          </>
        }
      />
      {pane.tabs.includes('handoff') && (
        <div
          aria-hidden={!showingReview}
          inert={!showingReview}
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            !showingReview &&
              'pointer-events-none invisible absolute opacity-0 inset-x-0 top-12 bottom-0',
          )}
        >
          {review}
        </div>
      )}
      {document && !showingReview && (
        <ReviewBoundary
          key={pane.active}
          connection={context.connection}
          scope={scope}
        >
          <DocumentView
            scope={scope}
            context={context}
            document={document}
            onOpen={onOpen}
            onBrowse={() => {}}
            sideLabel={openToSideText(side)}
            active={focused}
            toolbarTarget={toolbarTarget}
          />
        </ReviewBoundary>
      )}
    </section>
  );
}

function paneSide(index: PaneIndex) {
  return index === 0 ? 'left' : 'right';
}
