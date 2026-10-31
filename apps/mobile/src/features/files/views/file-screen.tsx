import { useFileReadingLine } from '../store';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { Box } from '../../../components/ui/box';
import { View } from 'react-native';
import { Stack, useIsFocused } from 'expo-router';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { WorkspaceGate, type Workspace } from '../../projects';
import { DocumentComments, savedFileCommentTarget } from '../../reviews';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import { usePreferences } from '../../preferences';
import { useTextFile, type FileContents } from '../queries/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { useFileAsset } from '../queries/asset';
import { isNativeImagePath } from '../../../shared/rules/file-tree';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileNotice } from '../../../components/ui/file-notice';
import { FileHeader } from '../../../components/ui/file-header';
import { CodeView } from '../../../components/ui/code-view';
import { MarkdownView } from '../../../components/ui/markdown-view';
import { HtmlPreview } from '../../../components/ui/html-preview';
import { ImageView } from '../../../components/ui/image-view';
import { Text } from '../../../components/ui/text';

type ContentProps = {
  path: string;
  inlineComments?: boolean;
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
  const focused = useIsFocused();
  return focused ? <FileContentView {...props} /> : null;
}

function FileContentView(props: ContentProps & { selected: Workspace }) {
  const { path, selected } = props;
  return (
    <Box className="flex-1" surface="background">
      {!props.inlineComments || isNativeImagePath(path) ? (
        <FileHeader path={path} documentToolbar={props.inlineComments} />
      ) : null}
      {isNativeImagePath(path) ? (
        <FileImage path={path} selected={selected} />
      ) : (
        <FileText {...props} />
      )}
    </Box>
  );
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
      <FilePreview {...props} file={data} text={data.text} />
    </View>
  );
}

function FilePreview({
  path,
  text,
  selected,
  file,
  inlineComments,
  leaveScope,
}: {
  path: string;
  text: string;
  selected: Workspace;
  file: FileContents;
  inlineComments?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const link = usePreviewLink();
  if (inlineComments)
    return (
      <DocumentComments
        workspace={selected}
        leaveScope={leaveScope}
        path={path}
        target={savedFileCommentTarget(path, file.contentFingerprint)}
        renderToolbar={(actions) => (
          <FileHeader path={path} documentToolbar actions={actions} />
        )}
      >
        {(selection) => (
          <View className="flex-1">
            {link.error ? <ErrorState message={link.error} /> : null}
            <FileContentsPreview
              workspace={selected.key}
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
      {link.error ? <ErrorState message={link.error} /> : null}
      <FileContentsPreview
        workspace={selected.key}
        path={path}
        text={text}
        onLink={link.open}
      />
    </View>
  );
}

function FileContentsPreview({
  workspace,
  path,
  text,
  onLink,
  selection,
  onSelect,
}: {
  workspace: string;
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
        initialMode={
          preferences.documentsDefault === 'rendered' ? 'reader' : 'source'
        }
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
          initialMode={
            preferences.documentsDefault === 'rendered' ? 'preview' : 'source'
          }
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={onSelect}
        />
      </View>
    );
  return (
    <FileCode
      workspace={workspace}
      path={path}
      text={text}
      selection={selection}
      onSelect={onSelect}
      wrap={preferences.lineOverflow === 'wrap'}
    />
  );
}

function FileCode({
  workspace,
  path,
  text,
  selection,
  onSelect,
  wrap,
}: {
  workspace: string;
  path: string;
  text: string;
  selection: ReviewRange | undefined;
  onSelect: ((range: ReviewRange) => void) | undefined;
  wrap: boolean;
}) {
  const reading = useFileReadingLine(workspace, path, text);
  const language = sourceLanguage(path);
  return (
    <CodeView
      {...reading}
      source={text}
      selection={selection}
      onSelect={onSelect}
      wrap={wrap}
      {...(language ? { language } : {})}
    />
  );
}
