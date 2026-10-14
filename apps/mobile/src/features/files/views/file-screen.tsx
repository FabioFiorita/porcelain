import type { FileTreeEntry } from '@porcelain/client/files/rules';
import { Box } from '../../../components/ui/box';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Stack, usePreventRemove } from 'expo-router';
import { useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { retainFileDraft, type FileDraftHandle } from '@porcelain/client/files';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import {
  WorkspaceGate,
  useDocumentLeave,
  type Workspace,
} from '../../projects';
import { DocumentComments, savedFileCommentTarget } from '../../reviews';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import { usePreferences } from '../../preferences';
import { useDirectories } from '../queries/directory';
import { useTextFile, type FileContents } from '../queries/text';
import { useDraftEditing } from '../commands/edit-draft';
import { usePreviewLink } from '../commands/preview-link';
import { useFileAsset } from '../queries/asset';
import {
  isNativeImagePath,
  sourceLanguage,
} from '../../../shared/rules/file-tree';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileNotice } from '../../../components/ui/file-notice';
import { FileHeader } from '../../../components/ui/file-header';
import { CodeView } from '../../../components/ui/code-view';
import { MarkdownView } from '../../../components/ui/markdown-view';
import { HtmlPreview } from '../../../components/ui/html-preview';
import { ImageView } from '../../../components/ui/image-view';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';

type ContentProps = {
  path: string;
  onEdit?: () => void;
  onDone?: () => void;
  inlineEditing?: boolean;
  leaveScope?: string | undefined;
};

export function FileScreen(props: ContentProps & { workspace: string }) {
  return (
    <>
      <Stack.Screen
        options={{ title: props.path.split('/').at(-1) ?? 'File' }}
      />
      <WorkspaceGate
        title="Files"
        expectedWorkspace={props.workspace}
        changed={
          <Empty
            title="Workspace changed"
            description="Return to Files and choose a file in the selected worktree."
          />
        }
      >
        {(selected) => (
          <FileContent
            key={`${selected.key}:${props.path}`}
            {...props}
            selected={selected}
          />
        )}
      </WorkspaceGate>
    </>
  );
}

export function FileContent(props: ContentProps & { selected: Workspace }) {
  const { path, selected } = props;
  const parent = path.split('/').slice(0, -1).join('/');
  const directories = useDirectories({
    connection: selected.connection,
    scope: selected.scope,
    paths: [parent],
  });
  const result = directories.results[0];
  const data = result
    ? Option.getOrUndefined(AsyncResult.value(result))
    : undefined;
  if (result && AsyncResult.isFailure(result) && !data)
    return (
      <ErrorState
        message={fileErrorMessage(Cause.squash(result.cause))}
        retry={{ label: 'Read folder again', onPress: directories.refresh }}
      />
    );
  if (!data) return <Loading label="Reading file…" />;
  const entry = data.entries.find(
    (candidate) => candidate.name === path.split('/').at(-1),
  );
  if (!entry)
    return (
      <FileNotice
        kind="unavailable"
        description="This file is no longer in the worktree."
      />
    );
  if (entry.kind !== 'file')
    return (
      <FileNotice
        kind="unsupported"
        description={unsupportedEntryDescription(entry)}
      />
    );
  return (
    <Box className="flex-1" surface="background">
      {!props.inlineEditing || isNativeImagePath(path) ? (
        <FileHeader path={path} documentToolbar={props.inlineEditing} />
      ) : null}
      {isNativeImagePath(path) ? (
        <FileImage path={path} selected={selected} />
      ) : (
        <FileText {...props} />
      )}
    </Box>
  );
}

function unsupportedEntryDescription(entry: {
  readonly kind: FileTreeEntry['kind'];
  readonly target?: string | undefined;
}) {
  if (entry.kind === 'symlink')
    return `Not followed: symlink to ${entry.target ?? 'an unknown target'}.`;
  if (entry.kind === 'submodule') return 'Not followed: submodule.';
  return 'This entry is not a regular file.';
}

function FileImage({ path, selected }: { path: string; selected: Workspace }) {
  const asset = useFileAsset(selected.connection, selected.scope, path);
  const data = Option.getOrUndefined(AsyncResult.value(asset.result));
  if (AsyncResult.isFailure(asset.result))
    return (
      <ErrorState
        message={fileErrorMessage(Cause.squash(asset.result.cause))}
        retry={{ label: 'Read image again', onPress: asset.refresh }}
      />
    );
  return data ? (
    <ImageView data={data.base64} label={path} />
  ) : (
    <Loading label="Reading image…" />
  );
}

function FileText(props: ContentProps & { selected: Workspace }) {
  const file = useTextFile(
    props.selected.connection,
    props.selected.scope,
    props.path,
  );
  const data = Option.getOrUndefined(AsyncResult.value(file.result));
  if (AsyncResult.isFailure(file.result) && !data)
    return (
      <ErrorState
        message={fileErrorMessage(Cause.squash(file.result.cause))}
        retry={{ label: 'Read file again', onPress: file.refresh }}
      />
    );
  if (!data) return <Loading label="Reading file…" />;
  if ('kind' in data)
    return <FileNotice kind="unsupported" description={data.reason} />;
  return (
    <View className="flex-1">
      {AsyncResult.isFailure(file.result) ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(file.result.cause))}
          retry={{ label: 'Read file again', onPress: file.refresh }}
        />
      ) : null}
      <ReadableFile
        {...props}
        file={data}
        waiting={file.result.waiting || AsyncResult.isFailure(file.result)}
      />
    </View>
  );
}

function ReadableFile(
  props: ContentProps & {
    selected: Workspace;
    file: FileContents;
    waiting: boolean;
  },
) {
  const [editing, setEditing] = useState(false);
  const { inlineEditing, file, waiting } = props;
  if (props.onDone)
    return (
      <FileEditor
        selected={props.selected}
        path={props.path}
        file={file}
        waiting={waiting}
        onDone={props.onDone}
        leaveScope={props.leaveScope}
      />
    );
  const edit = !file.contentFingerprint || waiting ? undefined : props.onEdit;
  const editInline =
    inlineEditing && file.contentFingerprint && !waiting
      ? () => setEditing(true)
      : edit;
  return (
    <View className="flex-1">
      <View className={editing ? 'hidden' : 'flex-1'}>
        <FilePreview {...props} text={file.text} onEdit={editInline} />
      </View>
      {editing ? (
        <FileEditor
          selected={props.selected}
          path={props.path}
          file={file}
          waiting={waiting}
          onDone={() => setEditing(false)}
          documentToolbar
          leaveScope={props.leaveScope}
        />
      ) : null}
    </View>
  );
}

function FilePreview({
  path,
  text,
  onEdit,
  selected,
  file,
  inlineEditing,
  leaveScope,
}: {
  path: string;
  text: string;
  onEdit: (() => void) | undefined;
  selected: Workspace;
  file: FileContents;
  inlineEditing?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const link = usePreviewLink();
  const edit = onEdit ? (
    <Button label="Edit" variant="outline" size="sm" onPress={onEdit} />
  ) : null;
  if (inlineEditing)
    return (
      <DocumentComments
        workspace={selected}
        leaveScope={leaveScope}
        path={path}
        target={savedFileCommentTarget(path, file.contentFingerprint)}
        renderToolbar={(actions) => (
          <FileHeader
            path={path}
            documentToolbar
            actions={
              <>
                {edit}
                {actions}
              </>
            }
          />
        )}
      >
        {(selection) => (
          <View className="flex-1">
            {link.error ? <ErrorState message={link.error} /> : null}
            <FileContentsPreview
              path={path}
              text={text}
              onLink={link.open}
              {...selection}
            />
          </View>
        )}
      </DocumentComments>
    );
  return (
    <View className="flex-1">
      {edit ? (
        <Box className="items-end" divider="bottom" paddingX={4} paddingY={2}>
          {edit}
        </Box>
      ) : null}
      {link.error ? <ErrorState message={link.error} /> : null}
      <FileContentsPreview path={path} text={text} onLink={link.open} />
    </View>
  );
}

function FileContentsPreview({
  path,
  text,
  onLink,
  selection,
  onSelect,
}: {
  path: string;
  text: string;
  onLink: (url: string) => void;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  const { preferences } = usePreferences();
  if (/\.mdx?$/i.test(path))
    return (
      <MarkdownView
        key={path}
        source={text}
        onLink={onLink}
        initialMode={preferences.markdownDefault}
        wrap={preferences.lineOverflow === 'wrap'}
        selection={selection}
        onSelect={onSelect}
      />
    );
  if (/\.html?$/i.test(path))
    return (
      <View className="flex-1">
        <Box paddingX={4} paddingY={2}>
          <Text variant="caption" tone="muted">
            Linked local assets are not included in this preview.
          </Text>
        </Box>
        <HtmlPreview
          html={text}
          onLink={onLink}
          initialMode={preferences.htmlDefault}
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={onSelect}
        />
      </View>
    );
  const language = sourceLanguage(path);
  return (
    <CodeView
      source={text}
      selection={selection}
      onSelect={onSelect}
      wrap={preferences.lineOverflow === 'wrap'}
      {...(language ? { language } : {})}
    />
  );
}

function FileEditor({
  selected,
  path,
  file,
  waiting,
  onDone,
  documentToolbar,
  leaveScope,
}: {
  selected: Workspace;
  path: string;
  file: FileContents;
  waiting: boolean;
  onDone: () => void;
  documentToolbar?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const [seed, setSeed] = useState<FileContents | undefined>(() =>
    waiting ? undefined : file,
  );
  useEffect(() => {
    if (!seed && !waiting) setSeed(file);
  }, [seed, waiting, file]);
  return seed ? (
    <RetainedFileEditor
      selected={selected}
      path={path}
      file={file}
      seed={seed}
      onDone={onDone}
      documentToolbar={documentToolbar}
      leaveScope={leaveScope}
    />
  ) : (
    <Loading label="Confirming the file version…" />
  );
}

function RetainedFileEditor({
  selected,
  path,
  file,
  seed,
  onDone,
  documentToolbar,
  leaveScope,
}: {
  selected: Workspace;
  path: string;
  file: FileContents;
  seed: FileContents;
  onDone: () => void;
  documentToolbar?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const result = useAtomValue(
    retainFileDraft({
      connection: selected.connection,
      scope: selected.scope,
      path,
      text: seed.text,
      fingerprint: seed.contentFingerprint ?? '',
    }),
  );
  const draft = Option.getOrUndefined(AsyncResult.value(result));
  if (AsyncResult.isFailure(result))
    return (
      <ErrorState message={fileErrorMessage(Cause.squash(result.cause))} />
    );
  if (!file.contentFingerprint)
    return (
      <ErrorState message="The server did not confirm an editable file version." />
    );
  return draft ? (
    <DraftEditor
      draft={draft}
      file={file}
      onDone={onDone}
      path={path}
      documentToolbar={documentToolbar}
      leaveScope={leaveScope}
    />
  ) : (
    <Loading label="Preparing editor…" />
  );
}

function DraftEditor({
  draft,
  file,
  onDone,
  documentToolbar,
  path,
  leaveScope,
}: {
  draft: FileDraftHandle;
  file: FileContents;
  path: string;
  onDone: () => void;
  documentToolbar?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const editing = useDraftEditing(draft, file);
  const { state, claimed } = editing;
  const unsaved = state.saving || state.text !== state.savedText;
  const confirmLeave = (leave: () => void) =>
    Alert.alert(
      'Unsaved changes',
      'Save your changes before leaving this file.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Save and leave', onPress: () => editing.save(leave) },
      ],
    );
  useDocumentLeave(leaveScope, unsaved ? confirmLeave : undefined);
  const disablePrevention = usePreventRemove(unsaved, ({ repeat }) =>
    confirmLeave(repeat),
  );
  const discard = () =>
    Alert.alert(
      'Discard changes?',
      'Replace this draft with the latest version read from the worktree.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            editing.discard(() => {
              disablePrevention();
              onDone();
            });
          },
        },
      ],
    );
  const done = () =>
    editing.save(() => {
      disablePrevention();
      onDone();
    });
  return (
    <View className="flex-1">
      {documentToolbar ? (
        <FileHeader
          path={path}
          documentToolbar
          actions={
            <Button
              label="Done"
              size="sm"
              pending={state.saving}
              disabled={!claimed || editing.blocked}
              onPress={done}
            />
          }
        />
      ) : null}
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={3} paddingX={4} paddingY={4}>
          {!claimed ? (
            <ErrorState message="This file is being edited in another view." />
          ) : null}
          <Text variant="caption" tone="muted">
            {saveStatus(state)} · Changes save automatically.
          </Text>
          {state.error ? (
            <ErrorState
              message={fileErrorMessage(state.error)}
              {...(editing.blocked
                ? {}
                : {
                    retry: {
                      label: 'Save again',
                      onPress: () => editing.save(),
                    },
                  })}
            />
          ) : null}
          {editing.blocked ? (
            <Text variant="ui" tone="destructive">
              The file changed on the computer. Your draft is kept; discard it
              to load the latest version.
            </Text>
          ) : null}
          <Input
            accessibilityLabel="File contents"
            multiline
            className="min-h-96"
            value={state.text}
            onChangeText={editing.change}
            disabled={!claimed || state.saving || editing.blocked}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          {!documentToolbar ? (
            <Button
              label="Save and done"
              pending={state.saving}
              disabled={!claimed || editing.blocked}
              onPress={() =>
                editing.save(() => {
                  disablePrevention();
                  onDone();
                })
              }
            />
          ) : null}
          <Button
            label="Discard changes"
            variant="ghost"
            disabled={state.saving}
            onPress={discard}
          />
        </Box>
      </ScrollView>
    </View>
  );
}

function saveStatus(state: {
  saving: boolean;
  text: string;
  savedText: string;
}) {
  if (state.saving) return 'Saving…';
  if (state.text !== state.savedText) return 'Unsaved changes';
  return 'Saved';
}
