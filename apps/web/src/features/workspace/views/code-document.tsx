import { TruncatedText } from '@/shared/views/truncated-text';

import { createPortal } from 'react-dom';
import { BarAction } from '@/shared/workspace/bar-action';
import { CheckIcon, SquareIcon } from 'lucide-react';
import type {
  FileDiffMetadata,
  CodeViewItem,
  CodeViewLineSelection,
} from '@pierre/diffs';
import { DEFAULT_VIRTUAL_FILE_METRICS } from '@pierre/diffs';
import type { CodeViewReactOptions } from '@pierre/diffs/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { ButtonGroup } from '@/components/ui/button-group';
import { notify } from '@/shared/views/notify';
import { DiscardButton } from '@/features/git-actions/index';
import {
  contentVersion,
  PIERRE_CHANGES_HEADER_CSS,
  PIERRE_FILE_CSS,
  PIERRE_DECISION_CSS,
  PIERRE_DECISION_THEME,
  PIERRE_HEADER_CSS,
  PIERRE_SURFACE_CSS,
  PIERRE_THEME,
  PIERRE_HIGHLIGHTER,
  PIERRE_COMMENT_CSS,
} from '@/shared/lib/pierre';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  usePreferences,
  useSpecsApart,
  useTheme,
} from '@/features/preferences/index';
import { fileChangeBars } from '../adapters/file-changes';
import { PierreCodeView as CodeView } from '../adapters/pierre-workers';
import {
  type CodeEntry,
  codeTarget,
  type LineCounts,
  lineCounts,
  entryLineCounts,
} from '../adapters/code-entries';

import { useToggleReviewed } from '../commands/reviewed';
import { ChangeCounts } from './change-counts';
import { isFolded } from '../rules/code-folds';
import { discardSelection } from '../rules/discard-selection';
import { counted } from '@porcelain/client/changes/rules';
import { groupSpecPaths, isSpecPath } from '@porcelain/client/changes/rules';
import type { DocumentInteraction } from '../rules/documents';
import { type ReviewScope } from '@porcelain/client/changes/rules';
import type { ReviewRange } from '@porcelain/client/changes/rules';
import { useCodeFolds, useCodeViewScroll, usePublishDiffFocus } from '../store';

import { type ConnectionContext } from '@/shared/workspace/connection';
import {
  CommentThread,
  commentRange,
  diffLineText,
  fileLineText,
  useComments,
  type LineRange,
} from '@/features/comments/index';
import type { DraftComment } from '@porcelain/client/comments/rules';

type CommentNote = {
  side: LineRange['side'];
  line: number;
  drafts: DraftComment[];
  composing?: LineRange;
};

type Props = {
  onReview?: (entry: CodeEntry) => void;
  entries: readonly CodeEntry[];
  listed?: readonly ListedComparison[];
  paths?: readonly string[];
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  header?: (controls: CodeHeaderControls) => ReactNode;
  footer?: () => ReactNode;
  emptyActions?: ReactNode;
  headerLeading?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: (collapseControl: ReactNode) => ReactNode;
  foundLine?: { line: number; nonce: number };
  compactThreads?: boolean;
  fileDiff?: FileDiffMetadata | undefined;
  disableFileHeader?: boolean;
  fullHeight?: boolean;
  compactHeight?: boolean;
  collapsible?: boolean;
  range?: ReviewRange;
  decision?: boolean;
  column?: boolean;
  readingColumn?: boolean;
  framed?: boolean;
  comments?: boolean;
};
export type ListedComparison = {
  id: string;
  path: string;
  state: 'code' | 'pending' | 'omitted';
};
type PendingJump = { path: string; id?: string | undefined };
export type CodeHeaderControls = {
  collapse: ReactNode;
  current: string | undefined;
  counts: ReadonlyMap<string, LineCounts>;
  open: (path: string) => void;
  awaiting: string | undefined;
  landed: (path: string) => void;
};
export function CodeDocument(props: Props) {
  const review = useToggleReviewed(
    props.scope,
    props.context,
    (notice) => notify(notice),
    props.range,
  );
  const surface = {
    ...props,
    writeBlock: review.writeBlock,
    onToggleReviewed: (entry: CodeEntry) => {
      if (review.writeBlock || entry.review?.current === false) return;
      if (props.onReview) props.onReview(entry);
      else review.toggle(entry.review);
    },
  };
  const key = JSON.stringify([props.interaction.entry, props.range]);
  return props.comments ? (
    <CommentedSurface key={key} {...surface} />
  ) : (
    <CodeSurface key={key} {...surface} />
  );
}
function CommentedSurface(
  props: Props & {
    writeBlock: string | undefined;
    onToggleReviewed: (entry: CodeEntry) => void;
  },
) {
  const { view } = useComments({ scope: props.scope, context: props.context });
  const drafts = (view?.comments ?? []).filter(
    (comment) => comment.publication.status === 'draft',
  );
  return <CodeSurface {...props} commentDrafts={drafts} />;
}
function CodeSurface({
  entries: given,
  listed: givenListed,
  paths,
  scope,
  context: gitContext,
  interaction,
  header,
  footer,
  headerLeading,
  headerActions,
  emptyActions,
  toolbar,
  foundLine,
  disableFileHeader = false,
  fileDiff,
  compactThreads = false,
  fullHeight = false,
  compactHeight = false,
  collapsible = false,
  decision = false,
  column = false,
  readingColumn = column,
  framed = false,
  range,
  onToggleReviewed,
  writeBlock,
  commentDrafts,
}: Props & {
  writeBlock: string | undefined;
  onToggleReviewed: (entry: CodeEntry) => void;
  commentDrafts?: readonly DraftComment[];
}) {
  const [composer, setComposer] = useState<(LineRange & { id: string }) | null>(
    null,
  );
  const { dark } = useTheme();
  const { preferences } = usePreferences();
  const specsApart = useSpecsApart(gitContext.connection);
  const entries = decision ? given : groupSpecPaths(given, specsApart);
  const ordered: readonly ListedComparison[] =
    givenListed ??
    entries.map((entry) => ({ id: entry.id, path: entry.path, state: 'code' }));
  const comparisons =
    givenListed === undefined || decision
      ? ordered
      : groupSpecPaths(ordered, specsApart);
  const listed = comparisons.filter((entry) => entry.state !== 'omitted');
  const folds = useCodeFolds(interaction.worktreeId, interaction.entry);
  const scrollOwner = JSON.stringify([
    gitContext.connection.environmentId,
    interaction.worktreeId,
    interaction.entry,
    range,
  ]);
  const viewer = useCodeViewScroll(scrollOwner);
  const [savedSelection, saveSelection] = useState(() => viewer.selection());
  const selectedEntry = savedSelection
    ? entries.find((entry) => entry.id === savedSelection.lines.id)
    : undefined;
  const staleSelection =
    savedSelection !== null &&
    selectedEntry?.version !== savedSelection.version;
  const selection = staleSelection ? null : (savedSelection?.lines ?? null);
  const setSelection = (next: CodeViewLineSelection | null) => {
    const entry = next
      ? entries.find((entry) => entry.id === next.id)
      : undefined;
    const selected =
      next && entry ? { lines: next, version: entry.version } : null;
    saveSelection(selected);
    viewer.rememberSelection(selected);
  };
  const discard = discardSelection(selection?.range);
  const [focusedId, focus] = useState(() => viewer.focused());
  const [awaited, awaitJump] = useState<PendingJump>();
  if (
    awaited !== undefined &&
    (!interaction.active ||
      !(
        paths?.includes(awaited.path) ||
        comparisons.some((entry) => entry.path === awaited.path)
      ))
  )
    awaitJump(undefined);
  const landing = awaited && interaction.active ? landOn(awaited) : undefined;
  function landOn(jump: PendingJump) {
    const exact = comparisons.find((entry) => entry.id === jump.id);
    if (exact?.state === 'code' || exact?.state === 'pending') return exact;
    const forPath = comparisons.filter((entry) => entry.path === jump.path);
    const first = forPath[0];
    if (first?.state !== 'omitted') return first;
    return (
      forPath.find((entry) => entry.state === 'pending') ??
      forPath.find((entry) => entry.state === 'code') ??
      first
    );
  }
  const setFocusedId = (id: CodeEntry['id'] | undefined) => {
    awaitJump(undefined);
    focus(id);
    viewer.rememberFocus(id);
  };
  const focused = Math.max(
    listed.findIndex((entry) => entry.id === focusedId),
    0,
  );
  const focusedEntry = entries.find(
    (entry) => entry.id === listed[focused]?.id,
  );
  const focusedPath = listed[focused]?.path;
  usePublishDiffFocus(
    interaction.active && focusedPath !== undefined && listed.length > 1
      ? {
          worktreeId: interaction.worktreeId,
          entry: interaction.entry,
          path: focusedPath,
        }
      : undefined,
  );
  const followScroll = (view: ScrolledView) => {
    const top = view.getScrollTop();
    const atEnd = top + view.getHeight() >= view.getScrollHeight() - 1;
    if (awaited !== undefined || atEnd) return;
    const line = top + FOLLOW_SLACK;
    let inView: string | undefined;
    for (const item of view.getRenderedItems()) {
      const itemTop = view.getTopForItem(item.id);
      if (itemTop !== undefined && itemTop <= line) inView = item.id;
    }
    if (inView === undefined && top === 0) inView = listed[0]?.id;
    if (
      inView === undefined ||
      inView === listed[focused]?.id ||
      !listed.some((entry) => entry.id === inView)
    )
      return;
    focus(inView);
    viewer.rememberFocus(inView);
  };
  const collapsed = new Set(
    entries
      .filter((entry) =>
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
  const [handledFound, setHandledFound] = useState<number>();
  const [handledFile, setHandledFile] = useState<number>();
  const focusEntry = (index: number) => {
    const entry = listed[index];
    if (!entry) return;
    setFocusedId(entry.id);
    if (entries.some((shown) => shown.id === entry.id))
      viewer.scrollTo({ type: 'item', id: entry.id, align: 'start' });
    else awaitJump({ path: entry.path, id: entry.id });
  };
  const keepView = () => {
    if (awaited !== undefined) awaitJump(undefined);
  };
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const notesFor = (entry: CodeEntry): CommentNote[] => {
    if (commentDrafts === undefined) return [];
    const notes = new Map<string, CommentNote>();
    const note = (side: LineRange['side'], line: number) => {
      const key = `${side}:${line}`;
      const found = notes.get(key) ?? { side, line, drafts: [] };
      notes.set(key, found);
      return found;
    };
    for (const draft of commentDrafts) {
      const anchor = draft.anchor;
      if (anchor.kind !== 'lines' || anchor.path !== entry.path) continue;
      if (entry.kind === 'file' && anchor.side !== 'additions') continue;
      note(anchor.side, anchor.end).drafts.push(draft);
    }
    if (composer?.id === entry.id)
      note(composer.side, composer.end).composing = {
        side: composer.side,
        start: composer.start,
        end: composer.end,
      };
    return [...notes.values()];
  };
  const items: CodeViewItem<CommentNote>[] = entries.map((entry) => {
    const notes = notesFor(entry);
    const shared = {
      id: entry.id,
      collapsed: collapsed.has(entry.id),
      version: contentVersion(
        JSON.stringify([entry.version, collapsed.has(entry.id), notes]),
      ),
    };
    const target = codeTarget(entry);
    return target.type === 'diff'
      ? {
          ...shared,
          ...target,
          annotations: notes.map((note) => ({
            side: note.side,
            lineNumber: note.line,
            metadata: note,
          })),
        }
      : {
          ...shared,
          ...target,
          annotations: notes.map((note) => ({
            lineNumber: note.line,
            metadata: note,
          })),
        };
  });
  const specEntries = entries.filter((entry) => isSpecPath(entry.path));
  const specCount = new Set(specEntries.map((entry) => entry.path)).size;
  const firstSpecId = specEntries[0]?.id;
  const firstReviewEntryByPath = new Map<string, string>();
  for (const entry of entries) {
    if (entry.review && !firstReviewEntryByPath.has(entry.review.path))
      firstReviewEntryByPath.set(entry.review.path, entry.id);
  }
  const paddingBottom = fullHeight || footer ? 12 : 160;
  const options: CodeViewReactOptions<CommentNote, undefined> = {
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    theme:
      decision || column || compactThreads || framed
        ? PIERRE_DECISION_THEME
        : PIERRE_THEME,
    themeType: dark ? 'dark' : 'light',
    overflow: preferences.lineOverflow,
    diffStyle: preferences.diffStyle,
    diffIndicators: 'classic',
    hunkSeparators: 'line-info',
    stickyHeaders: !disableFileHeader && !fullHeight,
    disableFileHeader: disableFileHeader || compactHeight,
    enableLineSelection: true,
    enableGutterUtility: commentDrafts !== undefined,
    onGutterUtilityClick: (range, context) => {
      const lines = commentRange(range);
      if (!lines || commentDrafts === undefined) return;
      if (context.item.type === 'file' && lines.side !== 'additions') return;
      folds.setCollapsed([context.item.id], false);
      setComposer({ id: context.item.id, ...lines });
    },
    onLineClick: (_, context) => setFocusedId(context.item.id),
    onLineNumberClick: (_, context) => setFocusedId(context.item.id),
    lineHoverHighlight: 'number',
    unsafeCSS: `${compactThreads ? '[data-line-annotation]:has([data-file-thread-marker]) { margin-left: 0; }' : ''}${fileChangeBars(fileDiff)}${decision || column || framed ? PIERRE_DECISION_CSS : ''}${column ? PIERRE_CHANGES_HEADER_CSS : ''}${PIERRE_SURFACE_CSS}${commentDrafts === undefined ? '' : PIERRE_COMMENT_CSS}${disableFileHeader || compactHeight ? '[data-code] { padding-top: 0 !important; }' : PIERRE_HEADER_CSS}${compactThreads ? PIERRE_FILE_CSS : ''}${compactHeight ? '[data-diffs-header], pre { border: 0; border-radius: 0; }' : ''}`,
    ...(column
      ? { itemMetrics: { lineHeight: 22, diffHeaderHeight: 41 } }
      : {}),
    ...(disableFileHeader || compactHeight
      ? { itemMetrics: { paddingTop: 0 } }
      : {}),
    layout: {
      paddingTop: disableFileHeader || compactHeight ? 0 : 12,
      paddingBottom: compactHeight ? 0 : paddingBottom,
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
  const collapseLabel = allCollapsed
    ? 'Expand all files'
    : 'Collapse all files';
  const collapseButton = (
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
  const paneActions =
    paneFile &&
    (focusedEntry ? (
      <>
        {focusedEntry.review && (
          <BarAction
            label="Reviewed"
            variant="outline"
            icon={focusedEntry?.review?.reviewed ? CheckIcon : SquareIcon}
            shortcut={SHORTCUTS.toggleReviewed}
            description={writeBlock}
            disabled={
              Boolean(writeBlock) ||
              focusedEntry.review.current === false ||
              !focusedEntry.review.fingerprint
            }
            pressed={focusedEntry?.review?.reviewed}
            onClick={() => {
              if (focusedEntry) onToggleReviewed(focusedEntry);
            }}
          />
        )}
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
        current: listed[focused]?.path,
        counts: lineCounts(entries),
        open: (path) => {
          const entry = listed.find((candidate) => candidate.path === path);
          if (entry) {
            folds.setCollapsed([entry.id], false);
            setFocusedId(entry.id);
          }
          const first = landOn({ path });
          if (first?.state === 'code')
            viewer.scrollTo({ type: 'item', id: first.id, align: 'start' });
          else awaitJump({ path });
        },
        awaiting: landing?.state === 'omitted' ? landing.path : undefined,
        landed: (path) => {
          if (awaited?.path === path) awaitJump(undefined);
        },
      }));

  return (
    <div
      role="region"
      aria-label="Code content"
      onWheel={keepView}
      onTouchMove={keepView}
      onPointerDown={keepView}
      onKeyDown={(event) => {
        if (SCROLL_KEYS.has(event.key)) keepView();
      }}
      className={cn(
        '@container/code relative flex min-h-0 flex-1 flex-col',
        (decision || column || compactThreads || framed) && 'decision-code',
        compactThreads && 'file-code',
        framed && 'commit-code',
        compactHeight && 'overflow-hidden rounded-lg border',
      )}
    >
      {interaction.toolbarTarget &&
        paneActions &&
        createPortal(paneActions, interaction.toolbarTarget)}
      {interaction.active && listed.length > 0 && (
        <CodeShortcuts
          reviewEnabled={!interaction.entry.startsWith('walkthrough-step:')}
          next={() => focusEntry(Math.min(focused + 1, listed.length - 1))}
          previous={() => focusEntry(Math.max(focused - 1, 0))}
          review={() => {
            if (focusedEntry?.review) onToggleReviewed(focusedEntry);
          }}
          comment={() => {
            const lines = selection ? commentRange(selection.range) : null;
            if (!selection || !lines || commentDrafts === undefined) return;
            const entry = entries.find((item) => item.id === selection.id);
            if (entry?.kind === 'file' && lines.side !== 'additions') return;
            folds.setCollapsed([selection.id], false);
            setComposer({ id: selection.id, ...lines });
          }}
        />
      )}
      {staleSelection && (
        <p
          role="status"
          className="absolute bottom-3 left-3 z-10 rounded-lg border bg-popover p-2 text-xs"
        >
          Code changed since these lines were selected. Select lines again.
        </p>
      )}
      {discard &&
        selectedEntry?.discardScope &&
        selectedEntry.current !== false && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border bg-popover p-2">
            <DiscardButton
              scope={scope}
              context={gitContext}
              path={selectedEntry.path}
              hunk={{
                scope: selectedEntry.discardScope,
                ...discard,
              }}
              variant="compact"
            />
          </div>
        )}
      {toolbar
        ? toolbar(collapseControl)
        : !column &&
          collapseControl && (
            <div className="flex shrink-0 justify-end px-3">
              {collapseControl}
            </div>
          )}
      {entries.length === 0 && (header || headerActions || footer) && (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-auto',
            readingColumn && COLUMN_GUTTERS,
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
      {compactHeight && entries[0] && (
        <div className="flex min-h-10 shrink-0 items-center gap-2 border-b bg-muted px-2 py-1">
          <TruncatedText
            className="min-w-0 flex-1 font-mono text-caption font-medium"
            text={entries[0].path}
          />
        </div>
      )}
      {entries.length > 0 && (
        <CodeView
          ref={(handle) => {
            if (!handle) return;
            const instance = handle.getInstance();
            if (!instance) return;
            const release = viewer.attach(instance);
            const frame = requestAnimationFrame(() => {
              viewer.restorePosition(
                instance,
                options.stickyHeaders && !options.disableFileHeader
                  ? (options.itemMetrics?.diffHeaderHeight ??
                      DEFAULT_VIRTUAL_FILE_METRICS.diffHeaderHeight)
                  : 0,
              );
              const arrived =
                landing?.state === 'code'
                  ? entries.find((entry) => entry.id === landing.id)
                  : undefined;
              if (arrived) {
                handle.scrollTo({
                  type: 'item',
                  id: arrived.id,
                  align: 'start',
                });
                setFocusedId(arrived.id);
              }
              const requested = interaction.fileTarget;
              const requestedEntry = requested
                ? entries.find((entry) =>
                    requested.entry === undefined
                      ? entry.path === requested.path
                      : entry.id === requested.entry,
                  )
                : undefined;
              if (
                requested &&
                requestedEntry &&
                requested.nonce !== handledFile
              ) {
                folds.setCollapsed([requestedEntry.id], false);
                handle.scrollTo({
                  type: 'item',
                  id: requestedEntry.id,
                  align: 'start',
                });
                setFocusedId(requestedEntry.id);
                setHandledFile(requested.nonce);
              }
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
            });
            return () => {
              cancelAnimationFrame(frame);
              release?.();
            };
          }}
          items={items}
          onScroll={(scrollTop, view) => {
            viewer.rememberPosition(scrollTop);
            followScroll(view);
          }}
          selectedLines={selection}
          onSelectedLinesChange={(next) => {
            setSelection(next);
            if (next) setFocusedId(next.id);
          }}
          renderAnnotation={(...[annotation]) => {
            const note = annotation.metadata;
            const entry = entries.find(
              (candidate) => candidate.id === composer?.id,
            );
            const composing = note.composing;
            const anchor =
              composing && entry
                ? {
                    kind: 'lines' as const,
                    path: entry.path,
                    ...composing,
                    text:
                      entry.kind === 'diff'
                        ? diffLineText(entry.fileDiff, composing)
                        : fileLineText(entry.contents, composing),
                  }
                : undefined;
            return (
              <CommentThread
                owner={{ scope, context: gitContext }}
                drafts={note.drafts}
                anchor={anchor}
                composing={composing !== undefined}
                onClose={() => {
                  setComposer(null);
                  setSelection(null);
                }}
                className="mx-3 my-2 max-w-[min(100%,48rem)]"
              />
            );
          }}
          renderHeaderMetadata={(item) => {
            const entry = byId.get(item.id);
            if (disableFileHeader || !entry) return null;
            const first = item.id === entries[0]?.id;
            const actions = !paneFile && first ? headerActions : null;
            const leading = item.id === entries[0]?.id ? headerLeading : null;
            const stale = entry.review?.stale ? (
              <span className="rounded-md bg-graph-4/15 px-1.5 py-0.5 font-sans text-2xs text-graph-4">
                Changed since reviewed
              </span>
            ) : null;
            if (column)
              return (
                <span className="flex items-center gap-1.5">
                  {stale}
                  <ChangeCounts counts={entryLineCounts(entry)} />
                </span>
              );
            if (!stale && !leading && !actions) return null;
            return (
              <div
                className={cn(
                  'flex max-w-full items-center justify-end gap-1.5',
                  !decision && 'flex-wrap',
                )}
              >
                {stale}
                {leading}
                {actions && <ButtonGroup>{actions}</ButtonGroup>}
              </div>
            );
          }}
          review={decision || column || compactThreads || framed}
          options={options}
          className={cn(
            compactHeight && 'max-h-48 flex-none overflow-auto',
            !compactHeight && fullHeight && 'flex-none overflow-visible',
            !compactHeight && !fullHeight && 'min-h-0 flex-1 overflow-auto',
            readingColumn && COLUMN_GUTTERS,
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
                      Specs · {counted(specCount, 'file')}
                    </span>
                  )}
                {(column || collapsible || entries.length > 1) && (
                  <FileHeaderAction
                    label={`${isCollapsed ? 'Expand' : 'Collapse'} ${entry.path}`}
                    icon={isCollapsed ? ChevronRightIcon : ChevronDownIcon}
                    expanded={!isCollapsed}
                    onClick={() => toggle(item.id)}
                  />
                )}
                {control}
              </span>
            );
          }}
          renderHeaderFilenameSuffix={(item) => {
            const entry = byId.get(item.id);
            if (!entry) return null;
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

const FOLLOW_SLACK = 8;

type ScrolledView = {
  getScrollTop(): number;
  getHeight(): number;
  getScrollHeight(): number;
  getRenderedItems(): readonly { id: string }[];
  getTopForItem(id: string): number | undefined;
};

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

const COLUMN_GUTTERS =
  'px-[max(--spacing(4),calc((100%-var(--container-reading))/2))] @2xl/pane:px-[max(--spacing(7),calc((100%-var(--container-reading))/2))]';

function CodeShortcuts({
  reviewEnabled,
  next,
  previous,
  review,
  comment,
}: {
  reviewEnabled: boolean;
  next: () => void;
  previous: () => void;
  review: () => void;
  comment: () => void;
}) {
  const options = { ignoreInputs: true };
  useHotkey(SHORTCUTS.nextFile, next, options);
  useHotkey(SHORTCUTS.previousFile, previous, options);
  useHotkey(SHORTCUTS.comment, comment, options);
  return reviewEnabled ? <FileReviewShortcut review={review} /> : null;
}

function FileReviewShortcut({ review }: { review: () => void }) {
  useHotkey(SHORTCUTS.toggleReviewed, review, { ignoreInputs: true });
  return null;
}

function FileHeaderAction({
  label,
  icon: Icon,
  expanded,
  onClick,
}: {
  label: string;
  icon: typeof ChevronDownIcon;
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
            aria-expanded={expanded}
            onClick={onClick}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
