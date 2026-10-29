import { TruncatedText } from '@/shared/views/truncated-text';
import { Link } from '@tanstack/react-router';
import { createPortal, flushSync } from 'react-dom';
import { BarAction } from '@/shared/workspace/bar-action';
import { CheckIcon, SquareIcon } from 'lucide-react';
import { AsyncResult } from 'effect/reactivity';
import type {
  FileDiffMetadata,
  CodeViewItem,
  CodeViewLineSelection,
  DiffLineAnnotation,
} from '@pierre/diffs';
import { CodeView, type CodeViewReactOptions } from '@pierre/diffs/react';
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  MessageSquareIcon,
  UserIcon,
  BotIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { ButtonGroup } from '@/components/ui/button-group';
import { toast } from '@/components/ui/toast';
import { DiscardButton } from '@/features/git-actions/index';
import {
  contentVersion,
  PIERRE_CHANGES_HEADER_CSS,
  PIERRE_COMMENT_CSS,
  PIERRE_FILE_CSS,
  PIERRE_DECISION_CSS,
  PIERRE_DECISION_THEME,
  PIERRE_HEADER_CSS,
  PIERRE_MARGIN_THREAD_CSS,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
} from '@/shared/lib/pierre';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  usePreferences,
  useSpecsApart,
  useTheme,
} from '@/features/preferences/index';
import { fileChangeBars } from '../adapters/file-changes';
import {
  type CodeEntry,
  codeTarget,
  type LineCounts,
  lineCounts,
} from '../adapters/code-entries';
import type { AgentCodeNote } from '../rules/code-notes';
import { useToggleReviewed } from '../commands/reviewed';
import { useComments } from '../queries/comments';
import { isFolded } from '../rules/code-folds';
import { groupSpecPaths, isSpecPath } from '@porcelain/client/reviews/rules';
import {
  anchorLabel,
  type FileCommentAnchor,
  type CommentThread,
  rangeAnchor,
} from '@porcelain/client/reviews/rules';
import type { DocumentInteraction } from '../rules/documents';
import { basename, type ReviewScope } from '@porcelain/client/reviews/rules';
import type { ReviewRange } from '@porcelain/client/reviews/rules';
import { useCodeFolds, useCodeViewScroll } from '../store';
import { revealMarginLine, useMarginStack } from '../adapters/margin-stack';
import {
  codeCommentMatches,
  codeCommentStale,
} from '../rules/retained-comments';
import { StateNotice } from '@/shared/views/state-notice';
import { InlineComposer, type InlineCommentDraft } from './inline-composer';
import { AgentNote } from './agent-note';
import { ThreadCard } from './thread-card';
import { headerButton, quietButton } from './review-controls';
import { MarginThreadLocation } from './margin-thread-location';
import { type ConnectionContext } from '@/shared/workspace/connection';

type Note =
  | ({ kind: 'agent' } & AgentCodeNote)
  | {
      kind: 'thread';
      lineNumber: number;
      side: 'additions' | 'deletions';
      threads: { thread: CommentThread; stale: boolean }[];
    }
  | { kind: 'composer'; anchor: FileCommentAnchor };
type Props = {
  onReview?: (entry: CodeEntry) => void;
  entries: readonly CodeEntry[];
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  header?: (controls: CodeHeaderControls) => ReactNode;
  footer?: () => ReactNode;
  emptyActions?: ReactNode;
  headerLeading?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
  commentRequest?: number;
  foundLine?: { line: number; nonce: number };
  compactThreads?: boolean;
  fileDiff?: FileDiffMetadata | undefined;
  disableFileHeader?: boolean;
  fullHeight?: boolean;
  collapsible?: boolean;
  range?: ReviewRange;
  threadMargin?: boolean;
  decision?: boolean;
  column?: boolean;
  commentLabel?: string;
  collapseInHeader?: boolean;
};
export type CodeHeaderControls = {
  collapse: ReactNode;
  current: string | undefined;
  counts: ReadonlyMap<string, LineCounts>;
  open: (path: string) => void;
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
        onToggleReviewed={
          props.onReview ?? ((entry) => review.toggle(entry.review))
        }
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
  emptyActions,
  toolbar,
  threads,
  commentRequest,
  foundLine,
  disableFileHeader = false,
  fileDiff,
  compactThreads = false,
  fullHeight = false,
  collapsible = false,
  threadMargin = false,
  decision = false,
  column = false,
  commentLabel,
  collapseInHeader = false,
  onToggleReviewed,
}: Props & {
  threads: readonly CommentThread[];
  onToggleReviewed: (entry: CodeEntry) => void;
}) {
  const { dark } = useTheme();
  const [expandedThreads, setExpandedThreads] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const { preferences } = usePreferences();
  const specsApart = useSpecsApart(gitContext.connection);
  const entries = decision ? given : groupSpecPaths(given, specsApart);
  const folds = useCodeFolds(interaction.worktreeId, interaction.entry);
  const viewer = useCodeViewScroll();
  const margin = useMarginStack();
  const [composer, setComposer] = useState<{
    id: string;
    anchor: FileCommentAnchor;
    draft: InlineCommentDraft;
  } | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(
    null,
  );
  const [focusedId, setFocusedId] = useState<CodeEntry['id']>();
  const focused = Math.max(
    entries.findIndex((entry) => entry.id === focusedId),
    0,
  );
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
                specsApart &&
                isSpecPath(entry.path)),
          ),
      )
      .map((entry) => entry.id),
  );
  const openFileComment = (entry: CodeEntry | undefined) => {
    if (!entry?.comment) return;
    setFocusedId(entry.id);
    setComposer({
      id: entry.id,
      anchor: { ...entry.comment, kind: 'file' },
      draft: { body: '' },
    });
    setSelection(null);
  };
  const closeComposer = () => {
    setComposer(null);
    setSelection(null);
  };
  const [handledComment, setHandledComment] = useState<number>();
  if (commentRequest !== undefined && handledComment !== commentRequest) {
    setHandledComment(commentRequest);
    openFileComment(entries[0]);
  }
  const [handledFound, setHandledFound] = useState<number>();
  const [handledReveal, setHandledReveal] = useState<number>();
  const reveal = interaction.reveal;
  const revealEntry =
    reveal &&
    entries.find(
      (entry) =>
        entry.comment &&
        codeCommentMatches(
          reveal.anchor,
          entry.comment,
          scope.review !== undefined,
        ),
    );
  const focusEntry = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    setFocusedId(entry.id);
    viewer.scrollTo({ type: 'item', id: entry.id, align: 'start' });
  };
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const items: CodeViewItem<Note>[] = entries.map((entry) => {
    const target = entry.comment;
    const notes: Note[] = [];
    const lines = new Map<string, Extract<Note, { kind: 'thread' }>>();
    const placed = target
      ? threads
          .filter(
            (thread) =>
              codeCommentMatches(
                thread.anchor,
                target,
                scope.review !== undefined,
              ) &&
              (thread.anchor.comparison ||
                entries.find(
                  (candidate) =>
                    candidate.comment &&
                    codeCommentMatches(
                      thread.anchor,
                      candidate.comment,
                      scope.review !== undefined,
                    ),
                )?.id === entry.id),
          )
          .map((thread) => ({
            thread,
            stale: codeCommentStale(
              thread.anchor,
              target,
              scope.review && {
                revision: scope.review.revision,
                commentRevision: thread.review?.revision,
                kind: entry.kind,
              },
            ),
          }))
      : [];
    for (const item of placed) {
      const anchor = item.thread.anchor;
      const lineNumber =
        anchor.kind === 'codeRange' && !item.stale ? anchor.endLine : 0;
      const side =
        anchor.kind === 'codeRange'
          ? (anchor.side ?? 'additions')
          : 'additions';
      const key = lineNumber === 0 ? item.thread.id : `${side}:${lineNumber}`;
      const line = lines.get(key);
      if (line) line.threads.push(item);
      else {
        const note = {
          kind: 'thread' as const,
          lineNumber,
          side,
          threads: [item],
        };
        lines.set(key, note);
        notes.push(note);
      }
    }
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
      if (note.kind === 'thread')
        return { lineNumber: note.lineNumber, side: note.side, metadata: note };
      const anchor = note.anchor;
      return anchor.kind === 'codeRange'
        ? {
            lineNumber: anchor.endLine,
            side: anchor.side ?? 'additions',
            metadata: note,
          }
        : { lineNumber: 0, side: 'additions', metadata: note };
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
    theme:
      decision || column || compactThreads
        ? PIERRE_DECISION_THEME
        : PIERRE_THEME,
    themeType: dark ? 'dark' : 'light',
    overflow: preferences.lineOverflow,
    diffStyle: preferences.diffStyle,
    diffIndicators: 'classic',
    hunkSeparators: 'line-info',
    stickyHeaders: !disableFileHeader && !fullHeight,
    disableFileHeader,
    enableLineSelection: true,
    enableGutterUtility: true,
    onLineClick: (_, context) => setFocusedId(context.item.id),
    onLineNumberClick: (_, context) => setFocusedId(context.item.id),
    onGutterUtilityClick: (range, context) => {
      const entry = byId.get(context.item.id);
      if (!entry?.comment) return;
      const anchor = rangeAnchor(entry.comment, range);
      if (!anchor) {
        setRangeError('Select lines on one side of the comparison.');
        return;
      }
      setFocusedId(entry.id);
      setRangeError(null);
      setComposer({ id: entry.id, anchor, draft: { body: '' } });
      setSelection({ id: entry.id, range });
    },
    lineHoverHighlight: 'number',
    unsafeCSS: `${compactThreads ? '[data-line-annotation]:has([data-file-thread-marker]) { margin-left: 0; }' : ''}${fileChangeBars(fileDiff)}${decision || column ? PIERRE_DECISION_CSS : ''}${column ? PIERRE_CHANGES_HEADER_CSS : ''}${PIERRE_SURFACE_CSS}${PIERRE_COMMENT_CSS}${threadMargin ? PIERRE_MARGIN_THREAD_CSS : ''}${disableFileHeader ? '[data-code] { padding-top: 0 !important; }' : PIERRE_HEADER_CSS}${compactThreads ? PIERRE_FILE_CSS : ''}`,
    ...(column
      ? { itemMetrics: { lineHeight: 22, diffHeaderHeight: 41 } }
      : {}),
    ...(disableFileHeader ? { itemMetrics: { paddingTop: 0 } } : {}),
    layout: {
      paddingTop: disableFileHeader ? 0 : 12,
      paddingBottom: fullHeight || footer ? 12 : 160,
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
    setFocusedId(id);
    folds.setCollapsed([id], !collapsed.has(id));
  };

  const collapseIcon = allCollapsed ? (
    <ChevronsUpDownIcon aria-hidden="true" data-icon="inline-start" />
  ) : (
    <ChevronsDownUpIcon aria-hidden="true" data-icon="inline-start" />
  );
  const collapseLabel = allCollapsed ? 'Expand all' : 'Collapse all';
  const collapseButton = collapseInHeader ? (
    <button
      type="button"
      className={headerButton}
      aria-label={collapseLabel}
      onClick={() => setAllCollapsed(!allCollapsed)}
    >
      {collapseIcon}
      <span className="max-narrow:sr-only">{collapseLabel}</span>
    </button>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setAllCollapsed(!allCollapsed)}
    >
      {collapseIcon}
      {collapseLabel}
    </Button>
  );
  const collapseControl = entries.length > 1 ? collapseButton : null;
  const paneFile =
    interaction.toolbarTarget !== undefined &&
    /^(file|review-file|review-change|change|branch):/.test(interaction.entry);
  const focusedEntry = entries[focused] ?? entries[0];
  const paneActions =
    paneFile &&
    (focusedEntry ? (
      <>
        <BarAction
          label="Reviewed"
          variant="outline"
          icon={focusedEntry?.review?.reviewed ? CheckIcon : SquareIcon}
          shortcut={SHORTCUTS.toggleReviewed}
          disabled={!focusedEntry?.review?.fingerprint}
          pressed={focusedEntry?.review?.reviewed}
          onClick={() => {
            if (focusedEntry) onToggleReviewed(focusedEntry);
          }}
        />
        <BarAction
          label="Comment"
          icon={MessageSquarePlusIcon}
          shortcut={SHORTCUTS.commentOnFile}
          disabled={!focusedEntry?.comment}
          onClick={() => openFileComment(focusedEntry)}
        />
        {headerActions}
      </>
    ) : (
      (emptyActions ?? headerActions)
    ));
  const renderHeader =
    header &&
    (() =>
      header({
        collapse: collapseControl,
        current: entries[focused]?.path,
        counts: lineCounts(entries),
        open: (path) => {
          const index = entries.findIndex((entry) => entry.path === path);
          const entry = entries[index];
          if (entry) folds.setCollapsed([entry.id], false);
          focusEntry(index);
        },
      }));
  const selectionAnchor = selectedRangeAnchor(
    selection,
    composer !== null && composer !== undefined,
    byId,
  );

  return (
    <div
      className={cn(
        '@container/code relative flex min-h-0 flex-1 flex-col',
        (decision || column || compactThreads) && 'decision-code',
        compactThreads && 'file-code',
      )}
    >
      {interaction.toolbarTarget &&
        paneActions &&
        createPortal(paneActions, interaction.toolbarTarget)}
      {interaction.active && entries.length > 0 && (
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
            <TruncatedText
              className="pointer-events-auto"
              text={`${basename(selectionAnchor.filePath)} · ${anchorLabel(selectionAnchor)}`}
            />
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
        : !column &&
          !collapseInHeader &&
          collapseControl && (
            <div className="flex shrink-0 justify-end px-3">
              {collapseControl}
            </div>
          )}
      {entries.length === 0 && (header || headerActions || footer) && (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-auto',
            column && COLUMN_GUTTERS,
          )}
          data-testid="empty-code-document"
        >
          {headerLeading && (
            <div className="flex items-center gap-1 px-3.5 py-2">
              {headerLeading}
            </div>
          )}
          {renderHeader?.()}
          {footer?.()}
          {!paneFile && headerActions && (
            <div className="flex justify-end px-3.5 py-2">
              <ButtonGroup>{headerActions}</ButtonGroup>
            </div>
          )}
        </div>
      )}
      {entries.length > 0 && (
        <CodeView
          ref={(handle) => {
            if (!handle) return;
            const release = viewer.attach(handle);
            if (
              reveal &&
              revealEntry &&
              handledReveal !== reveal.nonce &&
              collapsed.has(revealEntry.id)
            ) {
              folds.setCollapsed([revealEntry.id], false);
              return release;
            }
            const frame = requestAnimationFrame(() => {
              const entry = entries[0];
              if (foundLine && entry && handledFound !== foundLine.nonce) {
                setSelection({
                  id: entry.id,
                  range: { start: foundLine.line, end: foundLine.line },
                });
                handle.scrollTo({
                  type: 'line',
                  id: entry.id,
                  lineNumber: foundLine.line,
                  align: 'center',
                });
                setHandledFound(foundLine.nonce);
              }
              if (reveal && revealEntry && handledReveal !== reveal.nonce) {
                const anchor = reveal.anchor;
                const stale =
                  revealEntry.comment &&
                  codeCommentStale(
                    anchor,
                    revealEntry.comment,
                    scope.review && {
                      revision: scope.review.revision,
                      commentRevision: threads.find(
                        (thread) => thread.anchor === anchor,
                      )?.review?.revision,
                      kind: revealEntry.kind,
                    },
                  );
                handle.scrollTo(
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
                setFocusedId(revealEntry.id);
                setHandledReveal(reveal.nonce);
              }
            });
            return () => {
              cancelAnimationFrame(frame);
              release?.();
            };
          }}
          items={items}
          selectedLines={selection}
          onSelectedLinesChange={(next) => {
            if (!composer) {
              setSelection(next);
              if (next) setFocusedId(next.id);
            }
          }}
          renderAnnotation={(...[annotation, , item]) => {
            const note = annotation.metadata;
            if (note.kind === 'agent')
              return (
                <AgentNote
                  compact={decision}
                  title={note.title}
                  text={note.text}
                  stale={note.stale}
                  {...(note.marker ? { marker: note.marker } : {})}
                  {...(note.tone ? { tone: note.tone } : {})}
                />
              );
            if (
              note.kind === 'thread' &&
              note.threads.every(({ stale }) => !stale) &&
              compactThreads &&
              item.type === 'file' &&
              !expandedThreads.has(`${item.id}:${note.lineNumber}`)
            )
              return (
                <button
                  type="button"
                  data-file-thread-marker=""
                  aria-expanded={false}
                  className="ml-3 flex h-8 w-[calc(100%-var(--spacing)*5.5)] items-center gap-2 bg-brand-soft pr-3 pl-2.5 text-left font-sans text-xs font-medium text-brand hover:underline"
                  onClick={() =>
                    setExpandedThreads(
                      (current) =>
                        new Set([...current, `${item.id}:${note.lineNumber}`]),
                    )
                  }
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex shrink-0 items-center"
                  >
                    <span className="grid size-4.5 place-items-center rounded-full bg-foreground text-background">
                      <UserIcon className="size-3" />
                    </span>
                    {note.threads.some(({ thread }) =>
                      thread.messages.some(
                        (message) => message.author === 'agent',
                      ),
                    ) && (
                      <span className="-ml-1 grid size-4.5 place-items-center rounded-[--spacing(1)] border bg-card text-foreground">
                        <BotIcon className="size-2.5" />
                      </span>
                    )}
                  </span>
                  {note.threads.length}{' '}
                  {note.threads.length === 1 ? 'comment' : 'comments'}
                  {note.threads.some(({ thread }) =>
                    thread.messages.some(
                      (message) => message.author === 'agent',
                    ),
                  ) && ' · Agent replied'}
                  <ChevronRightIcon className="size-3" />
                </button>
              );
            return note.kind === 'composer' ? (
              composer && composer.anchor === note.anchor && (
                <InlineComposer
                  key={JSON.stringify(note.anchor)}
                  scope={scope}
                  context={gitContext}
                  anchor={note.anchor}
                  draft={composer.draft}
                  onDraftChange={(draft) =>
                    setComposer((current) =>
                      current?.anchor === note.anchor
                        ? { ...current, draft }
                        : current,
                    )
                  }
                  onClose={closeComposer}
                />
              )
            ) : (
              <div
                {...(threadMargin && note.lineNumber > 0
                  ? { ref: margin.card }
                  : {})}
                className={cn(
                  'm-3 flex flex-col gap-3 font-sans',
                  threadMargin &&
                    note.lineNumber > 0 &&
                    '@5xl/review:absolute @5xl/review:left-full @5xl/review:z-10 @5xl/review:my-0 @5xl/review:mr-0 @5xl/review:ml-7 @5xl/review:w-51',
                )}
              >
                {compactThreads &&
                  item.type === 'file' &&
                  expandedThreads.has(`${item.id}:${note.lineNumber}`) && (
                    <button
                      type="button"
                      aria-expanded={true}
                      className="self-start text-xs font-medium text-brand hover:underline"
                      onClick={() =>
                        setExpandedThreads(
                          (current) =>
                            new Set(
                              [...current].filter(
                                (key) =>
                                  key !== `${item.id}:${note.lineNumber}`,
                              ),
                            ),
                        )
                      }
                    >
                      Collapse comments on line {note.lineNumber}
                    </button>
                  )}
                {note.threads.map(({ thread, stale }) => (
                  <div key={thread.id} className="group/margin-thread">
                    {stale && !thread.review && (
                      <p className="mb-2 text-xs text-graph-4">
                        Code changed since this comment
                      </p>
                    )}
                    {stale && thread.review && (
                      <StateNotice
                        role="status"
                        title="Code changed since this comment"
                        description={`Written on r${thread.review.revision}. Read the original code before acting on this thread.`}
                      >
                        <Link
                          to="/reviews/$reviewId/$revision"
                          params={{
                            reviewId: thread.review.reviewId,
                            revision: String(thread.review.revision),
                          }}
                          search={(previous) => ({
                            environment: previous.environment,
                            decision: undefined,
                          })}
                          className={cn(
                            buttonVariants({
                              variant: 'outline',
                              size: 'xs',
                            }),
                          )}
                        >
                          Open r{thread.review.revision}
                        </Link>
                      </StateNotice>
                    )}
                    <ThreadCard
                      scope={scope}
                      context={gitContext}
                      thread={thread}
                      {...(threadMargin &&
                      note.lineNumber > 0 &&
                      thread.anchor.kind === 'codeRange'
                        ? {
                            location: (
                              <MarginThreadLocation
                                anchor={thread.anchor}
                                onReveal={(control) => {
                                  const anchor = thread.anchor;
                                  if (anchor.kind !== 'codeRange') return;
                                  const side =
                                    item.type === 'diff'
                                      ? { side: anchor.side ?? 'additions' }
                                      : {};
                                  flushSync(() => {
                                    setSelection({
                                      id: item.id,
                                      range: {
                                        start: anchor.startLine,
                                        end: anchor.endLine,
                                        ...side,
                                      },
                                    });
                                    setFocusedId(item.id);
                                  });
                                  revealMarginLine(control);
                                }}
                              />
                            ),
                          }
                        : {})}
                    />
                  </div>
                ))}
              </div>
            );
          }}
          renderHeaderMetadata={(item) => {
            const entry = byId.get(item.id);
            if (disableFileHeader || !entry) return null;
            const first = item.id === entries[0]?.id;
            const index = entries.findIndex((entry) => entry.id === item.id);
            const actions = !paneFile && first ? headerActions : null;
            const collapseAll =
              collapseInHeader && first ? collapseControl : null;
            const steps =
              decision && entries.length > 1 ? (
                <>
                  <HeaderStep
                    label="Previous file"
                    keys={SHORTCUTS.previousFile}
                    disabled={index === 0}
                    onClick={() => focusEntry(index - 1)}
                  >
                    <ChevronUpIcon />
                  </HeaderStep>
                  <HeaderStep
                    label="Next file"
                    keys={SHORTCUTS.nextFile}
                    disabled={index === entries.length - 1}
                    onClick={() => focusEntry(index + 1)}
                  >
                    <ChevronDownIcon />
                  </HeaderStep>
                </>
              ) : null;
            const leading = item.id === entries[0]?.id ? headerLeading : null;
            const stale = entry.review?.stale ? (
              <span className="rounded-md bg-graph-4/15 px-1.5 py-0.5 font-sans text-2xs text-graph-4">
                Changed since reviewed
              </span>
            ) : null;
            const commentName = commentLabel
              ? `${commentLabel} about ${entry.path}`
              : `Comment on ${entry.path} (${entry.kind === 'diff' ? (entry.note ?? 'diff') : 'file'})`;
            const commentButton = decision ? (
              <button
                type="button"
                className={headerButton}
                aria-label={commentName}
                onClick={() => openFileComment(entry)}
              >
                <MessageSquareIcon />
                <span className="max-narrow:sr-only">
                  {commentLabel ?? 'Comment'}
                </span>
              </button>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                aria-label={commentName}
                onClick={() => openFileComment(entry)}
              >
                <MessageSquarePlusIcon />
                <span className="max-narrow:sr-only">
                  {commentLabel ?? 'Comment'}
                </span>
              </Button>
            );
            const comment =
              entry.comment && !paneFile && !column ? commentButton : null;
            if (column)
              return (
                <span className="flex items-center gap-1.5">
                  {stale}
                  <span className="ml-1 flex h-4 items-center gap-2 border-l border-border-strong pl-2 text-muted-foreground">
                    <FileHeaderAction
                      label="Previous file"
                      icon={ChevronUpIcon}
                      shortcut={SHORTCUTS.previousFile}
                      onClick={() =>
                        focusEntry(
                          Math.max(
                            entries.findIndex(
                              (candidate) => candidate.id === entry.id,
                            ) - 1,
                            0,
                          ),
                        )
                      }
                    />
                    <FileHeaderAction
                      label="Next file"
                      icon={ChevronDownIcon}
                      shortcut={SHORTCUTS.nextFile}
                      onClick={() =>
                        focusEntry(
                          Math.min(
                            entries.findIndex(
                              (candidate) => candidate.id === entry.id,
                            ) + 1,
                            entries.length - 1,
                          ),
                        )
                      }
                    />
                  </span>
                </span>
              );
            if (
              !stale &&
              !leading &&
              !actions &&
              !comment &&
              !steps &&
              !collapseAll
            )
              return null;
            return (
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                {stale}
                {leading}
                {decision ? (
                  <>
                    {actions && <ButtonGroup>{actions}</ButtonGroup>}
                    {comment}
                  </>
                ) : (
                  (actions || comment) && (
                    <ButtonGroup>
                      {actions}
                      {comment}
                    </ButtonGroup>
                  )
                )}
                {collapseAll}
                {steps && (
                  <span className="flex items-center max-narrow:hidden">
                    {steps}
                  </span>
                )}
              </div>
            );
          }}
          disableWorkerPool={decision || column || compactThreads}
          options={options}
          {...(margin.reserve > 0
            ? { style: { paddingBottom: margin.reserve } }
            : {})}
          className={cn(
            fullHeight
              ? 'flex-none overflow-visible'
              : 'min-h-0 flex-1 overflow-auto',
            column && COLUMN_GUTTERS,
          )}
          {...(renderHeader ? { renderCodeViewHeader: renderHeader } : {})}
          {...(footer ? { renderCodeViewFooter: footer } : {})}
          renderHeaderPrefix={(item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
            const isCollapsed = collapsed.has(item.id);
            const review = entry.review;
            const control =
              review &&
              !paneFile &&
              firstReviewEntryByPath.get(review.path) === entry.id
                ? review.control
                : null;
            return (
              <span
                className={cn('flex items-center', column ? 'gap-2' : 'gap-1')}
              >
                {!decision &&
                  specsApart &&
                  item.id === firstSpecId &&
                  entries.length > specEntries.length && (
                    <span className="mr-2 border-r pr-2 font-sans text-xs font-medium">
                      Specs · {specCount} {specCount === 1 ? 'file' : 'files'}
                    </span>
                  )}
                {column ? (
                  <FileHeaderAction
                    label={`${isCollapsed ? 'Expand' : 'Collapse'} ${entry.path}`}
                    icon={isCollapsed ? ChevronRightIcon : ChevronDownIcon}
                    expanded={!isCollapsed}
                    onClick={() => toggle(item.id)}
                  />
                ) : (
                  (collapsible || entries.length > 1) && (
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
                  )
                )}
                {control}
              </span>
            );
          }}
          renderHeaderFilenameSuffix={(item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
            if (column && entry.comment) {
              const label = `Comment on ${entry.path} (${entry.kind === 'diff' ? (entry.note ?? 'diff') : 'file'})`;
              return (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={label}
                        onClick={() => openFileComment(entry)}
                        className="ml-2 min-w-0 shrink"
                      />
                    }
                  >
                    <TruncatedText
                      className="hidden max-w-48 @code-wide/code:block"
                      text={entry.note ?? 'file'}
                    />
                    <MessageSquarePlusIcon className="@code-wide/code:hidden" />
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            }
            return entry.note ? (
              <TruncatedText
                className="ml-2 hidden max-w-48 font-sans text-xs text-muted-foreground @code-wide/code:block"
                text={entry.note}
              />
            ) : null;
          }}
        />
      )}
    </div>
  );
}

const COLUMN_GUTTERS =
  'px-[max(--spacing(4),calc((100%-var(--container-reading))/2))] @2xl/pane:px-[max(--spacing(7),calc((100%-var(--container-reading))/2))]';

function HeaderStep({
  label,
  keys,
  disabled,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={`${quietButton} size-6 text-muted-foreground [&_svg]:size-3.5`}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} <Kbd>{formatForDisplay(keys)}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function selectedRangeAnchor(
  selection: CodeViewLineSelection | null,
  composing: boolean,
  byId: ReadonlyMap<string, CodeEntry>,
) {
  if (selection === null || selection === undefined || composing) return null;
  const entry = byId.get(selection.id);
  return entry?.comment ? rangeAnchor(entry.comment, selection.range) : null;
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

function FileHeaderAction({
  label,
  icon: Icon,
  shortcut,
  expanded,
  onClick,
}: {
  label: string;
  icon: typeof ChevronUpIcon;
  shortcut?: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={label}
            aria-keyshortcuts={shortcut}
            aria-expanded={expanded}
            onClick={onClick}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <Kbd>{formatForDisplay(shortcut)}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
