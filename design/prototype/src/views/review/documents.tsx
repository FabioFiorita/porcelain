import { formatDistanceToNowStrict } from 'date-fns';
import {
  Copy,
  FileCode,
  FileDiff,
  FileX,
  FolderGit2,
  Link2,
  type LucideIcon,
  MessageSquarePlus,
  Pencil,
} from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { entryKey } from '../../domain/documents';
import { ordinal, shortOid } from '../../domain/history';
import {
  basename,
  changePath,
  documentKind,
  fileState,
  isImagePath,
  type ReviewScope,
} from '../../domain/review';
import { useComments } from '../../query/comments';
import { useDirectory, usePreviewLink, useTextFile } from '../../query/files';
import { useMarks } from '../../query/marks';
import { useChanges, useCommitDiffs, useCommitFiles } from '../../query/review';
import { copyText } from '../workspace/copy';
import { usePreferences } from '../workspace/preferences';
import { ImagePreview } from './binary-change';
import {
  CodeDocument,
  type CodeEntry,
  CollapseAllButton,
  type FileCommentRequest,
} from './code-document';
import { commitEntry } from './diff-entries';
import { DiscardButton } from './discard';
import { MissingDocument, TickButton } from './document-parts';
import { DocumentToolbar } from './document-toolbar';
import { useEditDraft } from './edit-drafts';
import { FileEditor, ResumeEdit } from './file-editor';
import { FileTypeIcon } from './file-type-icon';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import type { DocumentProps } from './overview-document';
import { useMarkActions } from './review-actions';
import { ReviewBoundary, ReviewPending } from './review-boundary';
import { type ChangeRequest, useChangeEntries } from './use-change-entries';
import { useCollapsedFiles } from './use-collapsed-files';

/** One changed file: its diff, a file tick, Discard, and Open file. */
export function ChangeDocument({
  scope,
  active,
  path,
  onOpen,
  reveal,
}: DocumentProps & { path: string }) {
  const requests = useMemo<ChangeRequest[]>(() => [{ path }], [path]);
  const { entries, binaries, changes } = useChangeEntries(scope, requests);
  const marks = useMarks(scope);
  const threads = useComments(scope);
  const actions = useMarkActions(scope, marks);
  // A text diff, or a binary file (an image shows as Before and After).
  const file = entries[0] ?? binaries[0];
  const change = changes.find((candidate) => changePath(candidate) === path);

  if (file == null) {
    return (
      <MissingDocument
        title={change == null ? 'No longer changed' : 'No diff to show'}
        body={
          change == null
            ? `${path} matches its committed version now.`
            : change.scope === 'unmerged'
              ? `${path} is conflicted; open the file to read it.`
              : `Git gave no text diff for ${path}; open the file to read it.`
        }
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen({ kind: 'file', path })}
          >
            Open the file
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar title={<FileTitle path={path} />}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpen({ kind: 'file', path })}
        >
          <FileCode className="size-3.5" />
          {documentKind(path) === 'markdown'
            ? 'Read'
            : documentKind(path) === 'html'
              ? 'Preview'
              : 'Open file'}
        </Button>
        <DiscardButton scope={scope} path={path} variant="button" />
        <TickButton
          state={fileState(marks, path)}
          disabled={actions.isPending}
          onClick={() => actions.toggleFile(file)}
        />
      </DocumentToolbar>
      <CodeDocument
        hotkeysEnabled={active}
        scope={scope}
        entries={entries}
        binaries={binaries}
        threads={threads}
        commentable
        marks={marks}
        onToggleReviewed={actions.toggleFile}
        reveal={reveal}
      />
    </div>
  );
}

/** How long "Changed on disk just now" stays in the toolbar. */
const DISK_CHANGE_NOTE_MS = 8000;

/** Pierre's file-type icon, the folder dimmed, then the file name. */
function FileTitle({ path }: { path: string }) {
  const directory = path.slice(0, path.lastIndexOf('/') + 1);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <FileTypeIcon path={path} className="size-4 shrink-0" />
      {directory !== '' && (
        <span className="truncate font-normal text-muted-foreground">
          {directory}
        </span>
      )}
      <span className="shrink-0">{basename(path)}</span>
    </span>
  );
}

// One header for the file in every mode: reading, previewing, editing, and not shown.
function FileToolbar({
  path,
  children,
}: {
  path: string;
  children?: ReactNode;
}) {
  return (
    <DocumentToolbar title={<FileTitle path={path} />}>
      {children}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copy path"
        title="Copy path"
        onClick={() => copyText(path, 'path')}
      >
        <Copy />
      </Button>
    </DocumentToolbar>
  );
}

/** A file Porcelain will not show: the header and Copy path, nothing to read, comment on or edit. */
function NotShownFile({
  path,
  icon: Icon,
  message,
}: {
  path: string;
  icon: LucideIcon;
  message: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileToolbar path={path} />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

const UNREADABLE_MESSAGE = {
  'unsupported-text':
    'Not shown: this isn’t UTF-8 text, probably a binary file or another encoding.',
  'too-large': 'Not shown: larger than the read limit.',
} as const;

/**
 * Symlinks and submodules are never followed; every other file is read as text.
 * What a path is comes from its folder's listing (the same read the Files tree
 * makes), so a link is known before anything tries to read through it.
 */
export function FileDocument(props: DocumentProps & { path: string }) {
  const slash = props.path.lastIndexOf('/');
  const folder = useDirectory(
    props.scope,
    slash === -1 ? '' : props.path.slice(0, slash),
  );
  if (folder.isPending) return <ReviewPending rows={14} />;
  const entry = folder.data?.entries.find(
    (candidate) => candidate.name === basename(props.path),
  );
  if (entry?.kind === 'symlink') {
    return (
      <NotShownFile
        path={props.path}
        icon={Link2}
        message={`Not followed: symlink to ${entry.target ?? 'an unknown target'}`}
      />
    );
  }
  if (entry?.kind === 'submodule') {
    return (
      <NotShownFile
        path={props.path}
        icon={FolderGit2}
        message="Not followed: submodule"
      />
    );
  }
  // Only an SVG is also text; other images are never read as text.
  if (isImagePath(props.path) && !isSvg(props.path))
    return <ImageFileDocument {...props} />;
  return <TextFileDocument {...props} />;
}

const isSvg = (path: string) => path.toLowerCase().endsWith('.svg');

/** An image, drawn from its preview link. It has no lines to comment on or edit here. */
function ImageFileDocument({
  scope,
  path,
  onOpen,
}: DocumentProps & { path: string }) {
  const { changes } = useChanges(scope);
  const changed = changes.some((change) => changePath(change) === path);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileToolbar path={path}>
        {changed && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpen({ kind: 'change', path })}
          >
            <FileDiff className="size-3.5" />
            Open diff
          </Button>
        )}
      </FileToolbar>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <ReviewBoundary fallback={<ReviewPending rows={6} />}>
          <ImagePreview scope={scope} path={path} className="max-h-[70vh]" />
        </ReviewBoundary>
      </div>
    </div>
  );
}

function TextFileDocument(props: DocumentProps & { path: string }) {
  const file = useTextFile(props.scope, props.path);
  if (file.kind === 'unreadable') {
    return (
      <NotShownFile
        path={props.path}
        icon={FileX}
        message={UNREADABLE_MESSAGE[file.reason]}
      />
    );
  }
  return <ReadableFileDocument {...props} text={file.text} />;
}

/** Say "Changed on disk just now" for a few seconds when the text moves under a reader. */
function useDiskChangeNote(text: string, editing: boolean) {
  const [seen, setSeen] = useState(text);
  // How many times the text moved under the reader; each one restarts the note's timer.
  const [moves, setMoves] = useState(0);
  const [showing, setShowing] = useState(false);
  // State adjusted while rendering: while editing, the seen text follows every
  // save, so your own edits never announce themselves.
  if (text !== seen) {
    setSeen(text);
    if (!editing) {
      setMoves(moves + 1);
      setShowing(true);
    }
  }
  useEffect(() => {
    if (moves === 0) return;
    const timer = setTimeout(() => setShowing(false), DISK_CHANGE_NOTE_MS);
    return () => clearTimeout(timer);
  }, [moves]);
  return { changed: showing, clear: () => setShowing(false) };
}

function ReadableFileDocument({
  scope,
  active,
  path,
  text,
  onOpen,
  reveal,
}: DocumentProps & { path: string; text: string }) {
  const { changes } = useChanges(scope);
  const threads = useComments(scope);
  const { preferences } = usePreferences();
  const kind = documentKind(path);
  // What the file shows besides its source: Markdown reads, HTML and SVG preview.
  const rendering =
    kind === 'markdown'
      ? 'reader'
      : kind === 'html'
        ? 'html'
        : isSvg(path)
          ? 'image'
          : null;
  const changed = changes.some((change) => changePath(change) === path);
  const conflicted = changes.some(
    (change) => change.scope === 'unmerged' && changePath(change) === path,
  );
  const [mode, setMode] = useState<'rendered' | 'source'>(() =>
    // Comments live in the source: a jump to one opens there. Conflict markers only read in the source.
    reveal?.path === path || conflicted
      ? 'source'
      : rendering === 'reader'
        ? preferences.markdownDefault === 'reader'
          ? 'rendered'
          : 'source'
        : (rendering === 'html' && preferences.htmlDefault === 'preview') ||
            rendering === 'image'
          ? 'rendered'
          : 'source',
  );
  // A new jump to a comment or lines here switches to Source, where they are (state adjusted while rendering).
  const [revealed, setRevealed] = useState(reveal?.nonce);
  if (reveal?.nonce !== revealed) {
    setRevealed(reveal?.nonce);
    if (reveal?.path === path) setMode('source');
  }
  const entries = useMemo<CodeEntry[]>(
    () => [{ kind: 'file', path, contents: text }],
    [path, text],
  );
  const [editing, setEditing] = useState(false);
  const [commentOnFile, setCommentOnFile] = useState<FileCommentRequest | null>(
    null,
  );
  const showingSource = rendering == null || mode === 'source';
  const disk = useDiskChangeNote(text, editing);
  const draft = useEditDraft(scope.worktreeId, path);

  if (editing) {
    return (
      <FileEditor
        scope={scope}
        path={path}
        text={text}
        partOfChanges={changed}
        active={active}
        onDone={() => setEditing(false)}
        renderToolbar={(controls) => (
          <FileToolbar path={path}>{controls}</FileToolbar>
        )}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileToolbar path={path}>
        {/* Always mounted and right-aligned with the actions, so the note appearing moves nothing. */}
        <span
          role="status"
          aria-live="polite"
          className="text-[12px] text-muted-foreground"
        >
          {disk.changed && 'Changed on disk just now'}
        </span>
        {rendering != null && (
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as typeof mode)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="rendered" className="px-2 text-xs">
                {rendering === 'reader' ? 'Reader' : 'Preview'}
              </TabsTrigger>
              <TabsTrigger value="source" className="px-2 text-xs">
                Source
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {showingSource && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCommentOnFile({ path, nonce: Date.now() })}
          >
            <MessageSquarePlus className="size-3.5" />
            Comment
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          // An edit still saving on its way out would land under a new editor opened on its old base.
          disabled={draft?.state === 'saving'}
          onClick={() => {
            disk.clear();
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        {changed && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpen({ kind: 'change', path })}
          >
            <FileDiff className="size-3.5" />
            Open diff
          </Button>
        )}
      </FileToolbar>
      <ResumeEdit
        scope={scope}
        path={path}
        onResume={() => {
          disk.clear();
          setEditing(true);
        }}
      />

      {!showingSource && rendering === 'reader' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <MarkdownView
            text={text}
            images={{ scope, path }}
            className="mx-auto max-w-[78ch] px-6 py-6"
          />
        </div>
      ) : !showingSource && rendering === 'image' ? (
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <ReviewBoundary fallback={<ReviewPending rows={6} />}>
            <ImagePreview scope={scope} path={path} className="max-h-[70vh]" />
          </ReviewBoundary>
        </div>
      ) : !showingSource && rendering === 'html' ? (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <p className="border-b bg-muted/40 px-3.5 py-1.5 text-[11px] text-muted-foreground">
            Sandboxed preview: scripts run, but the page cannot reach Porcelain,
            your cookies or the network origin.
          </p>
          <ReviewBoundary fallback={<ReviewPending rows={8} />}>
            <HtmlPreview scope={scope} path={path} />
          </ReviewBoundary>
        </div>
      ) : (
        <CodeDocument
          hotkeysEnabled={active}
          scope={scope}
          entries={entries}
          threads={threads}
          commentable
          reveal={reveal}
          commentOnFile={commentOnFile}
          disableFileHeader
        />
      )}
    </div>
  );
}

/** The file from its own signed link (images and scripts beside it load from the same prefix). */
function HtmlPreview({ scope, path }: { scope: ReviewScope; path: string }) {
  const { url } = usePreviewLink(scope, path);
  return <HtmlFrame src={url} title={path} className="min-h-0 flex-1" />;
}

export function CommitDocument({
  scope,
  active,
  oid,
  reveal,
}: DocumentProps & { oid: string }) {
  // A merge can be read against any of its parents; everything else only has the first.
  // A jump to a comment opens the parent the comment was made against.
  const [parent, setParent] = useState(reveal?.parent ?? 1);
  const [revealed, setRevealed] = useState(reveal?.nonce);
  if (reveal?.nonce !== revealed) {
    setRevealed(reveal?.nonce);
    if (reveal != null) setParent(reveal.parent ?? 1);
  }
  const [, startTransition] = useTransition();
  const files = useCommitFiles(scope, oid, parent);
  const paths = useMemo(
    () => files.files.map((file) => file.newPath ?? file.oldPath ?? ''),
    [files],
  );
  const diffs = useCommitDiffs(scope, oid, paths, parent);
  const threads = useComments(scope);
  const collapse = useCollapsedFiles({
    worktreeId: scope.worktreeId,
    documentKey: entryKey({ kind: 'commit', oid }),
  });
  const entries = diffs.flatMap((diff) => {
    const entry = commitEntry(oid, diff);
    return entry == null ? [] : [entry];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentToolbar
        title={<span className="font-mono">{shortOid(oid)}</span>}
        subtitle={`${files.files.length} file${files.files.length === 1 ? '' : 's'} changed`}
      >
        {files.parentOids.length > 1 && (
          // A transition keeps the current diff on screen while the other parent loads.
          <Tabs
            value={String(parent)}
            onValueChange={(value) =>
              startTransition(() => setParent(Number(value)))
            }
          >
            <TabsList className="h-7">
              {files.parentOids.map((parentOid, index) => (
                <TabsTrigger
                  key={parentOid}
                  value={String(index + 1)}
                  className="px-2 text-xs"
                >
                  {ordinal(index + 1)} parent ·{' '}
                  <span className="font-mono">{shortOid(parentOid)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <CollapseAllButton collapse={collapse} entries={entries} />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copyText(oid, 'commit id')}
        >
          <Copy className="size-3.5" />
          Copy id
        </Button>
      </DocumentToolbar>
      <CodeDocument
        hotkeysEnabled={active}
        scope={scope}
        entries={entries}
        threads={threads}
        // Old code takes comments too; each carries the commit as its revision.
        commentable
        revision={oid}
        parent={parent}
        reveal={reveal}
        collapse={collapse}
        header={() => <CommitHeader oid={oid} files={files} />}
      />
    </div>
  );
}

function CommitHeader({
  oid,
  files,
}: {
  oid: string;
  files: ReturnType<typeof useCommitFiles>;
}) {
  // The commit's own summary travels with its files, so it opens the same from anywhere.
  const commit = files.commit;
  const comparison = files.comparison;
  return (
    <section className="mx-4 mt-3 rounded-xl border px-4 py-3">
      <h2 className="text-sm font-semibold">{commit.subject}</h2>
      {commit.body != null && (
        <p className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {commit.body}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span>
          {commit.author.name} ·{' '}
          {formatDistanceToNowStrict(new Date(commit.author.timestamp), {
            addSuffix: true,
          })}
        </span>
        <span className="font-mono">{oid}</span>
        {comparison.kind === 'parent' ? (
          <span>
            against{' '}
            <span className="font-mono">{shortOid(comparison.baseOid)}</span>
            {files.parentOids.length > 1 &&
              ` (${ordinal(comparison.parentNumber)} parent of a merge)`}
          </span>
        ) : (
          <span>root commit</span>
        )}
        {commit.refs?.map((ref) => (
          <Badge
            key={ref}
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-normal"
          >
            {ref}
          </Badge>
        ))}
      </div>
    </section>
  );
}
