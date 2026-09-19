import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  SelectedLineRange,
} from '@pierre/diffs';
import { FileDiff } from '@pierre/diffs/react';
import {
  FileCode,
  FileDiff as FileDiffIcon,
  MessageSquarePlus,
} from 'lucide-react';
import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  anchorForFile,
  anchorForRange,
  type CodeAnchor,
  type CommentThread,
  mixedSelectionMessage,
} from '../../domain/comments';
import { basename, type ReviewScope } from '../../domain/review';
import { usePreferences } from '../workspace/preferences';
import { FileTypeIcon } from './file-type-icon';
import { NewThreadComposer } from './inline-composer';
import { type Note, notePlacement } from './notes';
import { GUTTER_CSS, PIERRE_THEME, PLUS_OVER_NUMBER_CSS } from './pierre';
import { ThreadCard } from './thread-card';
import { useHighlighterReady } from './use-highlighter-ready';
import { useShallowStable } from './use-shallow-stable';

/** The composer open in one block of a page, with the lines it was opened on. */
export type OpenComposer = {
  blockId: string;
  anchor: CodeAnchor;
  range: SelectedLineRange | null;
};

/** A small header button; its label hides when the block is narrow. */
export function BlockAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      <span className="@max-[30rem]:sr-only">{label}</span>
    </button>
  );
}

/** "apps/web/src/query/reviewed.ts:4–19", the folder muted. */
export function BlockTitle({
  path,
  lines,
}: {
  path: string;
  lines?: { startLine: number; endLine: number };
}) {
  const folder = path.slice(0, path.length - basename(path).length);
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 font-mono text-[11.5px]"
      title={path}
    >
      <FileTypeIcon path={path} className="size-3.5 shrink-0" />
      {/* The folder gives way first, so the file name and lines stay readable in a narrow pane. */}
      <span className="flex min-w-0">
        <span className="min-w-0 truncate text-muted-foreground">{folder}</span>
        <span className="shrink-0">
          {basename(path)}
          {lines != null && (
            <span className="text-muted-foreground">
              :
              {lines.startLine === lines.endLine
                ? lines.startLine
                : `${lines.startLine}–${lines.endLine}`}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

/**
 * One block of code in a review page: a step's lines as a diff (changed code) or as
 * plain numbered code (context), with the same commenting as every other diff: the
 * gutter ＋, dragging it over a block, or Comment for the whole file. Threads whose
 * lines fall in the block render under them. Not virtualized: a block is a handful
 * of lines, so it sits in the page's own scroll.
 */
export function StepBlock({
  scope,
  blockId,
  path,
  lines,
  fileDiff,
  plain,
  threads,
  composer,
  onComposer,
  onOpenFile,
  onOpenDiff,
}: {
  scope: ReviewScope;
  blockId: string;
  path: string;
  lines: { startLine: number; endLine: number };
  fileDiff: FileDiffMetadata;
  /** Unchanged code: always one column, whatever the diff layout preference. */
  plain: boolean;
  threads: readonly CommentThread[];
  composer: OpenComposer | null;
  onComposer: (composer: OpenComposer | null) => void;
  onOpenFile: () => void;
  onOpenDiff?: () => void;
}) {
  const { preferences, resolvedTheme } = usePreferences();
  const ready = useHighlighterReady();
  const [selection, setSelection] = useState<SelectedLineRange | null>(null);
  const mine = composer?.blockId === blockId ? composer : null;
  const shownThreads = useShallowStable(threads);

  // Pierre keeps the options object; handlers read the latest props through a ref.
  const latest = useRef({ path, blockId, onComposer });
  useLayoutEffect(() => {
    latest.current = { path, blockId, onComposer };
  });

  const diffStyle = plain ? ('unified' as const) : preferences.diffStyle;
  const options = useMemo(
    () => ({
      theme: PIERRE_THEME,
      themeType: resolvedTheme,
      diffStyle,
      overflow: preferences.lineOverflow,
      disableFileHeader: true,
      hunkSeparators: 'simple' as const,
      enableLineSelection: true,
      enableGutterUtility: true,
      lineHoverHighlight: 'number' as const,
      unsafeCSS: `${GUTTER_CSS}${PLUS_OVER_NUMBER_CSS}`,
      onLineSelectionChange: (range: SelectedLineRange | null) =>
        setSelection(range),
      /** Press ＋ for one line, drag it for a block, or press it over a selection. */
      onGutterUtilityClick: (range: SelectedLineRange) => {
        const { path: current, blockId: id, onComposer: open } = latest.current;
        const anchor = anchorForRange(current, range);
        if (anchor != null) return open({ blockId: id, anchor, range });
        toast.add({ title: mixedSelectionMessage(diffStyle) });
        // Cleared once Pierre has committed the range, so the next ＋ starts fresh.
        queueMicrotask(() => setSelection(null));
      },
    }),
    [resolvedTheme, diffStyle, preferences.lineOverflow],
  );

  const annotations = useMemo(() => {
    const notes: Note[] = [
      ...shownThreads.map((thread): Note => ({ kind: 'thread', thread })),
      ...(mine == null
        ? []
        : [{ kind: 'composer', anchor: mine.anchor } as Note]),
    ];
    return notes.flatMap((note): DiffLineAnnotation<Note>[] => {
      const place = notePlacement(note);
      // Pierre's metadata type distributes over the Note union; one shape covers both kinds.
      return place == null
        ? []
        : [
            {
              side: place.side,
              lineNumber: place.lineNumber,
              metadata: note,
            } as DiffLineAnnotation<Note>,
          ];
    });
  }, [shownThreads, mine]);

  return (
    <div className="@container overflow-hidden rounded-lg border bg-card">
      <div className="flex h-8 items-center gap-2 border-b bg-muted/30 pr-1 pl-2.5">
        <BlockTitle path={path} lines={lines} />
        <div className="ml-auto flex shrink-0 items-center">
          <BlockAction
            icon={<MessageSquarePlus className="size-3.5" />}
            label="Comment"
            onClick={() =>
              onComposer({ blockId, anchor: anchorForFile(path), range: null })
            }
          />
          <BlockAction
            icon={<FileCode className="size-3.5" />}
            label="Open file"
            onClick={onOpenFile}
          />
          {onOpenDiff != null && (
            <BlockAction
              icon={<FileDiffIcon className="size-3.5" />}
              label="Open diff"
              onClick={onOpenDiff}
            />
          )}
        </div>
      </div>
      {ready ? (
        <FileDiff<Note>
          // Pierre's FileDiff kept showing the first diff when handed a new one (the code
          // moved under a step); a new diff mounts a new viewer. Blocks are small, so it is cheap.
          key={fileDiff.cacheKey ?? path}
          fileDiff={fileDiff}
          options={options}
          lineAnnotations={annotations}
          selectedLines={mine?.range ?? selection}
          className="block"
          renderAnnotation={(annotation) => {
            const note = annotation.metadata;
            if (note.kind === 'thread')
              return <ThreadCard thread={note.thread} scope={scope} />;
            return (
              <NewThreadComposer
                key={JSON.stringify(note.anchor)}
                scope={scope}
                anchor={note.anchor}
                onClose={() => {
                  setSelection(null);
                  onComposer(null);
                }}
              />
            );
          }}
        />
      ) : (
        <div className="flex flex-col gap-1.5 p-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
    </div>
  );
}
