import {
  CopyIcon,
  FileDiffIcon,
  MessageSquarePlusIcon,
  PencilIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OpenDocument } from '../../domain/documents';
import type { FileDraft, FileDraftState } from '../../domain/file-draft';
import type { ReviewScope } from '../../domain/review';
import { changePath } from '../../domain/review';
import { useFileDraft } from '../../query/files';
import { useChanges, useTextFile } from '../../query/review';
import { copyText } from '../workspace/copy';
import { usePreferences } from '../workspace/preferences';
import { CodeDocument } from './code-document';
import { fileEntry } from './diff-entries';
import { useDocumentInteraction } from './document-interaction';
import { DocumentToolbar } from './document-toolbar';
import { FileEditor } from './file-editor';
import { FileTypeIcon } from './file-type-icon';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import { ReviewEmpty } from './review-empty';
export function FileDocument({
  scope,
  path,
  onOpen,
}: {
  scope: ReviewScope;
  path: string;
  onOpen: OpenDocument;
}) {
  const { active } = useDocumentInteraction();
  const file = useTextFile(scope, path, active);
  const unreadable = 'kind' in file;
  const { draft, state } = useFileDraft(
    scope,
    path,
    unreadable ? '' : file.text,
    unreadable ? '' : (file.contentFingerprint ?? ''),
  );
  if (unreadable && state.owner === null && state.text === state.savedText)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <FileToolbar path={path} />
        <div className="grid min-h-48 flex-1 place-items-center p-6">
          <ReviewEmpty title="Not shown" description={file.reason} />
        </div>
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {unreadable && (
        <p
          role="alert"
          className="border-b bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200"
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
  const { status } = useChanges(scope);
  const kind = fileKind(path);
  const changed = status.changes.some((change) => changePath(change) === path);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    defaultFileDisplayMode(kind, preferences),
  );
  const [commentRequest, setCommentRequest] = useState<number>();
  const { reveal } = useDocumentInteraction();
  useEffect(() => {
    if (
      reveal?.anchor.comparison?.kind === 'file' &&
      reveal.anchor.filePath === path
    )
      setMode('source');
  }, [reveal, path]);
  const [editing, setEditing] = useState(false);
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
        toolbar={(controls) => (
          <FileToolbar path={path}>{controls}</FileToolbar>
        )}
      />
    );
  const showingSource = kind === 'code' || mode === 'source';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <FileToolbar path={path}>
        <span
          aria-live="polite"
          className="hidden text-xs text-muted-foreground xl:inline"
        >
          {diskChanged ? 'Changed on disk just now' : ''}
        </span>
        {contentFingerprint && (
          <Button
            size="sm"
            variant="ghost"
            disabled={
              draftState.owner !== null && draftState.owner !== editorId
            }
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
        {kind !== 'code' && (
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as FileDisplayMode)}
          >
            <TabsList className="h-7">
              <TabsTrigger value="rendered" className="px-2 text-xs">
                {kind === 'markdown' ? 'Reader' : 'Preview'}
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
            onClick={() => setCommentRequest(Date.now())}
          >
            <MessageSquarePlusIcon className="size-3.5" />
            Comment
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
      </FileToolbar>
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
            Sandboxed preview: scripts run, but the page cannot reach Porcelain,
            your cookies or the network origin.
          </p>
          <HtmlFrame html={text} title={path} className="min-h-0 flex-1" />
        </div>
      ) : (
        <CodeDocument
          scope={scope}
          disableFileHeader
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
          {...(commentRequest !== undefined ? { commentRequest } : {})}
        />
      )}
    </div>
  );
}

function FileToolbar({
  path,
  children,
}: {
  path: string;
  children?: React.ReactNode;
}) {
  const separator = path.lastIndexOf('/') + 1;
  const directory = path.slice(0, separator);
  const name = path.slice(separator);
  return (
    <DocumentToolbar
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
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copy path"
        title="Copy path"
        onClick={() => copyText(path, 'path')}
      >
        <CopyIcon />
      </Button>
    </DocumentToolbar>
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
