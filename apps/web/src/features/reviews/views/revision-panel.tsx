import { PullRequestBlock } from './pull-request-block';
import { RevisionNavigation } from './review-navigation';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useState } from 'react';
import { useReviewPanelView } from '../store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileTypeIcon } from '@/features/files/index';
import {
  basename,
  type ReviewMarks,
  type ReviewRevision,
  type ReviewScope,
  revisionReviewItems,
  type ReviewStep,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { useComments } from '../queries/comments';
import { ReviewStatusIcon } from './change-row';
import {
  ChangeComment,
  CommentsView,
  ReviewViews,
  WholeChangeComment,
} from './comments-view';
import { ChangeReadiness } from './readiness-panel';
import { SidebarDocumentRow, SidebarGroup } from './sidebar-section';

export function RevisionPanel({
  revision,
  scope,
  context,
  marks,
  file,
  onFile,
  onChange,
  onStop,
  onProof,
  onOpenPullRequest,
  activeStop,
  onStep,
  actionsTarget,
}: {
  revision: ReviewRevision;
  scope: ReviewScope;
  context: ConnectionContext;
  marks: ReviewMarks | undefined;
  file: string | undefined;
  onFile: (path: string) => void;
  onChange: (path: string) => void;
  onStop: (key: WalkthroughKey) => void;
  activeStop: string;
  onStep: (step: ReviewStep) => void;
  actionsTarget: HTMLElement | null;
  onProof: () => void;
  onOpenPullRequest: (number: number) => void;
}) {
  const { threads } = useComments(scope, context);
  const { view, setView } = useReviewPanelView(revision.reviewId);
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const items = revisionReviewItems(revision, marks);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PullRequestBlock
        reviewId={revision.reviewId}
        context={context}
        onOpenPullRequest={onOpenPullRequest}
      />
      <WholeChangeComment
        target={view === 'layers' ? actionsTarget : null}
        branch
        onCompose={() => {
          setView('comments');
          setComposing(true);
        }}
      />
      <ChangeReadiness
        context={context}
        marks={marks}
        files={items}
        review={revision.content}
        threads={threads}
        onSelect={(key, firstStale) => {
          setView(
            key === 'comments' || key === 'replies' ? 'comments' : 'layers',
          );
          if (key === 'files') onStop('briefing');
          if (key === 'unexplained') onStop('unexplained');
          if (key === 'checks') onProof();
          if (key === 'stale' && firstStale !== undefined) onChange(firstStale);
        }}
      />
      <ReviewViews
        view={view}
        onView={setView}
        filesLabel="Explore"
        openComments={threads.filter((thread) => !thread.resolved).length}
      />
      {view === 'layers' && (
        <ScrollArea className="h-0 min-h-0 flex-1">
          <div className="px-2.5 pt-2 pb-3">
            <RevisionNavigation
              revision={revision}
              marks={marks}
              context={context}
              activeStop={activeStop}
              onStop={onStop}
              onStep={onStep}
            />
            <SidebarGroup
              name="Changed files"
              count={items.length}
              expanded={expanded}
              onExpanded={setExpanded}
              onAll={setExpanded}
            >
              {items.map((item) => (
                <SidebarDocumentRow
                  key={item.path}
                  label={item.path}
                  active={file === item.path}
                  onOpen={() => onChange(item.path)}
                >
                  <ReviewStatusIcon status={item.reviewStatus} />
                  <FileTypeIcon
                    path={item.path}
                    className="size-3.5 shrink-0"
                  />
                  <TruncatedText
                    className="min-w-0 flex-1 "
                    text={basename(item.path)}
                  />
                </SidebarDocumentRow>
              ))}
            </SidebarGroup>
          </div>
        </ScrollArea>
      )}
      {view === 'comments' && (
        <CommentsView
          scope={scope}
          context={context}
          threads={threads}
          composer={
            <ChangeComment
              scope={scope}
              context={context}
              anchor={{
                kind: 'change',
                revision: revision.headOid,
                comparison: { kind: 'branch', base: revision.base },
              }}
              open={composing}
              setOpen={setComposing}
            />
          }
          onReveal={(anchor) =>
            anchor.kind === 'change'
              ? onStop('briefing')
              : onFile(anchor.filePath)
          }
        />
      )}
    </div>
  );
}
