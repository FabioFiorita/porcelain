import type { FileDraftHandle } from '@porcelain/client/files';
import { CopyIcon, FileDiffIcon, HistoryIcon, PencilIcon } from 'lucide-react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { createPortal } from 'react-dom';
import { CheckIcon, SquareIcon, MessageSquarePlusIcon } from 'lucide-react';
import { BarAction } from '@/shared/workspace/bar-action';
import { useReviewChangeItems } from '../queries/reviewed';
import { fileReviewControl } from './reviewed-control';
import { useToggleReviewed } from '../commands/reviewed';
import { toast } from '@/components/ui/toast';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChanges } from '@/features/changes/index';
import { copyText } from '@/shared/workspace/copy';
import { usePreferences } from '@/features/preferences/index';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  FileEditor,
  FileTypeIcon,
  HtmlPreview,
  ImagePreview,
  MarkdownView,
  useDirectory,
  useDiskChangeNotice,
  useFileDraft,
  useTextFile,
} from '@/features/files/index';
import { isImagePath } from '@porcelain/client/files/rules';
import type { FileDraftState } from '@porcelain/client/files';
import { fileEntry } from '../adapters/code-entries';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import type { ReviewScope } from '@porcelain/client/reviews/rules';
import { CodeDocument } from './code-document';
import { DocumentToolbar } from './document-toolbar';
import { FindBar } from './find-bar';
import { StateNotice } from '@/shared/views/state-notice';
import { type ConnectionContext } from '@/shared/workspace/connection';

type FileDocumentProps = {
  scope: ReviewScope;
  context: ConnectionContext;
  interaction: DocumentInteraction;
  path: string;
  onOpen: OpenDocument;
};

export function FileDocument(props: FileDocumentProps) {
  return isImagePath(props.path) ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PreviewFileControls {...props} />
      <FileToolbar path={props.path} copy={false}>
        <ButtonGroup className="max-w-full flex-wrap justify-end">
          <TimelineButton path={props.path} onOpen={props.onOpen} />
          <CopyPath path={props.path} />
        </ButtonGroup>
      </FileToolbar>
      <ImagePreview
        scope={props.scope}
        path={props.path}
        connection={props.context.connection}
      />
    </div>
  ) : (
    <LinkedFileDocument {...props} />
  );
}

function LinkedFileDocument(props: FileDocumentProps) {
  const parent = props.path.split('/').slice(0, -1).join('/');
  const { connection } = props.context;
  const folder = useDirectory(connection, props.scope, parent);
  const name = props.path.split('/').at(-1);
  const link = folder.entries.find((entry) => entry.name === name);
  if (link?.kind === 'symlink')
    return (
      <NotShownFile
        {...props}
        message={`Not followed: symlink to ${link.target ?? 'an unknown target'}`}
      />
    );
  if (link?.kind === 'submodule')
    return <NotShownFile {...props} message="Not followed: submodule" />;
  return <TextFileDocument {...props} />;
}

function NotShownFile({
  message,
  ...props
}: FileDocumentProps & { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PreviewFileControls {...props} />
      <FileToolbar path={props.path} />
      <div className="grid min-h-48 flex-1 place-items-center p-6">
        <StateNotice title="Not shown" description={message} />
      </div>
    </div>
  );
}

function TextFileDocument({
  scope,
  context,
  interaction,
  path,
  onOpen,
}: FileDocumentProps) {
  const { connection } = context;
  const file = useTextFile(connection, scope, path);
  const unreadable = 'kind' in file;
  const { draft, state, reset } = useFileDraft(
    connection,
    scope,
    path,
    unreadable ? '' : file.text,
    unreadable ? '' : (file.contentFingerprint ?? ''),
  );
  if (unreadable && state.owner === null && state.text === state.savedText)
    return (
      <NotShownFile
        scope={scope}
        context={context}
        interaction={interaction}
        onOpen={onOpen}
        path={path}
        message={file.reason}
      />
    );
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
        context={context}
        interaction={interaction}
        path={path}
        text={unreadable ? state.savedText : file.text}
        contentFingerprint={
          unreadable ? state.fingerprint : file.contentFingerprint
        }
        draft={draft}
        draftState={state}
        reset={reset}
        onOpen={onOpen}
      />
    </div>
  );
}

type ReadableFileKind = 'markdown' | 'html' | 'code';
type FileDisplayMode = 'rendered' | 'source';

function ReadableFileDocument({
  scope,
  context,
  interaction,
  path,
  text,
  contentFingerprint,
  draft,
  draftState,
  reset,
  onOpen,
}: FileDocumentProps & {
  text: string;
  contentFingerprint?: string | undefined;
  draft: FileDraftHandle;
  draftState: FileDraftState;
  reset: (text: string, fingerprint: string) => void;
}) {
  const { preferences } = usePreferences();
  const { connection } = context;
  const changes = useChanges(scope, connection);
  const kind = fileKind(path);
  const reviewItem = useReviewChangeItems(scope, context, changes, [path])[0];
  const toggle = useToggleReviewed(scope, context, (notice) =>
    toast.add(notice),
  );
  const changed = changes.changes.some((entry) => entry.path === path);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    defaultFileDisplayMode(kind, preferences),
  );
  const { reveal, active } = interaction;
  const [shownReveal, setShownReveal] = useState<number>();
  if (
    reveal &&
    shownReveal !== reveal.nonce &&
    reveal.anchor.comparison?.kind === 'file' &&
    reveal.anchor.filePath === path
  ) {
    setShownReveal(reveal.nonce);
    setMode('source');
  }
  const [commentRequest, setCommentRequest] = useState<number>();
  const [editing, setEditing] = useState(false);
  const [finding, setFinding] = useState<number>();
  const [foundLine, setFoundLine] = useState<{ line: number; nonce: number }>();
  const editorId = useId();
  useDiskChangeNotice(draft, editorId, contentFingerprint);

  const showingSource = kind === 'code' || mode === 'source';
  useHotkey(SHORTCUTS.findInFile, () => setFinding(Date.now()), {
    enabled: active && showingSource && !editing,
    ignoreInputs: false,
    conflictBehavior: 'allow',
  });
  const leading = (
    <>
      <span
        aria-live="polite"
        className="hidden text-xs text-muted-foreground xl:inline"
      >
        {draftState.diskChanged.has(editorId) ? 'Changed on disk just now' : ''}
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
    </>
  );
  const commands = (
    <>
      {contentFingerprint && (
        <Button
          variant="ghost"
          size="xs"
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
          <PencilIcon />
          <span className="max-narrow:sr-only">
            {draftState.text !== draftState.savedText ? 'Resume edit' : 'Edit'}
          </span>
        </Button>
      )}
      {changed && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onOpen({ kind: 'change', path })}
        >
          <FileDiffIcon />
          <span className="max-narrow:sr-only">Open diff</span>
        </Button>
      )}
      {interaction.toolbarTarget === undefined && (
        <TimelineButton path={path} onOpen={onOpen} />
      )}
      <CopyPath path={path} />
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
          reset(text, contentFingerprint ?? '');
          setEditing(false);
        }}
        renderToolbar={(controls) => (
          <FileToolbar path={path}>{controls}</FileToolbar>
        )}
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      {active && !showingSource && !editing && (
        <RenderedFileShortcuts
          onComment={() => {
            setMode('source');
            setCommentRequest(Date.now());
          }}
          onReview={() => {
            if (reviewItem)
              toggle.toggle(fileReviewControl(scope, context, reviewItem));
          }}
        />
      )}
      {interaction.toolbarTarget &&
        !showingSource &&
        createPortal(
          <>
            <BarAction
              label="Reviewed"
              variant="outline"
              icon={
                reviewItem?.reviewStatus === 'reviewed' ? CheckIcon : SquareIcon
              }
              shortcut={SHORTCUTS.toggleReviewed}
              disabled={!reviewItem?.fingerprint}
              pressed={reviewItem?.reviewStatus === 'reviewed'}
              onClick={() => {
                if (reviewItem)
                  toggle.toggle(fileReviewControl(scope, context, reviewItem));
              }}
            />
            <BarAction
              label="Comment"
              icon={MessageSquarePlusIcon}
              shortcut={SHORTCUTS.commentOnFile}
              onClick={() => {
                setMode('source');
                setCommentRequest(Date.now());
              }}
            />
            <TimelineButton path={path} onOpen={onOpen} />
          </>,
          interaction.toolbarTarget,
        )}
      {mode === 'rendered' && kind !== 'code' ? (
        <>
          <FileToolbar path={path} copy={false}>
            {leading}
            <ButtonGroup className="max-w-full flex-wrap justify-end">
              {commands}
            </ButtonGroup>
          </FileToolbar>
          <RenderedFile
            scope={scope}
            context={context}
            path={path}
            kind={kind}
            text={text}
          />
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {finding !== undefined && (
            <FindBar
              text={text}
              focusRequest={finding}
              onReveal={(line) => setFoundLine({ line, nonce: Date.now() })}
              onClose={() => setFinding(undefined)}
            />
          )}
          <CodeDocument
            scope={scope}
            context={context}
            interaction={interaction}
            headerLeading={
              <>
                {leading}
                {commands}
              </>
            }
            headerActions={
              interaction.toolbarTarget !== undefined ? (
                <TimelineButton path={path} onOpen={onOpen} />
              ) : undefined
            }
            {...(commentRequest !== undefined ? { commentRequest } : {})}
            {...(foundLine !== undefined ? { foundLine } : {})}
            entries={[
              {
                ...fileEntry(`file:${path}`, path, text),
                ...(reviewItem
                  ? { review: fileReviewControl(scope, context, reviewItem) }
                  : {}),
                ...(contentFingerprint
                  ? {
                      comment: {
                        filePath: path,
                        comparison: { kind: 'file' },
                        contentFingerprint,
                      },
                    }
                  : {}),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function RenderedFile({
  scope,
  context,
  path,
  kind,
  text,
}: {
  scope: ReviewScope;
  context: ConnectionContext;
  path: string;
  kind: Exclude<ReadableFileKind, 'code'>;
  text: string;
}) {
  if (kind === 'markdown')
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <MarkdownView text={text} className="mx-auto max-w-[78ch] px-6 py-6" />
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <p className="border-b bg-muted/40 px-3.5 py-1.5 text-2xs text-muted-foreground">
        Sandboxed preview: scripts run, and cannot read Porcelain, your cookies
        or the review API, load anything from the network, submit a form, or
        move the page around them.
      </p>
      <HtmlPreview
        scope={scope}
        path={path}
        html={text}
        connection={context.connection}
      />
    </div>
  );
}

function FileToolbar({
  path,
  children,
  copy = true,
}: {
  path: string;
  children?: ReactNode;
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

function TimelineButton({
  path,
  onOpen,
}: {
  path: string;
  onOpen: OpenDocument;
}) {
  return (
    <BarAction
      label="Timeline"
      icon={HistoryIcon}
      onClick={() => onOpen({ kind: 'timeline', path })}
    />
  );
}

function CopyPath({ path }: { path: string }) {
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-label="Copy path"
      title="Copy path"
      onClick={() => copyText(path, 'path')}
    >
      <CopyIcon />
      <span className="max-narrow:sr-only">Copy path</span>
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
  if (kind === 'markdown' || kind === 'html')
    return preferences.documentsDefault;
  return 'source';
}

function PreviewFileControls({
  scope,
  context,
  interaction,
  path,
  onOpen,
}: FileDocumentProps) {
  const changes = useChanges(scope, context.connection);
  const item = useReviewChangeItems(scope, context, changes, [path])[0];
  const toggle = useToggleReviewed(scope, context, (notice) =>
    toast.add(notice),
  );
  const review = () => {
    if (item) toggle.toggle(fileReviewControl(scope, context, item));
  };
  const comment = () => {
    if (item)
      onOpen(
        { kind: 'change', path },
        { kind: 'file', filePath: path },
        { compose: true },
      );
  };
  if (!interaction.toolbarTarget) return null;
  return (
    <>
      {interaction.active && (
        <RenderedFileShortcuts onReview={review} onComment={comment} />
      )}
      {createPortal(
        <>
          <BarAction
            label="Reviewed"
            variant="outline"
            icon={item?.reviewStatus === 'reviewed' ? CheckIcon : SquareIcon}
            shortcut={SHORTCUTS.toggleReviewed}
            disabled={!item?.fingerprint}
            pressed={item?.reviewStatus === 'reviewed'}
            description={
              item?.fingerprint
                ? 'Reviewed'
                : 'There is no reviewable change for this file.'
            }
            onClick={review}
          />
          <BarAction
            label="Comment"
            icon={MessageSquarePlusIcon}
            shortcut={SHORTCUTS.commentOnFile}
            disabled={!item}
            description={
              item
                ? 'Comment'
                : 'Comments for this preview are available from its diff.'
            }
            onClick={comment}
          />
          <TimelineButton path={path} onOpen={onOpen} />
        </>,
        interaction.toolbarTarget,
      )}
    </>
  );
}

function RenderedFileShortcuts({
  onComment,
  onReview,
}: {
  onComment: () => void;
  onReview: () => void;
}) {
  useHotkey(SHORTCUTS.commentOnFile, onComment, { ignoreInputs: true });
  useHotkey(SHORTCUTS.toggleReviewed, onReview, { ignoreInputs: true });
  return null;
}
