import type {
  CodeViewItem,
  CodeViewLineSelection,
  DiffLineAnnotation,
  FileDiffMetadata,
} from '@pierre/diffs';
import {
  CodeView,
  type CodeViewHandle,
  type CodeViewReactOptions,
} from '@pierre/diffs/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import type {
  CommentAnchor,
  CommentTarget,
  CommentThread,
} from '../../domain/comments';
import {
  commentIsStale,
  matchesCommentTarget,
  rangeAnchor,
} from '../../domain/comments';
import { basename, type ReviewScope } from '../../domain/review';
import {
  contentVersion,
  PIERRE_COMMENT_CSS,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
} from '../../lib/pierre';
import { useComments } from '../../query/comments';
import {
  reviewErrorMessage,
  useMarkReviewed,
  useUnmarkReviewed,
} from '../../query/review';
import { usePreferences } from '../workspace/preferences';
import { SHORTCUTS } from '../workspace/shortcuts';
import { useTheme } from '../workspace/theme';
import { DiscardButton } from './discard';
import { useDocumentInteraction } from './document-interaction';
import { InlineComposer } from './inline-composer';
import { anchorLabel, ThreadCard } from './thread-card';
import { useCodeFolds } from './use-code-folds';

export type CodeEntry =
  | {
      id: string;
      kind: 'diff';
      path: string;
      fileDiff: FileDiffMetadata;
      version: number;
      note?: string;
      comment?: CommentTarget;
      review?: {
        path: string;
        control: ReactNode;
        reviewed?: boolean;
        stale?: boolean;
        fingerprint?: string | null;
      };
    }
  | {
      id: string;
      kind: 'file';
      path: string;
      contents: string;
      version: number;
      note?: string;
      comment?: CommentTarget;
      review?: {
        path: string;
        control: ReactNode;
        reviewed?: boolean;
        stale?: boolean;
        fingerprint?: string | null;
      };
    };

type Note =
  | { kind: 'thread'; thread: CommentThread; stale: boolean }
  | { kind: 'composer'; anchor: CommentAnchor };
type Props = {
  entries: readonly CodeEntry[];
  scope?: ReviewScope;
  header?: () => ReactNode;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
  commentRequest?: number;
  disableFileHeader?: boolean;
  headerActions?: ReactNode;
  onToggleReviewed?: (entry: CodeEntry) => void;
};
export function CodeDocument(props: Props) {
  return props.scope ? (
    <ConnectedCodeDocument {...props} scope={props.scope} />
  ) : (
    <CodeSurface {...props} threads={[]} />
  );
}
function ConnectedCodeDocument(props: Props & { scope: ReviewScope }) {
  const { threads, error } = useComments(props.scope);
  const mark = useMarkReviewed(props.scope);
  const unmark = useUnmarkReviewed(props.scope);
  const toggle = (entry: CodeEntry) => {
    const review = entry.review;
    if (!review?.fingerprint || mark.isPending || unmark.isPending) return;
    const operation = review.reviewed
      ? unmark.submit(review.path)
      : mark.submit({ path: review.path, fingerprint: review.fingerprint });
    void operation.catch((error: unknown) =>
      toast.add({
        title: 'Could not update review',
        description: reviewErrorMessage(error),
        type: 'error',
      }),
    );
  };
  return (
    <>
      {error && (
        <p role="alert" className="px-3 text-xs text-destructive">
          Comments could not be refreshed.
        </p>
      )}
      <CodeSurface {...props} threads={threads} onToggleReviewed={toggle} />
    </>
  );
}
function CodeSurface({
  entries,
  scope,
  header,
  toolbar,
  threads,
  commentRequest,
  disableFileHeader = false,
  headerActions,
  onToggleReviewed,
}: Props & { threads: readonly CommentThread[] }) {
  const { dark } = useTheme();
  const { preferences } = usePreferences();
  const interaction = useDocumentInteraction();
  const folds = useCodeFolds(interaction.storageKey);
  const viewer = useRef<CodeViewHandle<Note, undefined>>(null);
  const [composer, setComposer] = useState<{
    id: string;
    anchor: CommentAnchor;
  } | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(
    null,
  );
  const [focused, setFocused] = useState(0);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const collapsed = new Set(
    entries
      .filter(
        (entry) =>
          composer?.id !== entry.id &&
          folds.isCollapsed(
            entry.id,
            entries.length > 1 && entry.review?.reviewed,
          ),
      )
      .map((entry) => entry.id),
  );
  const openFileComment = (entry: CodeEntry | undefined) => {
    if (!entry?.comment || !scope) return;
    setFocused(entries.findIndex((candidate) => candidate.id === entry.id));
    setComposer({ id: entry.id, anchor: { ...entry.comment, kind: 'file' } });
    setSelection(null);
  };
  const closeComposer = () => {
    setComposer(null);
    setSelection(null);
  };
  const handledComment = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      commentRequest === undefined ||
      handledComment.current === commentRequest
    )
      return;
    handledComment.current = commentRequest;
    openFileComment(entries[0]);
  });
  const handledReveal = useRef<number | undefined>(undefined);
  const reveal = interaction.reveal;
  const revealEntry =
    reveal &&
    entries.find(
      (entry) =>
        entry.comment && matchesCommentTarget(reveal.anchor, entry.comment),
    );
  useEffect(() => {
    if (!reveal || !revealEntry || handledReveal.current === reveal.nonce)
      return;
    if (collapsed.has(revealEntry.id)) {
      folds.setCollapsed([revealEntry.id], false);
      return;
    }
    const timer = requestAnimationFrame(() => {
      const anchor = reveal.anchor;
      const stale =
        revealEntry.comment && commentIsStale(anchor, revealEntry.comment);
      viewer.current?.scrollTo(
        anchor.kind === 'codeRange' && !stale
          ? {
              type: 'line',
              id: revealEntry.id,
              lineNumber: anchor.startLine,
              ...(revealEntry.kind === 'diff'
                ? { side: anchor.side ?? 'additions' }
                : {}),
              align: 'center',
            }
          : { type: 'item', id: revealEntry.id, align: 'start' },
      );
      setFocused(entries.findIndex((entry) => entry.id === revealEntry.id));
      handledReveal.current = reveal.nonce;
    });
    return () => cancelAnimationFrame(timer);
  });
  const focusEntry = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    setFocused(index);
    viewer.current?.scrollTo({ type: 'item', id: entry.id, align: 'start' });
  };
  const hotkeys = { enabled: interaction.active, ignoreInputs: true };
  useHotkey(
    SHORTCUTS.nextFile,
    () => focusEntry(Math.min(focused + 1, entries.length - 1)),
    hotkeys,
  );
  useHotkey(
    SHORTCUTS.previousFile,
    () => focusEntry(Math.max(focused - 1, 0)),
    hotkeys,
  );
  useHotkey(
    SHORTCUTS.commentOnFile,
    () => openFileComment(entries[focused]),
    hotkeys,
  );
  useHotkey(
    SHORTCUTS.toggleReviewed,
    () => {
      const entry = entries[focused];
      if (entry) onToggleReviewed?.(entry);
    },
    hotkeys,
  );
  const byId = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );
  const items: CodeViewItem<Note>[] = entries.map((entry) => {
    const target = entry.comment;
    const notes: Note[] = target
      ? threads
          .filter(
            (thread) =>
              matchesCommentTarget(thread.anchor, target) &&
              (thread.anchor.comparison ||
                entries.find(
                  (candidate) =>
                    candidate.comment &&
                    matchesCommentTarget(thread.anchor, candidate.comment),
                )?.id === entry.id),
          )
          .map((thread) => ({
            kind: 'thread',
            thread,
            stale: commentIsStale(thread.anchor, target),
          }))
      : [];
    if (composer?.id === entry.id)
      notes.push({ kind: 'composer', anchor: composer.anchor });
    const annotations = notes.map((note): DiffLineAnnotation<Note> => {
      const anchor = note.kind === 'thread' ? note.thread.anchor : note.anchor;
      const lineNumber =
        anchor.kind === 'codeRange' && !(note.kind === 'thread' && note.stale)
          ? anchor.endLine
          : 0;
      const side =
        anchor.kind === 'codeRange'
          ? (anchor.side ?? 'additions')
          : 'additions';
      return note.kind === 'thread'
        ? { lineNumber, side, metadata: note }
        : { lineNumber, side, metadata: note };
    });
    const shared = {
      id: entry.id,
      collapsed: collapsed.has(entry.id),
      version: contentVersion(
        JSON.stringify([entry.version, collapsed.has(entry.id), notes]),
      ),
      annotations,
    };
    return entry.kind === 'diff'
      ? { ...shared, type: 'diff', fileDiff: entry.fileDiff }
      : {
          ...shared,
          type: 'file',
          file: { name: entry.path, contents: entry.contents },
        };
  });
  const firstReviewEntryByPath = useMemo(() => {
    const result = new Map<string, string>();
    for (const entry of entries) {
      if (entry.review && !result.has(entry.review.path))
        result.set(entry.review.path, entry.id);
    }
    return result;
  }, [entries]);
  const options = useMemo<CodeViewReactOptions<Note, undefined>>(
    () => ({
      theme: PIERRE_THEME,
      themeType: dark ? 'dark' : 'light',
      overflow: preferences.lineOverflow,
      diffStyle: preferences.diffStyle,
      diffIndicators: 'classic',
      hunkSeparators: 'line-info',
      stickyHeaders: !disableFileHeader,
      disableFileHeader,
      enableLineSelection: true,
      enableGutterUtility: scope !== undefined,
      onLineClick: (_, context) =>
        setFocused(entries.findIndex((entry) => entry.id === context.item.id)),
      onLineNumberClick: (_, context) =>
        setFocused(entries.findIndex((entry) => entry.id === context.item.id)),
      onGutterUtilityClick: (range, context) => {
        const entry = byId.get(context.item.id);
        if (!entry?.comment || !scope) return;
        const anchor = rangeAnchor(entry.comment, range);
        if (!anchor) {
          setRangeError('Select lines on one side of the comparison.');
          return;
        }
        setFocused(entries.findIndex((candidate) => candidate.id === entry.id));
        setRangeError(null);
        setComposer({ id: entry.id, anchor });
        setSelection({ id: entry.id, range });
      },
      lineHoverHighlight: 'number',
      unsafeCSS: `${PIERRE_SURFACE_CSS}${scope ? PIERRE_COMMENT_CSS : ''}${disableFileHeader ? '[data-code] { padding-top: 0 !important; }' : ''}`,
      ...(disableFileHeader ? { itemMetrics: { paddingTop: 0 } } : {}),
      layout: {
        paddingTop: disableFileHeader ? 0 : 12,
        paddingBottom: 160,
        gap: 12,
      },
    }),
    [
      dark,
      preferences.diffStyle,
      preferences.lineOverflow,
      disableFileHeader,
      scope,
      byId,
      entries,
    ],
  );
  const allCollapsed =
    entries.length > 0 && entries.every((entry) => collapsed.has(entry.id));

  const setAllCollapsed = (next: boolean) =>
    folds.setCollapsed(
      entries.map((entry) => entry.id),
      next,
    );
  const toggle = (id: string) => {
    setFocused(entries.findIndex((entry) => entry.id === id));
    folds.setCollapsed([id], !collapsed.has(id));
  };

  const collapseControl =
    entries.length > 1 ? (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setAllCollapsed(!allCollapsed)}
      >
        {allCollapsed ? (
          <ChevronsUpDownIcon aria-hidden="true" data-icon="inline-start" />
        ) : (
          <ChevronsDownUpIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {allCollapsed ? 'Expand all' : 'Collapse all'}
      </Button>
    ) : null;
  const selectionAnchor =
    selection != null && composer == null && scope
      ? (() => {
          const entry = byId.get(selection.id);
          return entry?.comment
            ? rangeAnchor(entry.comment, selection.range)
            : null;
        })()
      : null;

  return (
    <div className="@container/code relative flex min-h-0 flex-1 flex-col">
      {rangeError ? (
        <p
          role="status"
          className="absolute bottom-3 left-3 z-10 rounded-lg border bg-popover p-2 text-xs"
        >
          {rangeError}
        </p>
      ) : (
        selectionAnchor != null && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-lg border bg-popover/95 px-2.5 py-1 text-xs text-popover-foreground shadow-md"
          >
            <MessageSquarePlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {basename(selectionAnchor.filePath)} ·{' '}
              {anchorLabel(selectionAnchor)}
            </span>
            {scope &&
              selectionAnchor.kind === 'codeRange' &&
              selectionAnchor.comparison?.kind === 'worktree' &&
              selectionAnchor.side !== 'deletions' &&
              (selectionAnchor.comparison.scope === 'staged' ||
                selectionAnchor.comparison.scope === 'unstaged') && (
                <span className="pointer-events-auto">
                  <DiscardButton
                    scope={scope}
                    path={selectionAnchor.filePath}
                    hunk={{
                      scope: selectionAnchor.comparison.scope,
                      startLine: selectionAnchor.startLine,
                      endLine: selectionAnchor.endLine,
                    }}
                    variant="compact"
                  />
                </span>
              )}
          </div>
        )
      )}
      {toolbar
        ? toolbar(collapseControl)
        : collapseControl && (
            <div className="flex shrink-0 justify-end px-3">
              {collapseControl}
            </div>
          )}
      {entries.length === 0 && header && (
        <div
          className="min-h-0 flex-1 overflow-auto"
          data-testid="empty-code-document"
        >
          {header()}
        </div>
      )}
      {entries.length > 0 && (
        <CodeView
          ref={viewer}
          items={items}
          selectedLines={selection}
          onSelectedLinesChange={(next) => {
            if (!composer) {
              setSelection(next);
              if (next)
                setFocused(entries.findIndex((entry) => entry.id === next.id));
            }
          }}
          renderAnnotation={(annotation) => {
            const note = annotation.metadata;
            if (!scope) return null;
            return note.kind === 'composer' ? (
              <InlineComposer
                key={JSON.stringify(note.anchor)}
                scope={scope}
                anchor={note.anchor}
                onClose={closeComposer}
              />
            ) : (
              <div className="m-3 font-sans">
                {note.stale && (
                  <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                    Code changed since this comment
                  </p>
                )}
                <ThreadCard scope={scope} thread={note.thread} />
              </div>
            );
          }}
          renderHeaderMetadata={(item) => {
            const entry = byId.get(item.id);
            if (disableFileHeader) return null;
            return (
              <div className="flex items-center gap-2">
                {headerActions}
                {entry?.review?.stale && (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-sans text-[10.5px] text-amber-800 dark:text-amber-200">
                    Changed since reviewed
                  </span>
                )}
                {entry?.comment && scope ? (
                  <button
                    type="button"
                    aria-label={`Comment on ${entry.path} (${entry.kind === 'diff' ? (entry.note ?? 'diff') : 'file'})`}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-sans text-xs text-muted-foreground hover:bg-accent"
                    onClick={() => openFileComment(entry)}
                  >
                    <MessageSquarePlusIcon className="size-3.5" />
                    Comment
                  </button>
                ) : null}
              </div>
            );
          }}
          options={options}
          className="min-h-0 flex-1 overflow-auto"
          {...(header ? { renderCodeViewHeader: header } : {})}
          renderHeaderPrefix={(item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
            const isCollapsed = collapsed.has(item.id);
            const review = entry.review;
            const control =
              review && firstReviewEntryByPath.get(review.path) === entry.id
                ? review.control
                : null;
            return (
              <span className="flex items-center gap-1">
                {entries.length > 1 && (
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${entry.path}`}
                    onClick={() => toggle(item.id)}
                    className="-ml-1 grid size-5 place-items-center rounded-md font-sans text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon className="size-3.5" />
                    ) : (
                      <ChevronDownIcon className="size-3.5" />
                    )}
                  </button>
                )}
                {control}
              </span>
            );
          }}
          renderHeaderFilenameSuffix={(item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
            return entry.note ? (
              <span
                className="ml-2 hidden max-w-48 truncate font-sans text-xs text-muted-foreground @min-[640px]/code:block"
                title={entry.note}
              >
                {entry.note}
              </span>
            ) : null;
          }}
        />
      )}
    </div>
  );
}
