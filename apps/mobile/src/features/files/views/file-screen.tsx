import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Stack, usePreventRemove } from 'expo-router';
import { useAtomValue } from '@effect/atom-react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { retainFileDraft, type FileDraftHandle } from '@porcelain/client/files';
import { fileErrorMessage, isImagePath } from '@porcelain/client/files/rules';
import { useSelectedWorktree } from '../../projects';
import { usePreferences } from '../../preferences';
import { useDirectories } from '../queries/directory';
import { useTextFile, type FileContents } from '../queries/text';
import { useDraftEditing } from '../commands/edit-draft';
import { usePreviewLink } from '../commands/preview-link';
import { useFileAsset } from '../queries/asset';
import { sourceLanguage } from '../../../shared/rules/file-tree';
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

type Selected = NonNullable<ReturnType<typeof useSelectedWorktree>>;
type Props = {
  path: string;
  workspace: string;
  onEdit?: () => void;
  onDone?: () => void;
};

export function FileScreen(props: Props) {
  const selected = useSelectedWorktree();
  return (
    <>
      <Stack.Screen
        options={{ title: props.path.split('/').at(-1) ?? 'File' }}
      />
      {selected && selected.key === props.workspace ? (
        <ScopedFile
          key={`${selected.key}:${props.path}`}
          {...props}
          selected={selected}
        />
      ) : (
        <Empty
          title="Workspace changed"
          description="Return to Files and choose a file in the selected worktree."
        />
      )}
    </>
  );
}

function ScopedFile(props: Props & { selected: Selected }) {
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
  if (result && AsyncResult.isFailure(result))
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
        description={
          entry.kind === 'symlink'
            ? `Not followed: symlink to ${entry.target ?? 'an unknown target'}.`
            : entry.kind === 'submodule'
              ? 'Not followed: submodule.'
              : 'This entry is not a regular file.'
        }
      />
    );
  return (
    <View className="flex-1 bg-background">
      <FileHeader path={path} />
      {isImagePath(path) ? (
        <FileImage path={path} selected={selected} />
      ) : (
        <FileText {...props} />
      )}
    </View>
  );
}

function FileImage({ path, selected }: { path: string; selected: Selected }) {
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

function FileText(props: Props & { selected: Selected }) {
  const file = useTextFile(
    props.selected.connection,
    props.selected.scope,
    props.path,
  );
  const data = Option.getOrUndefined(AsyncResult.value(file.result));
  if (AsyncResult.isFailure(file.result))
    return (
      <ErrorState
        message={fileErrorMessage(Cause.squash(file.result.cause))}
        retry={{ label: 'Read file again', onPress: file.refresh }}
      />
    );
  if (!data) return <Loading label="Reading file…" />;
  if ('kind' in data)
    return <FileNotice kind="unsupported" description={data.reason} />;
  return props.onDone ? (
    <FileEditor
      selected={props.selected}
      path={props.path}
      file={data}
      onDone={props.onDone}
    />
  ) : (
    <FilePreview
      path={props.path}
      text={data.text}
      onEdit={data.contentFingerprint ? props.onEdit : undefined}
    />
  );
}

function FilePreview({
  path,
  text,
  onEdit,
}: {
  path: string;
  text: string;
  onEdit: (() => void) | undefined;
}) {
  const link = usePreviewLink();
  const { preferences } = usePreferences();
  const language = sourceLanguage(path);
  return (
    <View className="flex-1">
      {onEdit ? (
        <View className="items-end border-b border-border px-4 py-2">
          <Button label="Edit" variant="outline" size="sm" onPress={onEdit} />
        </View>
      ) : null}
      {link.error ? <ErrorState message={link.error} /> : null}
      {/\.mdx?$/i.test(path) ? (
        <MarkdownView
          key={path}
          source={text}
          onLink={link.open}
          initialMode={preferences.markdownDefault}
          wrap={preferences.wrapLongLines}
        />
      ) : /\.html?$/i.test(path) ? (
        <View className="flex-1">
          <View className="px-4 py-2">
            <Text variant="caption" tone="muted">
              Linked local assets are not included in this preview.
            </Text>
          </View>
          <HtmlPreview
            html={text}
            onLink={link.open}
            initialMode={preferences.htmlDefault}
            wrap={preferences.wrapLongLines}
          />
        </View>
      ) : (
        <CodeView
          source={text}
          wrap={preferences.wrapLongLines}
          {...(language ? { language } : {})}
        />
      )}
    </View>
  );
}

function FileEditor({
  selected,
  path,
  file,
  onDone,
}: {
  selected: Selected;
  path: string;
  file: FileContents;
  onDone: () => void;
}) {
  const [seed] = useState(() => ({
    text: file.text,
    fingerprint: file.contentFingerprint ?? '',
  }));
  const result = useAtomValue(
    retainFileDraft({
      connection: selected.connection,
      scope: selected.scope,
      path,
      ...seed,
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
    <DraftEditor draft={draft} file={file} onDone={onDone} />
  ) : (
    <Loading label="Preparing editor…" />
  );
}

function DraftEditor({
  draft,
  file,
  onDone,
}: {
  draft: FileDraftHandle;
  file: FileContents;
  onDone: () => void;
}) {
  const editing = useDraftEditing(draft, file);
  const { state, claimed } = editing;
  const disablePrevention = usePreventRemove(
    state.saving || state.text !== state.savedText,
    ({ repeat }) => {
      Alert.alert(
        'Unsaved changes',
        'Save your changes before leaving this file.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Save and leave',
            onPress: () => editing.save(repeat),
          },
        ],
      );
    },
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
  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-3 px-4 py-4">
        {!claimed ? (
          <ErrorState message="This file is being edited in another view." />
        ) : null}
        <Text variant="caption" tone="muted">
          {state.saving
            ? 'Saving…'
            : state.text !== state.savedText
              ? 'Unsaved changes'
              : 'Saved'}{' '}
          · Changes save automatically.
        </Text>
        {state.error ? (
          <ErrorState
            message={fileErrorMessage(state.error)}
            {...(editing.blocked
              ? {}
              : {
                  retry: { label: 'Save again', onPress: () => editing.save() },
                })}
          />
        ) : null}
        {editing.blocked ? (
          <Text variant="ui" tone="destructive">
            The file changed on the computer. Your draft is kept; discard it to
            load the latest version.
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
        <Button
          label="Discard changes"
          variant="ghost"
          disabled={state.saving}
          onPress={discard}
        />
      </View>
    </ScrollView>
  );
}
