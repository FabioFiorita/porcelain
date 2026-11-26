import { useHotkeysEnabled } from '@/shared/hooks/use-hotkeys-enabled';
import { useElement } from '@/shared/hooks/use-element';
import type { FileDraftHandle } from '@porcelain/client/files';
import { useWorkspaceWriteBlock } from '@/shared/workspace/connection';
import { CopyIcon, FileDiffIcon, HistoryIcon, PencilIcon } from 'lucide-react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { createPortal } from 'react-dom';
import { BarAction } from '@/shared/workspace/bar-action';
import { useReviewChangeItems } from '../queries/reviewed';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useChanges,
  useChangeDiffs,
  diffEntry,
} from '@/features/changes/index';
import { diffSelection, selectionKey } from '@porcelain/client/changes/rules';
import { FileHeading } from './file-heading';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { copyText } from '@/shared/workspace/copy';
import { usePreferences } from '@/features/preferences/index';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';
import {
  FileEditor,
  HtmlPreview,
  ImagePreview,
  MarkdownOutlineMenu,
  MarkdownReader,
  scrollToFragment,
  useDirectory,
  useMarkdownDocument,
  useReaderPlaces,
  useDiskChangeNotice,
  useFileDraft,
} from '@/features/files/index';
import { isImagePath } from '@porcelain/client/files/rules';
import type { FileDraftState } from '@porcelain/client/files';
import { fileEntry } from '../adapters/code-entries';
import type { DocumentInteraction, OpenDocument } from '../rules/documents';
import type { ReviewScope } from '@porcelain/client/changes/rules';
import { CodeDocument } from './code-document';
import { FindBar } from './find-bar';
import { StateNotice } from '@/shared/views/state-notice';
import { MARKDOWN_READER_MAX_CHARACTERS } from '@/config/limits';
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
        <StateNotice message={message} />
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
  const { file, draft, state, reset, edit } = useFileDraft(
    context,
    scope,
    path,
  );
  const unreadable = 'kind' in file;
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
        edit={edit}
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
  edit,
  onOpen,
}: FileDocumentProps & {
  text: string;
  contentFingerprint?: string | undefined;
  draft: FileDraftHandle;
  draftState: FileDraftState;
  reset: (text: string, fingerprint: string) => void;
  edit: (owner: string) => boolean;
}) {
  const { preferences } = usePreferences();
  const writeBlock = useWorkspaceWriteBlock(context);
  const { connection } = context;
  const changes = useChanges(scope, connection);
  const kind = fileKind(path);
  const reviewItem = useReviewChangeItems(scope, context, changes, [path])[0];
  const comparisons = reviewItem?.comparisons ?? [];
  const comparison =
    comparisons.find((change) => change.scope === 'unstaged') ?? comparisons[0];
  const selection = comparison ? diffSelection(comparison) : undefined;
  const diffs = useChangeDiffs(
    scope,
    connection,
    reviewItem?.statusToken ?? '',
    reviewItem?.read ?? 0,
    reviewItem ? [{ path, fingerprint: reviewItem.fingerprint }] : [],
    selection ? [selection] : [],
  );
  const content = selection
    ? diffs.diffs.get(selectionKey(selection))
    : undefined;
  const diff =
    comparison &&
    comparison.scope !== 'untracked' &&
    comparison.scope !== 'unmerged' &&
    content
      ? diffEntry(comparison, content)?.fileDiff
      : undefined;
  const note =
    comparison && 'kind' in comparison
      ? `${comparison.scope} · ${comparison.kind}`
      : comparison?.scope;
  const changed = changes.changes.some((entry) => entry.path === path);
  const large =
    kind === 'markdown' && text.length > MARKDOWN_READER_MAX_CHARACTERS;
  const [renderLarge, setRenderLarge] = useState(false);
  const [mode, setMode] = useState<FileDisplayMode>(() =>
    large ? 'source' : defaultFileDisplayMode(kind, preferences),
  );
  const { active } = interaction;
  const [editing, setEditing] = useState(false);
  const [finding, setFinding] = useState<number>();
  const [foundLine, setFoundLine] = useState<{ line: number; nonce: number }>();
  const { element: codeArea, attach: attachCodeArea } =
    useElement<HTMLDivElement>();
  const { element: reader, attach: attachReader } =
    useElement<HTMLDivElement>();
  const reading =
    kind === 'markdown' && mode === 'rendered' && (!large || renderLarge);
  const markdown = useMarkdownDocument(reading ? text : '');
  const places = useReaderPlaces();
  const openPath = (target: string, hash: string) => {
    if (target !== path) {
      places.openAt(`${scope.worktreeId}:${target}`, hash);
      onOpen({ kind: 'file', path: target });
      return;
    }
    const content = reader?.querySelector('[data-markdown-root]');
    if (hash && content) scrollToFragment(content, hash);
  };
  const editorId = useId();
  useDiskChangeNotice(draft, editorId, contentFingerprint);

  const showingSource = kind === 'code' || mode === 'source';
  const hotkeysEnabled = useHotkeysEnabled();
  useHotkey(SHORTCUTS.findInFile, () => setFinding(Date.now()), {
    enabled: hotkeysEnabled && active && showingSource && !editing,
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
      {kind === 'markdown' &&
        mode === 'rendered' &&
        (!large || renderLarge) && (
          <MarkdownOutlineMenu outline={markdown.outline} root={reader} />
        )}
      {kind !== 'code' && (
        <Tabs
          value={mode}
          onValueChange={(value: unknown) => {
            if (value === 'rendered' || value === 'source') setMode(value);
          }}
        >
          <TabsList>
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={
                  Boolean(writeBlock) ||
                  (draftState.owner !== null && draftState.owner !== editorId)
                }
                aria-description={writeBlock}
                aria-label={
                  draftState.text !== draftState.savedText
                    ? 'Resume edit'
                    : 'Edit'
                }
                onClick={() => {
                  if (edit(editorId)) setEditing(true);
                }}
              />
            }
          >
            <PencilIcon />
          </TooltipTrigger>
          <TooltipContent role="tooltip">
            {writeBlock ??
              (draftState.owner !== null && draftState.owner !== editorId
                ? 'Editing in another pane'
                : 'Edit')}
          </TooltipContent>
        </Tooltip>
      )}
      {changed && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open diff"
                onClick={() => onOpen({ kind: 'change', path })}
              />
            }
          >
            <FileDiffIcon />
          </TooltipTrigger>
          <TooltipContent role="tooltip">Open diff</TooltipContent>
        </Tooltip>
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
        writeBlock={writeBlock}
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

  let rendered: ReactNode;
  if (large && !renderLarge)
    rendered = (
      <div className="grid min-h-48 flex-1 place-items-center p-6">
        <StateNotice
          message={`This Markdown file is ${Math.round(text.length / 1024)} KB. Rendering it can take a few seconds.`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenderLarge(true)}
            >
              Render it
            </Button>
          }
        />
      </div>
    );
  else if (kind === 'markdown')
    rendered = (
      <MarkdownReader
        key={path}
        document={markdown.document}
        outline={markdown.outline}
        attach={attachReader}
        file={{
          path,
          scope,
          connection: context.connection,
          openPath,
        }}
      />
    );
  else
    rendered = (
      <HtmlPreview
        key={path}
        scope={scope}
        path={path}
        html={text}
        connection={context.connection}
        onOpenPath={(target) => openPath(target, '')}
      />
    );

  return (
    <div className="@container/document flex min-h-0 flex-1 flex-col bg-card">
      {interaction.toolbarTarget &&
        !showingSource &&
        createPortal(
          <>
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
          {rendered}
        </>
      ) : (
        <div ref={attachCodeArea} className="flex min-h-0 flex-1 flex-col">
          {finding !== undefined && (
            <FindBar
              text={text}
              focusRequest={finding}
              onReveal={(line) => setFoundLine({ line, nonce: Date.now() })}
              onClose={() => {
                setFinding(undefined);
                codeArea
                  ?.querySelector<HTMLElement>(
                    '[aria-label="Code content"] [tabindex="-1"]',
                  )
                  ?.focus({ preventScroll: true });
              }}
            />
          )}
          <FileHeading path={path} note={note} diff={diff}>
            {leading}
            {commands}
          </FileHeading>
          <CodeDocument
            comments
            disableFileHeader
            compactThreads
            fileDiff={diff}
            scope={scope}
            context={context}
            interaction={interaction}
            headerActions={
              interaction.toolbarTarget !== undefined ? (
                <TimelineButton path={path} onOpen={onOpen} />
              ) : undefined
            }
            {...(foundLine !== undefined ? { foundLine } : {})}
            entries={[
              {
                ...fileEntry(`file:${path}`, path, text),
              },
            ]}
          />
        </div>
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
  children?: ReactNode;
  copy?: boolean;
}) {
  return (
    <FileHeading path={path}>
      {children}
      {copy && <CopyPath path={path} />}
    </FileHeading>
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
      iconOnly
      icon={HistoryIcon}
      onClick={() => onOpen({ kind: 'timeline', path })}
    />
  );
}

function CopyPath({ path }: { path: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy path"
            onClick={() => copyText(path, 'path')}
          />
        }
      >
        <CopyIcon />
      </TooltipTrigger>
      <TooltipContent role="tooltip">Copy path</TooltipContent>
    </Tooltip>
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

function PreviewFileControls({ interaction, path, onOpen }: FileDocumentProps) {
  if (!interaction.toolbarTarget) return null;
  return createPortal(
    <TimelineButton path={path} onOpen={onOpen} />,
    interaction.toolbarTarget,
  );
}
