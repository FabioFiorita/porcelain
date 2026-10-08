import { AsyncResult } from 'effect/reactivity';
import type {
  CodeViewItem,
  CodeViewLineSelection,
  DiffLineAnnotation,
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
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { toast } from '@/components/ui/toast';
import { DiscardButton } from '@/features/git-actions/index';
import {
  contentVersion,
  PIERRE_COMMENT_CSS,
  PIERRE_HEADER_CSS,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
} from '@/shared/lib/pierre';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import { usePreferences, useTheme } from '@/features/preferences/index';
import {
  type CodeEntry,
  type AgentCodeNote,
  codeTarget,
} from '../adapters/code-entries';
import { useToggleReviewed } from '../commands/reviewed';
import { useComments } from '../queries/comments';
import { isFolded } from '../rules/code-folds';
import { groupSpecPaths, isSpecPath } from '@porcelain/client/reviews/rules';
import {
  anchorLabel,
  commentIsStale,
  type FileCommentAnchor,
  type CommentThread,
  matchesCommentTarget,
  rangeAnchor,
} from '@porcelain/client/reviews/rules';
import type { DocumentInteraction } from '../rules/documents';
import { basename, type ReviewScope } from '@porcelain/client/reviews/rules';
import type { ReviewRange } from '@porcelain/client/reviews/rules';
import { useCodeFolds } from '../store';
import { InlineComposer } from './inline-composer';
import { AgentNote } from './agent-note';
import { ThreadCard } from './thread-card';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Note =
  | ({ kind: 'agent' } & AgentCodeNote)
  | { kind: 'thread'; thread: CommentThread; stale: boolean }
  | { kind: 'composer'; anchor: FileCommentAnchor };
type Props = {
  entries: readonly CodeEntry[];
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  header?: () => ReactNode;
  footer?: () => ReactNode;
  headerLeading?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
  commentRequest?: number;
  foundLine?: { line: number; nonce: number };
  disableFileHeader?: boolean;
  fullHeight?: boolean;
  collapsible?: boolean;
  range?: ReviewRange;
};
export function CodeDocument(props: Props) {
  const { threads, result } = useComments(props.scope, props.context);
  const review = useToggleReviewed(
    props.scope,
    props.context,
    (notice) => toast.add(notice),
    props.range,
  );
  return (
    <>
      {AsyncResult.isFailure(result) && (
        <p role="alert" className="px-3 text-xs text-destructive">
          Comments could not be refreshed.
        </p>
      )}
      <CodeSurface
        {...props}
        threads={threads}
        onToggleReviewed={(entry) => review.toggle(entry.review)}
      />
    </>
  );
}
function CodeSurface({
  entries: given,
  scope,
  context: gitContext,
  interaction,
  header,
  footer,
  headerLeading,
  headerActions,
  toolbar,
  threads,
  commentRequest,
  foundLine,
  disableFileHeader = false,
  fullHeight = false,
  collapsible = false,
  onToggleReviewed,
}: Props & {
  threads: readonly CommentThread[];
  onToggleReviewed: (entry: CodeEntry) => void;
}) {
  const { dark } = useTheme();
  const { preferences } = usePreferences();
  const entries = groupSpecPaths(given, preferences.collapseSpecs);
  const folds = useCodeFolds(interaction.worktreeId, interaction.entry);
  const viewer = useRef<CodeViewHandle<Note, undefined>>(null);
  const [composer, setComposer] = useState<{
    id: string;
    anchor: FileCommentAnchor;
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
          isFolded(
            folds.folds,
            entry.id,
            (entries.length > 1 && entry.review?.reviewed === true) ||
              ((collapsible || entries.length > 1) &&
                preferences.collapseSpecs &&
                isSpecPath(entry.path)),
          ),
      )
      .map((entry) => entry.id),
  );
  const openFileComment = (entry: CodeEntry | undefined) => {
    if (!entry?.comment) return;
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
  const handledFound = useRef<number | undefined>(undefined);
  useEffect(() => {
    const entry = entries[0];
    if (!foundLine || !entry || handledFound.current === foundLine.nonce)
      return;
    handledFound.current = foundLine.nonce;
    const range = { start: foundLine.line, end: foundLine.line };
    setSelection({ id: entry.id, range });
    viewer.current?.scrollTo({
      type: 'line',
      id: entry.id,
      lineNumber: foundLine.line,
      align: 'center',
    });
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
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
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
    for (const note of entry.agentNotes ?? [])
      notes.push({ ...note, kind: 'agent' });
    if (composer?.id === entry.id)
      notes.push({ kind: 'composer', anchor: composer.anchor });
    const annotations = notes.map((note): DiffLineAnnotation<Note> => {
      if (note.kind === 'agent')
        return {
          lineNumber: note.stale ? 0 : note.line,
          side: 'additions',
          metadata: note,
        };
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
    return { ...shared, ...codeTarget(entry) };
  });
  const specEntries = entries.filter((entry) => isSpecPath(entry.path));
  const specCount = new Set(specEntries.map((entry) => entry.path)).size;
  const firstSpecId = specEntries[0]?.id;
  const firstReviewEntryByPath = new Map<string, string>();
  for (const entry of entries) {
    if (entry.review && !firstReviewEntryByPath.has(entry.review.path))
      firstReviewEntryByPath.set(entry.review.path, entry.id);
  }
  const options: CodeViewReactOptions<Note, undefined> = {
    theme: PIERRE_THEME,
    themeType: dark ? 'dark' : 'light',
    overflow: preferences.lineOverflow,
    diffStyle: preferences.diffStyle,
    diffIndicators: 'classic',
    hunkSeparators: 'line-info',
    stickyHeaders: !disableFileHeader && !fullHeight,
    disableFileHeader,
    enableLineSelection: true,
    enableGutterUtility: true,
    onLineClick: (_, context) =>
      setFocused(entries.findIndex((entry) => entry.id === context.item.id)),
    onLineNumberClick: (_, context) =>
      setFocused(entries.findIndex((entry) => entry.id === context.item.id)),
    onGutterUtilityClick: (range, context) => {
      const entry = byId.get(context.item.id);
      if (!entry?.comment) return;
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
    unsafeCSS: `${PIERRE_SURFACE_CSS}${PIERRE_COMMENT_CSS}${disableFileHeader ? '[data-code] { padding-top: 0 !important; }' : PIERRE_HEADER_CSS}`,
    ...(disableFileHeader ? { itemMetrics: { paddingTop: 0 } } : {}),
    layout: {
      paddingTop: disableFileHeader ? 0 : 12,
      paddingBottom: fullHeight ? 12 : 160,
      gap: 12,
    },
  };
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
    selection !== null &&
    selection !== undefined &&
    (composer === null || composer === undefined)
      ? (() => {
          const entry = byId.get(selection.id);
          return entry?.comment
            ? rangeAnchor(entry.comment, selection.range)
            : null;
        })()
      : null;

  return (
    <div className="@container/code relative flex min-h-0 flex-1 flex-col">
      {interaction.active && (
        <CodeShortcuts
          next={() => focusEntry(Math.min(focused + 1, entries.length - 1))}
          previous={() => focusEntry(Math.max(focused - 1, 0))}
          comment={() => openFileComment(entries[focused])}
          review={() => {
            const entry = entries[focused];
            if (entry) onToggleReviewed(entry);
          }}
        />
      )}
      {rangeError ? (
        <p
          role="status"
          className="absolute bottom-3 left-3 z-10 rounded-lg border bg-popover p-2 text-xs"
        >
          {rangeError}
        </p>
      ) : (
        selectionAnchor !== null &&
        selectionAnchor !== undefined && (
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
            {selectionAnchor.kind === 'codeRange' &&
              selectionAnchor.comparison?.kind === 'worktree' &&
              selectionAnchor.side !== 'deletions' &&
              (selectionAnchor.comparison.scope === 'staged' ||
                selectionAnchor.comparison.scope === 'unstaged') && (
                <span className="pointer-events-auto">
                  <DiscardButton
                    scope={scope}
                    context={gitContext}
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
      {entries.length === 0 && (header || headerActions || footer) && (
        <div
          className="min-h-0 flex-1 overflow-auto"
          data-testid="empty-code-document"
        >
          {header?.()}
          {footer?.()}
          {headerActions && (
            <div className="flex justify-end px-3.5 py-2">
              <ButtonGroup>{headerActions}</ButtonGroup>
            </div>
          )}
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
            if (note.kind === 'agent')
              return (
                <AgentNote
                  title={note.title}
                  text={note.text}
                  stale={note.stale}
                />
              );
            return note.kind === 'composer' ? (
              <InlineComposer
                key={JSON.stringify(note.anchor)}
                scope={scope}
                context={gitContext}
                anchor={note.anchor}
                onClose={closeComposer}
              />
            ) : (
              <div className="m-3 font-sans">
                {note.stale && (
                  <p className="mb-2 text-xs text-graph-4">
                    Code changed since this comment
                  </p>
                )}
                <ThreadCard
                  scope={scope}
                  context={gitContext}
                  thread={note.thread}
                />
              </div>
            );
          }}
          renderHeaderMetadata={(item) => {
            const entry = byId.get(item.id);
            if (disableFileHeader || !entry) return null;
            const actions = item.id === entries[0]?.id ? headerActions : null;
            const leading = item.id === entries[0]?.id ? headerLeading : null;
            const stale = entry.review?.stale ? (
              <span className="rounded-md bg-graph-4/15 px-1.5 py-0.5 font-sans text-2xs text-graph-4">
                Changed since reviewed
              </span>
            ) : null;
            const comment = entry.comment ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Comment on ${entry.path} (${entry.kind === 'diff' ? (entry.note ?? 'diff') : 'file'})`}
                onClick={() => openFileComment(entry)}
              >
                <MessageSquarePlusIcon />
                <span className="max-narrow:sr-only">Comment</span>
              </Button>
            ) : null;
            if (!stale && !leading && !actions && !comment) return null;
            return (
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                {stale}
                {leading}
                {(actions || comment) && (
                  <ButtonGroup>
                    {actions}
                    {comment}
                  </ButtonGroup>
                )}
              </div>
            );
          }}
          options={options}
          className={
            fullHeight
              ? 'flex-none overflow-visible'
              : 'min-h-0 flex-1 overflow-auto'
          }
          {...(header ? { renderCodeViewHeader: header } : {})}
          {...(footer ? { renderCodeViewFooter: footer } : {})}
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
                {preferences.collapseSpecs &&
                  item.id === firstSpecId &&
                  entries.length > specEntries.length && (
                    <span className="mr-2 border-r pr-2 font-sans text-xs font-medium">
                      Specs · {specCount} files
                    </span>
                  )}
                {(collapsible || entries.length > 1) && (
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
                className="ml-2 hidden max-w-48 truncate font-sans text-xs text-muted-foreground @code-wide/code:block"
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

function CodeShortcuts({
  next,
  previous,
  comment,
  review,
}: {
  next: () => void;
  previous: () => void;
  comment: () => void;
  review: () => void;
}) {
  const options = { ignoreInputs: true };
  useHotkey(SHORTCUTS.nextFile, next, options);
  useHotkey(SHORTCUTS.previousFile, previous, options);
  useHotkey(SHORTCUTS.commentOnFile, comment, options);
  useHotkey(SHORTCUTS.toggleReviewed, review, options);
  return null;
}
