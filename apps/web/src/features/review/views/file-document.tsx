import {
  CopyIcon,
  FileDiffIcon,
  MessageSquarePlusIcon,
  PencilIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAccessStore } from '@/features/access/index';
import { useChanges } from '@/features/changes/index';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OpenDocument } from '@/features/review/model/documents';
import type { FileDraft, FileDraftState } from '@/features/files/index';
import { isImagePath, useDirectory, useTextFile } from '@/features/files/index';
import type { ReviewScope } from '@/features/review/model/review';
import { useFileDraft } from '@/features/files/index';
import { copyText } from '@/shared/workspace/copy';
import { usePreferences } from '@/shared/workspace/preferences';
import { CodeDocument } from './code-document';
import { fileEntry } from './diff-entries';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { FileEditor } from '@/features/files/index';
import { FileTypeIcon } from '@/features/files/index';
import { HtmlPreview } from '@/features/files/index';
import { ImagePreview } from '@/features/files/index';
import { MarkdownView } from '@/features/files/index';
import { ReviewEmpty } from './review-empty';

export function FileDocument(props: {
  scope: ReviewScope;
  path: string;
  onOpen: OpenDocument;
}) {
  return isImagePath(props.path) ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <FileToolbar path={props.path} />
      <ImagePreview scope={props.scope} path={props.path} />
    </div>
  ) : (
    <LinkedFileDocument {...props} />
  );
}

function LinkedFileDocument(props: {
  scope: ReviewScope;
  path: string;
  onOpen: OpenDocument;
}) {
  const parent = props.path.split('/').slice(0, -1).join('/');
  const connection = useAccessStore((state) => state.connection);
  const folder = useDirectory(connection, props.scope, parent);
  const name = props.path.split('/').at(-1);
  const link = folder.entries.find((entry) => entry.name === name);
  if (link?.kind === 'symlink')
    return (
      <NotShownFile
        path={props.path}
        message={`Not followed: symlink to ${link.target ?? 'an unknown target'}`}
      />
    );
  if (link?.kind === 'submodule')
    return <NotShownFile path={props.path} message="Not followed: submodule" />;
  return <TextFileDocument {...props} />;
}

function NotShownFile({ path, message }: { path: string; message: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileToolbar path={path} />
      <div className="grid min-h-48 flex-1 place-items-center p-6">
        <ReviewEmpty title="Not shown" description={message} />
      </div>
    </div>
  );
}

function TextFileDocument({
  scope,
  path,
  onOpen,
}: {
  scope: ReviewScope;
  path: string;
  onOpen: OpenDocument;
}) {
  const { active } = useDocumentInteraction();
  const connection = useAccessStore((state) => state.connection);
  const file = useTextFile(connection, scope, path, active);
  const unreadable = 'kind' in file;
  const { draft, state } = useFileDraft(
    connection,
    scope,
    path,
    unreadable ? '' : file.text,
    unreadable ? '' : (file.contentFingerprint ?? ''),
  );
  if (unreadable && state.owner === null && state.text === state.savedText)
    return <NotShownFile path={path} message={file.reason} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {unreadable && (
        <p
          role="alert"
          className="border-b bg-graph-4/10 px-3.5 py-2 text-xs text-graph-4"
        >
          The file is no longer readable. Your unsaved draft is still available
          below.
        </p>
      )}
      <ReadableFileDocument
        scope={scope}
        path={path}
        text={unreadable ? state.savedText : file.text}
        contentFingerprint={
          unreadable ? state.fingerprint : file.contentFingerprint
        }
        draft={draft}
        draftState={state}
        onOpen={onOpen}
      />
    </div>
  );
}

type ReadableFileKind = 'markdown' | 'html' | 'code';
type FileDisplayMode = 'rendered' | 'source';

function ReadableFileDocument({
  scope,
  path,
  text,
  contentFingerprint,
  draft,
  draftState,
  onOpen,
}: {
  scope: ReviewScope;
  path: string;
  text: string;
  contentFingerprint?: string | undefined;
  draft: FileDraft;
  draftState: FileDraftState;
  onOpen: OpenDocument;
}) {
  const { preferences } = usePreferences();
  const connection = useAccessStore((state) => state.connection);
  const { changes } = useChanges(scope, connection);
  const kind = fileKind(path);
  const changed = changes.changes.some((entry) => entry.path === path);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    defaultFileDisplayMode(kind, preferences),
  );
  const { reveal } = useDocumentInteraction();
  useEffect(() => {
    if (
      reveal?.anchor.comparison?.kind === 'file' &&
      reveal.anchor.filePath === path
    )
      setMode('source');
  }, [reveal, path]);
  const [editing, setEditing] = useState(false);
  const [commentRequest, setCommentRequest] = useState<number>();
  const editorId = useId();
  const { active } = useDocumentInteraction();
  const previousFingerprint = useRef(contentFingerprint);
  const [diskChanged, setDiskChanged] = useState(false);
  useEffect(() => {
    if (previousFingerprint.current === contentFingerprint) return;
    previousFingerprint.current = contentFingerprint;
    if (
      !draft.snapshot().saving &&
      draft.snapshot().owner === null &&
      draft.lastWrittenFingerprint !== contentFingerprint
    )
      setDiskChanged(true);
  }, [contentFingerprint, draft]);
  useEffect(() => {
    if (!diskChanged) return;
    const timer = setTimeout(() => setDiskChanged(false), 8000);
    return () => clearTimeout(timer);
  }, [diskChanged]);

  const showingSource = kind === 'code' || mode === 'source';
  const actions = (
    <>
      <span
        aria-live="polite"
        className="hidden text-xs text-muted-foreground xl:inline"
      >
        {diskChanged ? 'Changed on disk just now' : ''}
      </span>
      {kind !== 'code' && (
        <Tabs
          value={mode}
          onValueChange={(value: unknown) => {
            if (value === 'rendered' || value === 'source') setMode(value);
          }}
        >
          <TabsList className="h-7">
            <TabsTrigger value="rendered">
              {kind === 'markdown' ? 'Reader' : 'Preview'}
            </TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {showingSource && contentFingerprint && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCommentRequest(Date.now())}
        >
          <MessageSquarePlusIcon className="size-3.5" />
          Comment
        </Button>
      )}
      {contentFingerprint && (
        <Button
          size="sm"
          variant="ghost"
          disabled={draftState.owner !== null && draftState.owner !== editorId}
          title={
            draftState.owner && draftState.owner !== editorId
              ? 'Editing in another pane'
              : undefined
          }
          onClick={() => {
            if (draft.claim(editorId)) setEditing(true);
          }}
        >
          <PencilIcon className="size-3.5" />
          {draftState.text !== draftState.savedText ? 'Resume edit' : 'Edit'}
        </Button>
      )}
      {changed && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpen({ kind: 'change', path })}
        >
          <FileDiffIcon className="size-3.5" />
          Open diff
        </Button>
      )}
    </>
  );

  if (editing)
    return (
      <FileEditor
        owner={editorId}
        path={path}
        draft={draft}
        state={draftState}
        active={active}
        changed={changed}
        onDone={() => setEditing(false)}
        onDiscard={() => {
          draft.reset(text, contentFingerprint ?? '');
          setEditing(false);
        }}
        renderToolbar={(controls) => (
          <FileToolbar path={path}>{controls}</FileToolbar>
        )}
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <FileToolbar path={path}>{actions}</FileToolbar>
      {mode === 'rendered' && kind === 'markdown' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <MarkdownView
            text={text}
            className="mx-auto max-w-[78ch] px-6 py-6"
          />
        </div>
      ) : mode === 'rendered' && kind === 'html' ? (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <p className="border-b bg-muted/40 px-3.5 py-1.5 text-[11px] text-muted-foreground">
            Sandboxed preview: scripts run, and cannot read Porcelain, your
            cookies or the review API, load anything from the network, submit a
            form, or move the page around them. A script can still send what it
            sees out by sending this frame to another address.
          </p>
          <HtmlPreview scope={scope} path={path} html={text} />
        </div>
      ) : (
        <CodeDocument
          scope={scope}
          disableFileHeader
          {...(commentRequest !== undefined ? { commentRequest } : {})}
          entries={[
            {
              ...fileEntry(`file:${path}`, path, text),
              comment: {
                filePath: path,
                comparison: { kind: 'file' },
                ...(contentFingerprint ? { contentFingerprint } : {}),
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function FileToolbar({
  path,
  children,
  copy = true,
}: {
  path: string;
  children?: React.ReactNode;
  copy?: boolean;
}) {
  const separator = path.lastIndexOf('/') + 1;
  const directory = path.slice(0, separator);
  const name = path.slice(separator);
  return (
    <DocumentToolbar
      titleLabel={path}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <FileTypeIcon path={path} className="size-4 shrink-0" />
          {directory && (
            <span className="truncate font-normal text-muted-foreground">
              {directory}
            </span>
          )}
          <span className="shrink-0">{name}</span>
        </span>
      }
    >
      {children}
      {copy && <CopyPath path={path} />}
    </DocumentToolbar>
  );
}

function CopyPath({ path }: { path: string }) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Copy path"
      title="Copy path"
      onClick={() => copyText(path, 'path')}
    >
      <CopyIcon />
    </Button>
  );
}

function fileKind(path: string): ReadableFileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) return 'markdown';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  return 'code';
}

function defaultFileDisplayMode(
  kind: ReadableFileKind,
  preferences: ReturnType<typeof usePreferences>['preferences'],
): FileDisplayMode {
  if (kind === 'markdown')
    return preferences.markdownDefault === 'reader' ? 'rendered' : 'source';
  if (kind === 'html')
    return preferences.htmlDefault === 'preview' ? 'rendered' : 'source';
  return 'source';
}
