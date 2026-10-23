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
} from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { useComments } from '../queries/comments';
import { ReviewStatusIcon } from './change-row';
import { ChangeComment, CommentsView, ReviewViews } from './comments-view';
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
}: {
  revision: ReviewRevision;
  scope: ReviewScope;
  context: ConnectionContext;
  marks: ReviewMarks | undefined;
  file: string | undefined;
  onFile: (path: string) => void;
  onChange: (path: string) => void;
  onStop: (key: 'briefing' | 'unexplained') => void;
  onProof: () => void;
}) {
  const { threads } = useComments(scope, context);
  const { view, setView } = useReviewPanelView(revision.reviewId);
  const [expanded, setExpanded] = useState(true);
  const items = revisionReviewItems(revision, marks);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChangeReadiness
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
        filesLabel="Changed files"
        openComments={threads.filter((thread) => !thread.resolved).length}
      />
      {view === 'layers' && (
        <ScrollArea className="h-0 min-h-0 flex-1">
          <div className="p-2 pr-3">
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
                  <span className="min-w-0 flex-1 truncate">
                    {basename(item.path)}
                  </span>
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
