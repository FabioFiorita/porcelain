import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isImagePath } from '../../domain/html-assets';
import type {
  Change,
  ChangeSelection,
  DiffContent,
  ReviewChangeItem,
  ReviewScope,
} from '../../domain/review';
import { type Layers, orderReviewChanges } from '../../domain/review';
import { useComments } from '../../query/comments';
import {
  selectionKey,
  useChangeDiffs,
  useReviewChanges,
  useUntrackedContents,
} from '../../query/review';
import { CodeDocument, type CodeEntry } from './code-document';
import { changeId, diffEntry, fileEntry } from './diff-entries';
import { ImagePreview } from './image-preview';
import { InlineComposer } from './inline-composer';
import { ReviewedControl } from './reviewed-control';
import { ThreadCard } from './thread-card';

export function ReviewCodeDocument({
  scope,
  paths,
  files = [],
  header,
  commentRequest,
  toolbar,
}: {
  scope: ReviewScope;
  paths?: readonly string[];
  files?: Layers['layers'][number]['files'];
  header?: () => ReactNode;
  commentRequest?: number;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
}) {
  // An omitted selection means the complete handoff. Selected views filter by
  // logical path, and every comparison of a selected path is kept (including
  // a staged and an unstaged change to the same file).
  const items = orderReviewChanges(useReviewChanges(scope, paths), files);
  const statusToken = items[0]?.statusToken ?? '';
  // The server re-establishes these before it answers, so what the reader is
  // shown cannot be newer than the fingerprint the mark beside it carries.
  const diffs = useChangeDiffs(
    scope,
    statusToken,
    items.flatMap((item) =>
      item.comparisons.some(
        (change) => change.scope === 'staged' || change.scope === 'unstaged',
      )
        ? [{ path: item.path, fingerprint: item.fingerprint }]
        : [],
    ),
    items.flatMap((item) => item.comparisons.flatMap(selectionOf)),
  );
  const untracked = useUntrackedContents(
    scope,
    items.flatMap((item) =>
      item.comparisons.flatMap((change) =>
        change.scope === 'untracked' ? [change.path] : [],
      ),
    ),
  );
  const patchOf = (change: Change): DiffContent | undefined => {
    const [selection] = selectionOf(change);
    return selection ? diffs.diffs.get(selectionKey(selection)) : undefined;
  };
  const loading = diffs.pending || untracked.pending;
  const failed = diffs.failed || untracked.failed;
  const notes = new Map(files.map((file) => [file.path, file.note]));
  const unrenderable = items.flatMap((item) => {
    const reasons = item.comparisons.flatMap((change) => {
      if (change.scope === 'unmerged') return ['Conflict'];
      if (change.scope === 'untracked')
        return untracked.contents.has(change.path) ? [] : ['Not readable'];
      if (!change.supported) return ['Unsupported comparison'];
      const content = patchOf(change);
      if (!content) return [];
      if (content.kind === 'binary') return ['Binary change'];
      if (content.kind === 'omitted')
        return [`Content omitted: ${formatOmission(content.reason)}`];
      return diffEntry(change, content) ? [] : ['No single-file textual patch'];
    });
    return reasons.length > 0 ? [{ item, reasons }] : [];
  });
  const entries = items.flatMap((item): CodeEntry[] =>
    item.comparisons.flatMap((change): CodeEntry[] => {
      const review = reviewControl(scope, item);
      if (change.scope === 'untracked') {
        const text = untracked.contents.get(change.path);
        if (text === undefined) return [];
        return [
          {
            ...fileEntry(
              changeId(change),
              item.path,
              text,
              notes.get(item.path) ?? `${change.scope} · untracked`,
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
      }
      if (change.scope === 'unmerged' || !change.supported) return [];
      const content = patchOf(change);
      const entry = content ? diffEntry(change, content) : null;
      const note = notes.get(item.path);
      return entry
        ? [
            {
              ...entry,
              ...(note ? { note } : {}),
              review,
              comment: {
                filePath: item.path,
                comparison: { kind: 'worktree', scope: change.scope },
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
    header || loading || failed || unrenderable.length > 0
      ? () => (
          <>
            {header?.()}
            {(loading || failed) && (
              <ContentState
                failed={failed}
                retry={() => {
                  diffs.retry();
                  untracked.retry();
                }}
              />
            )}
            {unrenderable.length > 0 && (
              <OmittedChanges
                changes={unrenderable}
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

/** Only a tracked comparison has hunks to ask for. */
function selectionOf(change: Change): ChangeSelection[] {
  return change.scope === 'staged' || change.scope === 'unstaged'
    ? [
        {
          scope: change.scope,
          oldPath: change.oldPath,
          newPath: change.newPath,
        },
      ]
    : [];
}

/**
 * Hunks arrive after the list of files does, so the document says where it is
 * rather than painting as if there were nothing to show.
 */
function ContentState({
  failed,
  retry,
}: {
  failed: boolean;
  retry: () => void;
}) {
  return (
    <section
      className="mx-4 mt-3 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
      aria-live="polite"
    >
      {failed ? (
        <>
          <span>The changes in this document could not be read.</span>
          <Button size="xs" variant="outline" onClick={retry}>
            Load the changes again
          </Button>
        </>
      ) : (
        <span>Loading changes…</span>
      )}
    </section>
  );
}

function reviewControl(scope: ReviewScope, item: ReviewChangeItem) {
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

function formatOmission(reason: string) {
  return reason.replaceAll('-', ' ');
}

function OmittedChanges({
  changes,
  renderedPaths,
  scope,
  commentRequest,
}: {
  changes: ReadonlyArray<{
    item: ReviewChangeItem;
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
        {changes.map(({ item, reasons }) => (
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
