import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isImagePath } from '../../domain/html-assets';
import type {
  Change,
  Diff,
  ReviewEvidenceItem,
  ReviewScope,
} from '../../domain/review';
import { type Layers, orderReviewEvidence } from '../../domain/review';
import { useComments } from '../../query/comments';
import { useReviewEvidence } from '../../query/review';
import { CodeDocument, type CodeEntry } from './code-document';
import { diffEntry, evidenceId, fileEntry } from './diff-entries';
import { ImagePreview } from './image-preview';
import { InlineComposer } from './inline-composer';
import { ReviewedControl } from './reviewed-control';
import { ThreadCard } from './thread-card';

export function ReviewCodeDocument({
  scope,
  changes,
  files = [],
  header,
  commentRequest,
  toolbar,
}: {
  scope: ReviewScope;
  changes?: readonly Change[];
  files?: Layers['layers'][number]['files'];
  header?: () => ReactNode;
  commentRequest?: number;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
}) {
  // An omitted selection means the complete handoff. Selected views filter by
  // logical path, while the evidence query retains every comparison for that
  // path (including staged and unstaged changes).
  const evidence = orderReviewEvidence(
    useReviewEvidence(scope, changes),
    files,
  );
  const notes = new Map(files.map((file) => [file.path, file.note]));
  const unrenderable = evidence.flatMap((item) => {
    const reasons = item.comparisons.flatMap((comparison) => {
      if (comparison.content.kind === 'omitted')
        return [formatOmission(comparison.content.reason)];
      if (comparison.content.kind === 'file') return [];
      if (comparison.content.content.kind === 'binary')
        return ['Binary change'];
      if (comparison.content.content.kind === 'omitted')
        return [`Content omitted: ${comparison.content.content.reason}`];
      if (!('kind' in comparison.change)) return ['Unsupported comparison'];
      const response = toDiff(item, comparison.change, comparison.content);
      return diffEntry(comparison.change, response)
        ? []
        : ['No single-file textual patch'];
    });
    return reasons.length > 0 ? [{ item, reasons }] : [];
  });
  const entries = evidence.flatMap((item): CodeEntry[] =>
    item.comparisons.flatMap((comparison): CodeEntry[] => {
      const review = reviewControl(scope, item);
      if (comparison.content.kind === 'file')
        return [
          {
            ...fileEntry(
              evidenceId(comparison.change),
              item.path,
              comparison.content.text,
              notes.get(item.path) ?? `${comparison.change.scope} · untracked`,
            ),
            review,
            comment: {
              filePath: item.path,
              comparison: { kind: 'worktree', scope: 'untracked' },
              ...(item.fingerprint
                ? { contentFingerprint: item.fingerprint }
                : {}),
            },
          },
        ];
      if (comparison.content.kind !== 'diff') return [];
      if (!('kind' in comparison.change)) return [];
      const entry = diffEntry(
        comparison.change,
        toDiff(item, comparison.change, comparison.content),
      );
      const note = notes.get(item.path);
      return entry
        ? [
            {
              ...entry,
              ...(note ? { note } : {}),
              review,
              comment: {
                filePath: item.path,
                comparison: {
                  kind: 'worktree',
                  scope: comparison.change.scope,
                },
                ...(item.fingerprint
                  ? { contentFingerprint: item.fingerprint }
                  : {}),
              },
            },
          ]
        : [];
    }),
  );
  const renderedPaths = new Set(entries.map((entry) => entry.path));
  const documentHeader =
    header || unrenderable.length > 0
      ? () => (
          <>
            {header?.()}
            {unrenderable.length > 0 && (
              <OmittedEvidence
                evidence={unrenderable}
                renderedPaths={renderedPaths}
                scope={scope}
                {...(entries.length === 0 && commentRequest !== undefined
                  ? { commentRequest }
                  : {})}
              />
            )}
          </>
        )
      : undefined;

  return (
    <CodeDocument
      scope={scope}
      {...(commentRequest !== undefined ? { commentRequest } : {})}
      entries={entries}
      {...(documentHeader ? { header: documentHeader } : {})}
      {...(toolbar ? { toolbar } : {})}
    />
  );
}

function reviewControl(scope: ReviewScope, item: ReviewEvidenceItem) {
  return {
    path: item.path,
    fingerprint: item.fingerprint,
    reviewed: item.reviewStatus === 'reviewed',
    stale: item.reviewStatus === 'stale',
    control: (
      <ReviewedControl
        key={`review:${item.path}`}
        scope={scope}
        path={item.path}
        fingerprint={item.fingerprint}
        status={item.reviewStatus}
        compact
      />
    ),
  };
}

function toDiff(
  item: ReviewEvidenceItem,
  change: Extract<Change, { kind: string }>,
  content: Extract<
    ReviewEvidenceItem['comparisons'][number]['content'],
    { kind: 'diff' }
  >,
): Diff {
  return {
    environmentId: item.environmentId,
    worktreeId: item.worktreeId,
    statusToken: item.statusToken,
    consistency: item.consistency,
    change: {
      scope: change.scope,
      oldPath: change.oldPath,
      newPath: change.newPath,
    },
    oldMode: change.oldMode,
    newMode: change.newMode,
    content: content.content,
  };
}

function formatOmission(reason: string) {
  return reason.replaceAll('-', ' ');
}

function OmittedEvidence({
  evidence,
  renderedPaths,
  scope,
  commentRequest,
}: {
  evidence: ReadonlyArray<{
    item: ReviewEvidenceItem;
    reasons: readonly string[];
  }>;
  commentRequest?: number;
  renderedPaths: ReadonlySet<string>;
  scope: ReviewScope;
}) {
  return (
    <section className="mx-4 mt-3 rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium">Non-text content</p>
      <ul className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
        {evidence.map(({ item, reasons }) => (
          <li
            key={item.path}
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
            <span className="min-w-0 flex-1 truncate">{item.path}</span>
            {isImagePath(item.path) && (
              <>
                <span>Current worktree image</span>
                <ImagePreview scope={scope} path={item.path} />
              </>
            )}
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] font-normal"
            >
              {reasons.join(', ')}
            </Badge>
            {!renderedPaths.has(item.path) && (
              <ReviewedControl
                scope={scope}
                path={item.path}
                fingerprint={item.fingerprint}
                status={item.reviewStatus}
                compact
              />
            )}
            {!renderedPaths.has(item.path) && (
              <OmittedDiscussion
                scope={scope}
                path={item.path}
                {...(commentRequest !== undefined ? { commentRequest } : {})}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function OmittedDiscussion({
  scope,
  path,
  commentRequest,
}: {
  scope: ReviewScope;
  path: string;
  commentRequest?: number;
}) {
  const { threads } = useComments(scope);
  const [compose, setCompose] = useState(false);
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (commentRequest !== undefined && handled.current !== commentRequest) {
      handled.current = commentRequest;
      setCompose(true);
    }
  }, [commentRequest]);
  const visible = threads.filter(
    (thread) =>
      thread.anchor.kind === 'file' &&
      thread.anchor.filePath === path &&
      !thread.anchor.revision,
  );
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setCompose(true)}>
        Comment on {path}
      </Button>
      {(visible.length > 0 || compose) && (
        <div className="w-full space-y-2">
          {visible.map((thread) => (
            <ThreadCard key={thread.id} scope={scope} thread={thread} />
          ))}
          {compose && (
            <InlineComposer
              scope={scope}
              anchor={{ kind: 'file', filePath: path }}
              onClose={() => setCompose(false)}
            />
          )}
        </div>
      )}
    </>
  );
}
