import { useDocumentReadingLine } from '../../../shared/application/document-reading';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { Box } from '../../../components/ui/box';
import { View } from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRouter,
  useSegments,
} from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import {
  DocumentComments,
  savedFileCommentTarget,
} from '../../workspace/index';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import { usePreferences } from '../../preferences/index';
import { useTextFile, type FileContents } from '../queries/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { useFileAsset } from '../queries/asset';
import { isNativeImagePath } from '../../../shared/rules/file-tree';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileNotice } from '../../../components/ui/file-notice';
import {
  DocumentHeader,
  DocumentScreen,
  type DocumentAction,
} from '../../../components/ui/document-header';
import { CodeView } from '../../../components/ui/code-view';
import {
  MarkdownContent,
  markdownModeToggle,
} from '../../../components/ui/markdown-view';
import {
  HtmlContent,
  htmlModeToggle,
} from '../../../components/ui/html-preview';
import { ImageView } from '../../../components/ui/image-view';
import { Text } from '../../../components/ui/text';
import { onBesideLayout } from '../../../components/ui/list-detail';
import { useOpenFileBeside } from '../commands/open-file';

type ContentProps = {
  path: string;
  leaveScope?: string | undefined;
};

export function FileScreen(props: ContentProps & { workspace: string }) {
  return (
    <DocumentScreen path={props.path}>
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
          <ReturnBeside path={props.path} workspace={selected.key}>
            <FileContent
              key={`${selected.key}:${props.path}`}
              {...props}
              selected={selected}
              place="screen"
              actions={[]}
            />
          </ReturnBeside>
        )}
      </WorkspaceGate>
    </DocumentScreen>
  );
}

export function FilePane({
  path,
  selected,
  actions,
}: {
  path: string;
  selected: Workspace;
  actions: readonly DocumentAction[];
}) {
  return (
    <FileContent
      path={path}
      selected={selected}
      place="pane"
      actions={actions}
    />
  );
}

const returnsBeside = new Set(['index', 'worktrees', 'worktree']);

function ReturnBeside({
  path,
  workspace,
  children,
}: {
  path: string;
  workspace: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const worktrees = useSegments().some((segment) => segment === '(worktrees)');
  const openBeside = useOpenFileBeside(workspace);
  const [returning, setReturning] = useState(false);
  return (
    <View
      className="flex-1"
      collapsable={false}
      onLayout={onBesideLayout(() => {
        const state = navigation.getState();
        const below = state?.routes[state.index - 1]?.name;
        if (returning || !below || !returnsBeside.has(below)) return;
        setReturning(true);
        openBeside(path);
        if (worktrees) router.dismissTo('/worktrees');
        else {
          router.back();
          router.navigate('/worktrees');
        }
      })}
    >
      {children}
    </View>
  );
}

type FileProps = ContentProps & {
  selected: Workspace;
  place: 'screen' | 'pane';
  actions: readonly DocumentAction[];
};

function FileContent(props: FileProps) {
  const focused = useIsFocused();
  return focused ? <FileContentView {...props} /> : null;
}

function useFileActions(props: FileProps) {
  const router = useRouter();
  const timeline: DocumentAction = {
    kind: 'button',
    id: 'timeline',
    label: 'Timeline',
    icon: 'timeline',
    onPress: () =>
      router.push({
        pathname: '/timeline',
        params: { path: props.path, workspace: props.selected.key },
      }),
  };
  return [timeline, ...props.actions];
}

function FileContentView(props: FileProps) {
  const { path, selected } = props;
  const actions = useFileActions(props);
  return (
    <Box className="flex-1" surface="background">
      {isNativeImagePath(path) ? (
        <>
          <DocumentHeader path={path} actions={actions} place={props.place} />
          <FileImage path={path} selected={selected} />
        </>
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

function FileText(props: FileProps) {
  const actions = useFileActions(props);
  const file = useTextFile(
    props.selected.connection,
    props.selected.scope,
    props.path,
  );
  const data = Option.getOrUndefined(AsyncResult.value(file.result));
  const plain = (content: ReactNode) => (
    <>
      <DocumentHeader path={props.path} actions={actions} place={props.place} />
      {content}
    </>
  );
  if (AsyncResult.isFailure(file.result) && !data)
    return plain(
      <ErrorState
        message={fileErrorMessage(Cause.squash(file.result.cause))}
        retry={{ label: 'Read file again', onPress: file.refresh }}
      />,
    );
  if (!data) return plain(<Loading label="Reading file…" />);
  if ('kind' in data)
    return plain(<FileNotice kind="unsupported" description={data.reason} />);
  return (
    <View className="flex-1">
      {AsyncResult.isFailure(file.result) ? (
        <ErrorState
          message={fileErrorMessage(Cause.squash(file.result.cause))}
          retry={{ label: 'Read file again', onPress: file.refresh }}
        />
      ) : null}
      <FilePreview {...props} actions={actions} file={data} text={data.text} />
    </View>
  );
}

function FilePreview({
  path,
  text,
  selected,
  file,
  leaveScope,
  place,
  actions,
}: FileProps & { text: string; file: FileContents }) {
  const link = usePreviewLink();
  const { preferences } = usePreferences();
  const [rendered, setRendered] = useState(
    preferences.documentsDefault === 'rendered',
  );
  const toggle = documentModeToggle(path, rendered);
  const mode: DocumentAction[] = toggle
    ? [
        {
          kind: 'button',
          id: 'mode',
          label: toggle.label,
          icon: rendered ? 'showSource' : 'showRendered',
          onPress: () => setRendered(!rendered),
        },
      ]
    : [];
  return (
    <DocumentComments
      workspace={selected}
      leaveScope={leaveScope}
      path={path}
      document={JSON.stringify(['file', path])}
      target={savedFileCommentTarget(path, file.contentFingerprint)}
      header={({ comments, clearSelection }) => (
        <DocumentHeader
          path={path}
          place={place}
          actions={[
            ...mode,
            comments,
            ...actions,
            ...(clearSelection ? [clearSelection] : []),
          ]}
        />
      )}
    >
      {(selection) => (
        <View className="flex-1">
          {link.error ? <ErrorState message={link.error} /> : null}
          <FileContentsPreview
            workspace={selected.key}
            path={path}
            text={text}
            rendered={rendered}
            onLink={link.open}
            {...selection}
          />
        </View>
      )}
    </DocumentComments>
  );
}

function documentModeToggle(path: string, rendered: boolean) {
  if (/\.mdx?$/i.test(path))
    return markdownModeToggle(rendered ? 'reader' : 'source');
  if (/\.html?$/i.test(path))
    return htmlModeToggle(rendered ? 'preview' : 'source');
  return undefined;
}

function FileContentsPreview({
  workspace,
  path,
  text,
  rendered,
  onLink,
  selection,
  onSelect,
}: {
  workspace: string;
  path: string;
  text: string;
  rendered: boolean;
  onLink: (url: string) => void;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  const { preferences } = usePreferences();
  if (/\.mdx?$/i.test(path))
    return (
      <MarkdownContent
        source={text}
        onLink={onLink}
        mode={rendered ? 'reader' : 'source'}
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
        <HtmlContent
          html={text}
          onLink={onLink}
          mode={rendered ? 'preview' : 'source'}
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
  const reading = useDocumentReadingLine(
    workspace,
    JSON.stringify(['file', path]),
    text,
  );
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
