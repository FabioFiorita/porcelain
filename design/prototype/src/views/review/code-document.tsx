import type {
  CodeViewItem,
  CodeViewLineSelection,
  DiffLineAnnotation,
  FileDiffMetadata,
  LineAnnotation,
  SelectedLineRange,
} from '@pierre/diffs';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  MessageSquarePlus,
} from 'lucide-react';
import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  anchorForFile,
  anchorForRange,
  anchorLabel,
  anchorPlacement,
  type CodeAnchor,
  type CommentThread,
  mixedSelectionMessage,
  onRevision,
  threadPath,
} from '../../domain/comments';
import {
  basename,
  contentFingerprint,
  fileState,
  type Marks,
  type ReviewScope,
} from '../../domain/review';
import { usePreferences } from '../workspace/preferences';
import { SHORTCUTS } from '../workspace/shortcuts';
import { BinaryChangeCard } from './binary-change';
import type { BinaryEntry } from './diff-entries';
import { FileTick } from './document-parts';
import { NewThreadComposer } from './inline-composer';
import { type Note, notePlacement } from './notes';
import {
  FLUSH_TOP_CSS,
  GUTTER_CSS,
  itemId,
  PIERRE_THEME,
  PLUS_OVER_NUMBER_CSS,
  pathOfItem,
} from './pierre';
import type { TickableFile } from './review-actions';
import { ThreadCard } from './thread-card';
import { type CollapsedFiles, useCollapsedFiles } from './use-collapsed-files';

export type CodeEntry =
  | {
      kind: 'diff';
      path: string;
      fileDiff: FileDiffMetadata;
      fingerprint: string;
      note?: string;
    }
  | { kind: 'file'; path: string; contents: string };

export type RevealRequest = {
  path: string;
  lineNumber: number;
  side?: 'additions' | 'deletions';
  /** On a merge commit, the parent (1-based) whose diff the lines are in. */
  parent?: number;
  nonce: number;
};

type Props = {
  scope: ReviewScope;
  entries: readonly CodeEntry[];
  threads: readonly CommentThread[];
  /** Whether the ＋, drag, Comment and C open a composer here. */
  commentable: boolean;
  /** File ticks; only diffs and binaries are ticked, and only where `onToggleReviewed` is given. */
  marks?: Marks;
  collapseReviewed?: boolean;
  onToggleReviewed?: (file: TickableFile) => void;
  /** Changed binary files: a card each above the code, ticked and commented on as whole files. */
  binaries?: readonly BinaryEntry[];
  /** Extra actions at the end of each file header (Discard in plain Changes). */
  renderFileActions?: (path: string) => ReactNode;
  header?: () => ReactNode;
  reveal?: RevealRequest | null;
  /** With the centre split, only the focused pane answers J/K/R/C. */
  hotkeysEnabled?: boolean;
  /** A single file already named by its document toolbar needs no Pierre header too. */
  disableFileHeader?: boolean;
  /** Opens the file-level composer when the toolbar's Comment is pressed. */
  commentOnFile?: FileCommentRequest | null;
  /** The commit this code is from. Comments made here carry it as the anchor's `revision`. */
  revision?: string;
  /** On a merge commit, the parent (1-based) the diff is against; comments carry it when it is not the first. */
  parent?: number;
  /** Shared with the document's Collapse all; without it the folds are local and forgotten. */
  collapse?: CollapsedFiles;
};

export type FileCommentRequest = { path: string; nonce: number };

const NO_BINARIES: readonly BinaryEntry[] = [];

/** A merge commit's threads belong to the parent their diff was against; absent is the first. */
const onParent = (thread: CommentThread, parent: number) =>
  thread.anchor.kind !== 'worktree' && (thread.anchor.parent ?? 1) === parent;

/** One toolbar button: Collapse all, or Expand all once every file is folded. */
export function CollapseAllButton({
  collapse,
  entries,
  marks,
  collapseReviewed = false,
}: {
  collapse: CollapsedFiles;
  entries: readonly CodeEntry[];
  marks?: Marks;
  collapseReviewed?: boolean;
}) {
  if (entries.length < 2) return null;
  const allCollapsed = entries.every((entry) =>
    collapse.isCollapsed(
      entry.path,
      collapseReviewed &&
        marks != null &&
        fileState(marks, entry.path) === 'reviewed',
    ),
  );
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() =>
        collapse.setCollapsed(
          entries.map((entry) => entry.path),
          !allCollapsed,
        )
      }
    >
      {allCollapsed ? (
        <ChevronsUpDown className="size-3.5" />
      ) : (
        <ChevronsDownUp className="size-3.5" />
      )}
      {allCollapsed ? 'Expand all' : 'Collapse all'}
    </Button>
  );
}

/**
 * The one code surface: every diff, file and commit renders through Pierre's
 * CodeView here, with comment threads inline under the lines they are about.
 */
export function CodeDocument({
  scope,
  hotkeysEnabled = true,
  entries,
  threads,
  commentable,
  marks,
  collapseReviewed = false,
  onToggleReviewed,
  binaries = NO_BINARIES,
  renderFileActions,
  header,
  reveal,
  disableFileHeader = false,
  commentOnFile,
  revision,
  parent = 1,
  collapse: sharedCollapse,
}: Props) {
  const viewer = useRef<CodeViewHandle<Note, undefined>>(null);
  const root = useRef<HTMLDivElement>(null);
  const { preferences, resolvedTheme } = usePreferences();
  const [composer, setComposer] = useState<CodeAnchor | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(
    null,
  );
  const ownCollapse = useCollapsedFiles();
  const collapse = sharedCollapse ?? ownCollapse;

  const byPath = useMemo(
    () => new Map(entries.map((entry) => [entry.path, entry])),
    [entries],
  );
  // Binary cards sit above the code, so they come first in J/K order.
  const order = useMemo(
    () => [
      ...binaries.map((binary) => binary.path),
      ...entries.map((entry) => entry.path),
    ],
    [binaries, entries],
  );

  // The file J/K move from and R/C act on: the last one clicked, focused or jumped to
  // (a new jump is state adjusted while rendering). Until then, the first.
  const [current, setCurrent] = useState<string | null>(reveal?.path ?? null);
  const [revealed, setRevealed] = useState(reveal?.nonce);
  if (reveal?.nonce !== revealed) {
    setRevealed(reveal?.nonce);
    if (reveal != null && order.includes(reveal.path)) setCurrent(reveal.path);
  }
  const currentIndex = Math.max(
    0,
    current == null ? 0 : order.indexOf(current),
  );

  // Every way of commenting (＋, drag, header Comment, toolbar Comment, C) comes through here.
  const openComposer = (
    anchor: CodeAnchor,
    keepSelection?: CodeViewLineSelection | null,
  ) => {
    setComposer({
      ...anchor,
      ...(revision == null ? {} : { revision }),
      ...(parent === 1 ? {} : { parent }),
    });
    setSelection(keepSelection ?? null);
    setCurrent(anchor.filePath);
  };

  const closeComposer = () => {
    setComposer(null);
    setSelection(null);
  };

  // Pierre keeps the options object; the gutter handler reads the latest opener through a ref.
  const openComposerRef = useRef(openComposer);
  useLayoutEffect(() => {
    openComposerRef.current = openComposer;
  });

  const items = useMemo<CodeViewItem<Note>[]>(() => {
    return entries.map((entry): CodeViewItem<Note> => {
      const notes: Note[] = [
        ...threads
          .filter(
            (thread) =>
              threadPath(thread) === entry.path &&
              onRevision(thread.anchor, revision) &&
              onParent(thread, parent),
          )
          .map((thread): Note => ({ kind: 'thread', thread })),
        ...(composer?.filePath === entry.path
          ? [{ kind: 'composer', anchor: composer } as Note]
          : []),
      ].filter((note) => notePlacement(note) != null);
      const state = marks == null ? 'unreviewed' : fileState(marks, entry.path);
      const collapsed =
        composer?.filePath !== entry.path &&
        collapse.isCollapsed(
          entry.path,
          collapseReviewed && state === 'reviewed',
        );
      const version = Number.parseInt(
        contentFingerprint(
          JSON.stringify([
            notes,
            state,
            collapsed,
            entry.kind === 'diff' ? entry.fingerprint : entry.contents.length,
          ]),
        ),
        16,
      );

      if (entry.kind === 'diff') {
        const annotations = notes.map((note): DiffLineAnnotation<Note> => {
          const { lineNumber, side } = notePlacement(note) ?? {
            lineNumber: 0,
            side: 'additions',
          };
          // Pierre's metadata type distributes over the Note union; one shape covers both kinds.
          return {
            side,
            lineNumber,
            metadata: note,
          } as DiffLineAnnotation<Note>;
        });
        return {
          id: itemId('diff', entry.path),
          type: 'diff',
          fileDiff: entry.fileDiff,
          annotations,
          collapsed,
          version,
        };
      }

      const annotations = notes.map(
        (note) =>
          ({
            lineNumber: notePlacement(note)?.lineNumber ?? 0,
            metadata: note,
          }) as LineAnnotation<Note>,
      );
      return {
        id: itemId('file', entry.path),
        type: 'file',
        file: { name: entry.path, contents: entry.contents },
        annotations,
        collapsed,
        version,
      };
    });
  }, [
    entries,
    threads,
    composer,
    marks,
    collapseReviewed,
    collapse,
    revision,
    parent,
  ]);

  const collapsedPaths = useMemo(
    () =>
      new Set(
        items
          .filter((item) => item.collapsed === true)
          .map((item) => pathOfItem(item.id)),
      ),
    [items],
  );

  const toggleCollapsed = (path: string) =>
    collapse.setCollapsed([path], !collapsedPaths.has(path));

  const options = useMemo(
    () => ({
      theme: PIERRE_THEME,
      themeType: resolvedTheme,
      diffStyle: preferences.diffStyle,
      overflow: preferences.lineOverflow,
      stickyHeaders: !disableFileHeader,
      disableFileHeader,
      enableLineSelection: true,
      enableGutterUtility: commentable,
      lineHoverHighlight: 'number' as const,
      unsafeCSS: `${GUTTER_CSS}${commentable ? PLUS_OVER_NUMBER_CSS : ''}${disableFileHeader ? FLUSH_TOP_CSS : ''}`,
      layout: {
        paddingTop: disableFileHeader ? 0 : 12,
        paddingBottom: 160,
        gap: 12,
      },
      // The virtual layout must agree with FLUSH_TOP_CSS, or it keeps reserving the removed gap.
      ...(disableFileHeader ? { itemMetrics: { paddingTop: 0 } } : {}),
      ...(commentable
        ? {
            /** Press ＋ for one line, drag it for a block, or press it over a selection. */
            onGutterUtilityClick: (
              range: SelectedLineRange,
              context: { item: { id: string; type: 'diff' | 'file' } },
            ) => {
              const path = pathOfItem(context.item.id);
              const anchor = anchorForRange(path, range);
              if (anchor == null) {
                toast.add({
                  title: mixedSelectionMessage(preferences.diffStyle),
                });
                // Cleared once Pierre has committed the range, so the next ＋ starts fresh.
                queueMicrotask(() => setSelection(null));
                return;
              }
              openComposerRef.current(
                context.item.type === 'file' && anchor.kind === 'codeRange'
                  ? { ...anchor, side: undefined }
                  : anchor,
                { id: context.item.id, range },
              );
            },
          }
        : {}),
    }),
    [
      resolvedTheme,
      preferences.diffStyle,
      preferences.lineOverflow,
      commentable,
      disableFileHeader,
    ],
  );

  // The toolbar's Comment: a comment on the whole file. Only a new press opens it
  // (state adjusted while rendering, React's pattern for reacting to a new prop).
  const [pressed, setPressed] = useState(commentOnFile?.nonce);
  if (commentOnFile?.nonce !== pressed) {
    setPressed(commentOnFile?.nonce);
    if (
      commentOnFile != null &&
      commentable &&
      byPath.has(commentOnFile.path)
    ) {
      openComposer(anchorForFile(commentOnFile.path));
    }
  }

  const scrollToFile = (path: string) => {
    const entry = byPath.get(path);
    if (entry != null)
      viewer.current?.scrollTo({
        type: 'item',
        id: itemId(entry.kind, entry.path),
        align: 'start',
      });
    else
      root.current
        ?.querySelector(`[data-binary-path="${CSS.escape(path)}"]`)
        ?.scrollIntoView({ block: 'start' });
  };

  const focusFile = (index: number) => {
    const path = order[index];
    if (path == null) return;
    setCurrent(path);
    scrollToFile(path);
  };

  // Jump to a thread asked for from elsewhere (the Comments list, a tab switch). Only a new request scrolls.
  const onReveal = useEffectEvent(() => {
    if (reveal == null || !order.includes(reveal.path)) return undefined;
    const entry = byPath.get(reveal.path);
    if (entry == null) return setTimeout(() => scrollToFile(reveal.path), 80);
    collapse.setCollapsed([reveal.path], false);
    const id = itemId(entry.kind, entry.path);
    return setTimeout(() => {
      if (reveal.lineNumber > 0) {
        viewer.current?.scrollTo({
          type: 'line',
          id,
          lineNumber: reveal.lineNumber,
          side: entry.kind === 'diff' ? reveal.side : undefined,
          align: 'center',
        });
      } else {
        viewer.current?.scrollTo({ type: 'item', id, align: 'start' });
      }
    }, 80);
  });
  const revealNonce = reveal?.nonce;
  useEffect(() => {
    if (revealNonce == null) return;
    const timer = onReveal();
    return () => clearTimeout(timer);
  }, [revealNonce]);

  /**
   * A click or focus anywhere in a file (its header, its lines, a thread under
   * them) makes it the current file. Pierre renders each file in its own shadow
   * root, so the event's path names the file's element.
   */
  const pickCurrent = (event: SyntheticEvent) => {
    const path = event.nativeEvent.composedPath();
    const card = path.find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.dataset.binaryPath != null,
    );
    if (card?.dataset.binaryPath != null)
      return setCurrent(card.dataset.binaryPath);
    const rendered = viewer.current?.getInstance()?.getRenderedItems() ?? [];
    const item = rendered.find((candidate) => path.includes(candidate.element));
    if (item != null) setCurrent(pathOfItem(item.id));
  };

  const toggleReviewed = (path: string) => {
    if (onToggleReviewed == null) return;
    const entry = byPath.get(path);
    const file =
      entry?.kind === 'diff'
        ? entry
        : binaries.find((binary) => binary.path === path);
    if (file != null) onToggleReviewed(file);
  };

  useHotkey(
    SHORTCUTS.nextFile,
    () => focusFile(Math.min(currentIndex + 1, order.length - 1)),
    { ignoreInputs: true, enabled: hotkeysEnabled },
  );
  useHotkey(
    SHORTCUTS.previousFile,
    () => focusFile(Math.max(currentIndex - 1, 0)),
    { ignoreInputs: true, enabled: hotkeysEnabled },
  );
  useHotkey(
    SHORTCUTS.toggleReviewed,
    () => {
      const path = order[currentIndex];
      if (path != null) toggleReviewed(path);
    },
    { ignoreInputs: true, enabled: hotkeysEnabled },
  );
  useHotkey(
    SHORTCUTS.commentOnFile,
    () => {
      const path = order[currentIndex];
      if (path != null && commentable) openComposer(anchorForFile(path));
    },
    { ignoreInputs: true, enabled: hotkeysEnabled },
  );

  const selectionAnchor =
    selection != null && composer == null && commentable
      ? anchorForRange(pathOfItem(selection.id), selection.range)
      : null;

  // Binary files have no lines for Pierre to draw; they sit above the code as cards.
  const binarySection = binaries.length > 0 && (
    <section aria-label="Binary files" className="mx-4 mt-3 flex flex-col">
      {entries.length > 0 && (
        <h2 className="px-1 pt-1 text-[11px] font-medium text-muted-foreground">
          Binary files
        </h2>
      )}
      {binaries.map((binary) => (
        <BinaryChangeCard
          key={binary.path}
          scope={scope}
          entry={binary}
          state={marks == null ? 'unreviewed' : fileState(marks, binary.path)}
          threads={threads.filter(
            (thread) =>
              threadPath(thread) === binary.path &&
              onRevision(thread.anchor, revision) &&
              onParent(thread, parent) &&
              anchorPlacement(thread) != null,
          )}
          composer={composer?.filePath === binary.path ? composer : null}
          onComment={
            commentable
              ? () => openComposer(anchorForFile(binary.path))
              : undefined
          }
          onCloseComposer={closeComposer}
          onToggleReviewed={
            onToggleReviewed == null
              ? undefined
              : () => onToggleReviewed(binary)
          }
          actions={renderFileActions?.(binary.path)}
          compact={entries.length > 0 || binaries.length > 1}
        />
      ))}
    </section>
  );
  const renderHeader =
    header == null && binarySection === false
      ? undefined
      : () => (
          <>
            {header?.()}
            {binarySection}
          </>
        );

  return (
    <div
      ref={root}
      onPointerDownCapture={pickCurrent}
      onFocusCapture={pickCurrent}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      {/*
        Floats over the code instead of taking a row: a bar that appears when the
        drag starts would push the lines down under the pointer. It only reports
        the growing range; asking stays on the ＋ beside the selection.
      */}
      {selectionAnchor != null && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-lg border bg-popover/95 px-2.5 py-1 text-xs text-popover-foreground shadow-md"
        >
          <MessageSquarePlus className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {basename(selectionAnchor.filePath)} ·{' '}
            {anchorLabel(selectionAnchor)}
          </span>
        </div>
      )}

      {entries.length === 0 ? (
        // Pierre has no items to lay out; the header and the binary cards scroll on their own.
        <div className="code-scroll min-h-0 flex-1 overflow-auto pb-10">
          {renderHeader?.()}
        </div>
      ) : (
        <CodeView
          ref={viewer}
          items={items}
          options={options}
          selectedLines={selection}
          onSelectedLinesChange={(next) => {
            if (composer == null) setSelection(next);
          }}
          className="code-scroll min-h-0 flex-1 overflow-auto"
          renderCodeViewHeader={renderHeader}
          renderAnnotation={(annotation) => {
            const note = annotation.metadata;
            switch (note.kind) {
              case 'thread':
                return <ThreadCard thread={note.thread} scope={scope} />;
              case 'composer':
                return (
                  <NewThreadComposer
                    key={JSON.stringify(note.anchor)}
                    scope={scope}
                    anchor={note.anchor}
                    onClose={closeComposer}
                  />
                );
            }
          }}
          renderHeaderPrefix={(item) => {
            const path = pathOfItem(item.id);
            const collapsed = collapsedPaths.has(path);
            // One file on its own has nothing to fold out of the way.
            const chevron = entries.length > 1 && (
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Expand ${path}` : `Collapse ${path}`}
                title={collapsed ? 'Expand' : 'Collapse'}
                onClick={() => toggleCollapsed(path)}
                className="-ml-1 grid size-5 place-items-center rounded-md font-sans text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            );
            const entry = byPath.get(path);
            if (
              item.type !== 'diff' ||
              onToggleReviewed == null ||
              entry?.kind !== 'diff'
            )
              return chevron || null;
            return (
              // Pierre's prefix slot stacks its children; keep chevron and tick on one row.
              <span className="flex items-center gap-1">
                {chevron}
                <FileTick
                  path={entry.path}
                  state={
                    marks == null ? 'unreviewed' : fileState(marks, entry.path)
                  }
                  onClick={() => onToggleReviewed(entry)}
                />
              </span>
            );
          }}
          renderHeaderFilenameSuffix={(item) => {
            const entry = byPath.get(pathOfItem(item.id));
            if (entry?.kind !== 'diff' || entry.note == null) return null;
            return (
              <span className="ml-2 truncate font-sans text-[11.5px] text-muted-foreground">
                {entry.note}
              </span>
            );
          }}
          renderHeaderMetadata={(item) => {
            const path = pathOfItem(item.id);
            const stale = marks != null && fileState(marks, path) === 'stale';
            return (
              <span className="ml-2 inline-flex items-center gap-1 font-sans">
                {stale && (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] text-amber-700 dark:text-amber-300">
                    Changed since reviewed
                  </span>
                )}
                {commentable && (
                  <button
                    type="button"
                    aria-label={`Comment on ${path}`}
                    onClick={() => openComposer(anchorForFile(path))}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquarePlus className="size-3.5" />
                    Comment
                  </button>
                )}
                {renderFileActions?.(path)}
              </span>
            );
          }}
        />
      )}
    </div>
  );
}
