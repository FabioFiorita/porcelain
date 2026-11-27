import type { TopBarAction } from '../../../components/ui/top-bar-items';
import {
  TopBarActions,
  usePublishedTopBar,
} from '../../../shared/application/top-bar';
import { useDocumentReadingLine } from '../../../shared/application/document-reading';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { Box } from '../../../components/ui/box';
import { View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { useDocumentKeys } from '../../../shared/application/key-commands';
import { useState, type ReactNode } from 'react';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { fileErrorMessage } from '@porcelain/client/files/rules';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import {
  LineSelectionBar,
  codeLines,
  useFileCommentAction,
  useLineComments,
} from '../../workspace/index';
import { usePreferences } from '../../preferences/index';
import { useTextFile, type FileContents } from '../queries/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { useFileAsset } from '../queries/asset';
import { isNativeImagePath } from '../../../shared/rules/file-tree';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Spinner } from '../../../components/ui/spinner';
import {
  DocumentHeader,
  DocumentScreen,
} from '../../../components/ui/document-header';
import {
  CodeView,
  MarkdownContent,
  markdownModeToggle,
  HtmlContent,
  htmlModeToggle,
} from '../../documents/index';

import { ImageView } from '../../../components/ui/image-view';
import { Text } from '../../../components/ui/text';
import {
  useLayoutMove,
  useListDetailLayout,
} from '../../../components/ui/list-detail';
import { useOpenFileBeside } from '../commands/open-file';

type ContentProps = {
  path: string;
  leaveScope?: string | undefined;
};

export function FileScreen(props: ContentProps & { workspace: string }) {
  return (
    <DocumentScreen path={props.path}>
      <WorkspaceGate
        expectedWorkspace={props.workspace}
        changed={<Empty title="Another worktree is selected now." />}
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
  actions: readonly TopBarAction[];
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
  const openBeside = useOpenFileBeside(workspace);
  const layout = useListDetailLayout();
  useLayoutMove({
    place: 'pushed',
    mode: layout.measured,
    onMove: () => {
      openBeside(path);
      router.dismissAll();
    },
  });
  return (
    <View className="flex-1" collapsable={false} onLayout={layout.onLayout}>
      {children}
    </View>
  );
}

type FileProps = ContentProps & {
  selected: Workspace;
  place: 'screen' | 'pane';
  actions: readonly TopBarAction[];
};

function FileContent(props: FileProps) {
  const focused = useIsFocused();
  return focused ? <FileContentView {...props} /> : null;
}

function useFileActions(props: FileProps) {
  const router = useRouter();
  const timeline: TopBarAction = {
    kind: 'button',
    id: 'timeline',
    label: 'Timeline',
    icon: 'timeline',
    shortcut: 'timeline',
    onPress: () =>
      router.push({
        pathname: '/timeline',
        params: { path: props.path, workspace: props.selected.key },
      }),
  };
  return [timeline, ...props.actions];
}

const paneBarChrome = 2;

function FileHeader({
  path,
  actions,
  place,
}: {
  path: string;
  actions: readonly TopBarAction[];
  place: FileProps['place'];
}) {
  const worktreeBarItems = usePublishedTopBar().length;
  return (
    <>
      <DocumentHeader
        path={path}
        actions={actions}
        place={place}
        barItems={
          place === 'pane' ? worktreeBarItems + paneBarChrome : undefined
        }
      />
      {place === 'pane' ? (
        <TopBarActions owner="document-pane" actions={actions} />
      ) : null}
    </>
  );
}

function FileContentView(props: FileProps) {
  const { path, selected } = props;
  const actions = useFileActions(props);
  useDocumentKeys(actions);
  return (
    <Box className="flex-1" surface="background">
      {isNativeImagePath(path) ? (
        <>
          <FileHeader path={path} actions={actions} place={props.place} />
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
  if (AsyncResult.isFailure(asset.result) && !data)
    return (
      <ErrorState
        message={fileErrorMessage(Cause.squash(asset.result.cause))}
        retry={{ label: 'Read image again', onPress: asset.refresh }}
      />
    );
  return data ? <ImageView data={data.base64} label={path} /> : <Spinner />;
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
      <FileHeader path={props.path} actions={actions} place={props.place} />
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
  if (!data) return plain(<Spinner />);
  if ('kind' in data) return plain(<Empty title={data.reason} />);
  return (
    <View className="flex-1">
      <FilePreview {...props} actions={actions} file={data} text={data.text} />
    </View>
  );
}

function FilePreview({
  path,
  text,
  selected,
  place,
  actions,
}: FileProps & { text: string; file: FileContents }) {
  const link = usePreviewLink();
  const { preferences } = usePreferences();
  const [rendered, setRendered] = useState(
    preferences.documentsDefault === 'rendered',
  );
  const toggle = documentModeToggle(path, rendered);
  const mode: TopBarAction[] = toggle
    ? [
        {
          kind: 'button',
          id: 'mode',
          label: toggle.label,
          icon: rendered ? 'showSource' : 'showRendered',
          shortcut: 'documentMode',
          onPress: () => setRendered(!rendered),
        },
      ]
    : [];
  useDocumentKeys(mode);
  const commentOnFile = useFileCommentAction(selected, path);
  const page = JSON.stringify(['file', selected.key, path]);
  return (
    <View className="flex-1">
      <FileHeader
        path={path}
        place={place}
        actions={[...mode, commentOnFile, ...actions]}
      />
      {link.error ? <ErrorState message={link.error} /> : null}
      <FileContentsPreview
        workspace={selected}
        page={page}
        path={path}
        text={text}
        rendered={rendered}
        onLink={link.open}
      />
      <LineSelectionBar workspace={selected} page={page} />
    </View>
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
  page,
  path,
  text,
  rendered,
  onLink,
}: {
  workspace: Workspace;
  page: string;
  path: string;
  text: string;
  rendered: boolean;
  onLink: (url: string) => void;
}) {
  const { preferences } = usePreferences();
  if (text === '') return <Empty title="Empty file" />;
  if (/\.mdx?$/i.test(path))
    return (
      <MarkdownContent
        source={text}
        onLink={onLink}
        mode={rendered ? 'reader' : 'source'}
        wrap={preferences.lineOverflow === 'wrap'}
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
        />
      </View>
    );
  return (
    <FileCode
      workspace={workspace}
      page={page}
      path={path}
      text={text}
      wrap={preferences.lineOverflow === 'wrap'}
    />
  );
}

function FileCode({
  workspace,
  page,
  path,
  text,
  wrap,
}: {
  workspace: Workspace;
  page: string;
  path: string;
  text: string;
  wrap: boolean;
}) {
  const reading = useDocumentReadingLine(
    workspace.key,
    JSON.stringify(['file', path]),
    text,
  );
  const comments = useLineComments({
    workspace,
    page,
    path,
    lines: codeLines(text),
  });
  const language = sourceLanguage(path);
  return (
    <CodeView
      {...reading}
      {...comments}
      source={text}
      wrap={wrap}
      {...(language ? { language } : {})}
    />
  );
}
