import type { TopBarAction } from '../../../components/ui/top-bar-items';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { diffSelection } from '@porcelain/client/changes/rules';
import { commitPaths } from '@porcelain/client/history/rules';
import { Box } from '../../../components/ui/box';
import { usePreferences } from '../../preferences/index';
import { useIsFocused } from 'expo-router';
import { View } from 'react-native';
import { useAtom, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readChangeDiffWindow,
  readBranchDiffs,
} from '@porcelain/client/changes';
import { readTextFile } from '@porcelain/client/files';
import { selectionKey, type Change } from '@porcelain/client/changes/rules';
import { Empty } from '../../../components/ui/empty';
import { Text } from '../../../components/ui/text';
import { DiffView, CodeView } from '../../documents/index';

import {
  DocumentHeader,
  DocumentScreen,
} from '../../../components/ui/document-header';
import { Screen } from '../../../components/ui/screen';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';
import {
  reviewFileDocumentKey,
  reviewFileReadingKey,
} from '../rules/navigation';
import { diffPresentation } from '../rules/diff-presentation';
import { sourceLanguage } from '../../../shared/rules/highlight-code';
import { ReviewReadState } from './read-state';
import { useReviewedAction } from './review-actions';
import type { DiffContent } from '@porcelain/client/changes/rules';
import { useDocumentReadingLine } from '../../../shared/application/document-reading';
import { reviewFileScope } from '../store';

export function ReviewFileScreen({
  workspaceKey,
  path,
  comparison,
}: {
  workspaceKey?: string | undefined;
  path?: string | undefined;
  comparison: ReviewComparison;
}) {
  const changed = (
    <Empty
      title="Review unavailable"
      description="Return to Review and select a worktree and changed file."
    />
  );
  if (!path) return <Screen layout="fixed">{changed}</Screen>;
  return (
    <DocumentScreen path={path}>
      <WorkspaceGate
        title="Review"
        expectedWorkspace={workspaceKey ?? ''}
        changed={changed}
      >
        {(workspace) => (
          <ReviewFileContent
            key={`${workspace.key}:${path}:${JSON.stringify(comparison)}`}
            workspace={workspace}
            path={path}
            comparison={comparison}
          />
        )}
      </WorkspaceGate>
    </DocumentScreen>
  );
}

type ReviewFileContentProps = {
  workspace: Workspace;
  path: string;
  comparison: ReviewComparison;
};

function ReviewFileContent(props: ReviewFileContentProps) {
  const focused = useIsFocused();
  return focused ? <FocusedReviewFileContent {...props} /> : null;
}

function FocusedReviewFileContent({
  workspace,
  path,
  comparison,
}: ReviewFileContentProps) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  return (
    <Box className="flex-1" surface="background">
      {AsyncResult.isSuccess(result) ? (
        <ReviewedFile
          workspace={workspace}
          snapshot={result.value}
          path={path}
          comparison={comparison}
        />
      ) : (
        <ReviewReadState result={result} refresh={refresh} />
      )}
    </Box>
  );
}

function ReviewedFile({
  workspace,
  snapshot,
  path,
  comparison,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  path: string;
  comparison: ReviewComparison;
}) {
  const marks = useReviewMarks(workspace, snapshot);
  if (!AsyncResult.isSuccess(marks.result))
    return <ReviewReadState result={marks.result} refresh={marks.refresh} />;
  const file = reviewFiles(snapshot, marks.result.value).find(
    (item) => item.path === path,
  );
  if (!file)
    return (
      <Empty
        title="No longer changed"
        description="This file is no longer in this comparison. Return to Review for the current changes."
      />
    );
  return (
    <ChangedFile
      workspace={workspace}
      snapshot={snapshot}
      file={file}
      comparison={comparison}
    />
  );
}

function ChangedFile({
  workspace,
  snapshot,
  file,
  comparison,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  file: ReviewFile;
  comparison: ReviewComparison;
}) {
  const documentKey = reviewFileDocumentKey(file.path, comparison);
  const [comparisonScope, setComparisonScope] = useAtom(
    reviewFileScope(JSON.stringify([workspace.key, documentKey])),
  );
  const changes =
    snapshot.kind === 'worktree'
      ? (snapshot.answer.changes.find((entry) => entry.path === file.path)
          ?.comparisons ?? [])
      : [];
  const change =
    changes.find((entry) => entry.scope === comparisonScope) ?? changes[0];
  const reviewed = useReviewedAction(workspace, snapshot, file);
  const actions: TopBarAction[] = [
    ...(reviewed.action ? [reviewed.action] : []),
    ...(changes.length > 1
      ? [
          {
            kind: 'choice' as const,
            id: 'comparison',
            label: `Comparison: ${change?.scope ?? 'None'}`,
            icon: 'comparison' as const,
            choices: changes.map((entry) => ({
              label: entry.scope,
              selected: entry.scope === change?.scope,
              onPress: () => setComparisonScope(entry.scope),
            })),
          },
        ]
      : []),
  ];
  const fileProps = {
    workspace,
    file,
    comparison,
    scope: change?.scope,
  };
  return (
    <View className="flex-1">
      <DocumentHeader
        path={file.path}
        details={[file.note, reviewStatusDetail(file.reviewStatus)]}
        actions={actions}
      />
      {reviewed.notice}
      {snapshot.kind === 'branch' ? (
        <BranchFile {...fileProps} snapshot={snapshot} />
      ) : null}
      {snapshot.kind === 'worktree' && change ? (
        <WorktreeComparison
          key={change.scope}
          {...fileProps}
          snapshot={snapshot}
          change={change}
        />
      ) : null}
    </View>
  );
}

function reviewStatusDetail(status: ReviewFile['reviewStatus']) {
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'stale') return 'Changed since review';
  return undefined;
}

type FileProps = {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  file: ReviewFile;
  comparison: ReviewComparison;
  scope?: string | undefined;
};

function WorktreeComparison(
  props: FileProps & {
    snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }>;
    change: Change;
  },
) {
  const { change } = props;
  if (change.scope === 'untracked') return <UntrackedFile {...props} />;
  if (change.scope === 'unmerged')
    return (
      <Empty
        title="Conflict"
        description={`This file has an unresolved ${change.conflict} conflict. Resolve it on your computer, then return to Review.`}
      />
    );
  if (!change.supported)
    return (
      <Empty
        title="Unsupported comparison"
        description="This file cannot be compared as a text diff."
      />
    );
  return <WorktreeDiff {...props} change={change} />;
}

function WorktreeDiff(
  props: FileProps & {
    snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }>;
    change: Change;
  },
) {
  const { workspace, snapshot, file, change } = props;
  const selection = diffSelection(change);
  const query = readChangeDiffWindow({
    connection: workspace.connection,
    scope: workspace.scope,
    statusToken: snapshot.answer.statusToken,
    expectedFiles: [
      { path: file.path, fingerprint: file.fingerprint ?? undefined },
    ],
    selections: selection ? [selection] : [],
  });
  const window = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(window.result))
    return <ReviewReadState result={window.result} refresh={refresh} />;
  return (
    <DiffContentView
      {...props}
      content={
        selection ? window.result.value.get(selectionKey(selection)) : undefined
      }
      missing="This comparison did not return a diff. Return to Review and choose the current change."
    />
  );
}

function BranchFile(
  props: FileProps & { snapshot: Extract<ReviewSnapshot, { kind: 'branch' }> },
) {
  const { snapshot, file } = props;
  const entry = snapshot.answer.files.find((item) => item.path === file.path);
  if (!entry || !snapshot.answer.mergeBaseOid)
    return (
      <Empty
        title="No comparison base"
        description="Return to Review and choose a base for this branch."
      />
    );
  return (
    <BranchDiff
      {...props}
      paths={commitPaths(entry)}
      baseOid={snapshot.answer.mergeBaseOid}
    />
  );
}

function BranchDiff({
  paths,
  baseOid,
  ...props
}: FileProps & {
  snapshot: Extract<ReviewSnapshot, { kind: 'branch' }>;
  paths: string[];
  baseOid: string;
}) {
  const { workspace, snapshot } = props;
  const query = readBranchDiffs({
    connection: workspace.connection,
    scope: workspace.scope,
    input: { baseOid, headOid: snapshot.answer.head.oid, paths: [paths] },
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  return (
    <DiffContentView
      {...props}
      content={result.value.diffs[0]?.content}
      missing="This comparison did not return a diff."
    />
  );
}

function UntrackedFile(props: FileProps) {
  const { workspace, file } = props;
  const query = readTextFile({
    connection: workspace.connection,
    scope: workspace.scope,
    path: file.path,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  if ('kind' in result.value)
    return <Empty title="File unavailable" description={result.value.reason} />;
  return <SelectableContent {...props} source={result.value.text} />;
}

function DiffContentView({
  content,
  missing,
  ...props
}: FileProps & { content: DiffContent | undefined; missing: string }) {
  const { preferences } = usePreferences();
  if (!content) return <Empty title="Diff unavailable" description={missing} />;
  const presentation = diffPresentation(content);
  if (presentation.kind === 'notice')
    return (
      <Empty
        title={presentation.title}
        description={presentation.description}
      />
    );
  if (presentation.kind === 'metadata')
    return (
      <View className="flex-1">
        <Text variant="caption" tone="muted">
          Metadata only · no text lines changed
        </Text>
        <CodeView
          source={presentation.source}
          lineNumbers={false}
          wrap={preferences.lineOverflow === 'wrap'}
        />
      </View>
    );
  return <SelectableContent {...props} lines={presentation.lines} />;
}

function SelectableContent({
  workspace,
  file,
  comparison,
  scope,
  source,
  lines,
}: FileProps & {
  source?: string;
  lines?: Parameters<typeof DiffView>[0]['lines'];
}) {
  const { preferences } = usePreferences();
  const reading = useDocumentReadingLine(
    workspace.key,
    reviewFileReadingKey(file.path, comparison, scope),
    file.fingerprint ?? source ?? '',
  );
  return lines ? (
    <DiffView
      {...reading}
      lines={lines}
      language={sourceLanguage(file.path)}
      wrap={preferences.lineOverflow === 'wrap'}
    />
  ) : (
    <CodeView
      {...reading}
      source={source ?? ''}
      language={sourceLanguage(file.path)}
      wrap={preferences.lineOverflow === 'wrap'}
    />
  );
}
