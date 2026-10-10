import { diffSelection } from '@porcelain/client/changes/rules';
import { commitPaths } from '@porcelain/client/history/rules';
import { useState } from 'react';
import { usePreferences } from '../../preferences';
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readChangeDiffWindow,
  readBranchDiffs,
} from '@porcelain/client/changes';
import { readTextFile } from '@porcelain/client/files';
import { selectionKey, type Change } from '@porcelain/client/changes/rules';
import {
  rangeAnchor,
  type CommentAnchor,
  type CommentTarget,
} from '@porcelain/client/reviews/rules';
import { Empty } from '../../../components/ui/empty';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { DiffView } from '../../../components/ui/diff-view';
import { CodeView } from '../../../components/ui/code-view';
import { FileHeader } from '../../../components/ui/file-header';
import { ItemMenu } from '../../../components/ui/item-menu';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import {
  useReviewWorkspace,
  type ReviewWorkspace,
} from '../adapters/workspace';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  commentTarget,
  type ReviewComparison,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { diffPresentation } from '../rules/diff-presentation';
import { ReviewReadState } from './read-state';
import { ReviewedAction } from './review-actions';
import type { DiffContent } from '@porcelain/client/changes/rules';

export function ReviewFileScreen({
  workspaceKey,
  path,
  comparison,
}: {
  workspaceKey?: string | undefined;
  path?: string | undefined;
  comparison: ReviewComparison;
}) {
  const workspace = useReviewWorkspace(workspaceKey ?? '');
  return workspace && path ? (
    <SelectedFile
      key={`${workspace.key}:${path}:${JSON.stringify(comparison)}`}
      workspace={workspace}
      path={path}
      comparison={comparison}
    />
  ) : (
    <Empty
      title="Review unavailable"
      description="Return to Review and select a worktree and changed file."
    />
  );
}

function SelectedFile({
  workspace,
  path,
  comparison,
}: {
  workspace: ReviewWorkspace;
  path: string;
  comparison: ReviewComparison;
}) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: path.split('/').at(-1) ?? path }} />
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
    </View>
  );
}

function ReviewedFile({
  workspace,
  snapshot,
  path,
  comparison,
}: {
  workspace: ReviewWorkspace;
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
    <View className="flex-1">
      <FileHeader
        path={path}
        status={file.note}
        reviewed={file.reviewStatus === 'reviewed'}
        actions={
          <ReviewedAction
            workspace={workspace}
            snapshot={snapshot}
            file={file}
          />
        }
      />
      {snapshot.kind === 'worktree' ? (
        <WorktreeFile
          key={`${file.fingerprint}:${snapshot.answer.statusToken}`}
          workspace={workspace}
          snapshot={snapshot}
          file={file}
          comparison={comparison}
        />
      ) : (
        <BranchFile
          key={`${file.fingerprint}:${snapshot.answer.head.oid}:${snapshot.answer.mergeBaseOid}`}
          workspace={workspace}
          snapshot={snapshot}
          file={file}
          comparison={comparison}
        />
      )}
    </View>
  );
}

type FileProps = {
  workspace: ReviewWorkspace;
  snapshot: ReviewSnapshot;
  file: ReviewFile;
  comparison: ReviewComparison;
};

function WorktreeFile(
  props: FileProps & {
    snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }>;
  },
) {
  const changes =
    props.snapshot.answer.changes.find((file) => file.path === props.file.path)
      ?.comparisons ?? [];
  const [index, setIndex] = useState(0);
  const change = changes[index] ?? changes[0];
  return (
    <View className="flex-1">
      {changes.length > 1 ? (
        <ItemMenu
          title={`Comparison: ${change?.scope}`}
          actions={changes.map((entry, at) => ({
            id: String(at),
            label: entry.scope,
            onPress: () => setIndex(at),
          }))}
        />
      ) : null}
      {change ? (
        <WorktreeComparison key={change.scope} {...props} change={change} />
      ) : null}
    </View>
  );
}

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

function WorktreeDiff({
  workspace,
  snapshot,
  file,
  comparison,
  change,
}: FileProps & {
  snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }>;
  change: Change;
}) {
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
  const content = selection
    ? window.result.value.get(selectionKey(selection))
    : undefined;
  return content ? (
    <DiffContentView
      content={content}
      workspace={workspace}
      comparison={comparison}
      target={commentTarget(snapshot, file, selection?.scope)}
    />
  ) : (
    <Empty
      title="Diff unavailable"
      description="This comparison did not return a diff. Return to Review and refresh."
    />
  );
}

function BranchFile({
  workspace,
  snapshot,
  file,
  comparison,
}: FileProps & { snapshot: Extract<ReviewSnapshot, { kind: 'branch' }> }) {
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
      workspace={workspace}
      snapshot={snapshot}
      file={file}
      comparison={comparison}
      paths={commitPaths(entry)}
      baseOid={snapshot.answer.mergeBaseOid}
    />
  );
}

function BranchDiff({
  workspace,
  snapshot,
  file,
  comparison,
  paths,
  baseOid,
}: FileProps & {
  snapshot: Extract<ReviewSnapshot, { kind: 'branch' }>;
  paths: string[];
  baseOid: string;
}) {
  const query = readBranchDiffs({
    connection: workspace.connection,
    scope: workspace.scope,
    input: { baseOid, headOid: snapshot.answer.head.oid, paths: [paths] },
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  const content = result.value.diffs[0]?.content;
  return content ? (
    <DiffContentView
      content={content}
      workspace={workspace}
      comparison={comparison}
      target={commentTarget(snapshot, file)}
    />
  ) : (
    <Empty
      title="Diff unavailable"
      description="This comparison did not return a diff."
    />
  );
}

function UntrackedFile({
  workspace,
  snapshot,
  file,
  comparison,
}: FileProps & { snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }> }) {
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
    return (
      <View className="flex-1">
        <FileCommentAction
          workspace={workspace}
          comparison={comparison}
          target={commentTarget(snapshot, file, 'untracked')}
        />
        <Empty title="File unavailable" description={result.value.reason} />
      </View>
    );
  return (
    <SelectableContent
      key={result.value.contentFingerprint}
      workspace={workspace}
      comparison={comparison}
      target={commentTarget(snapshot, file, 'untracked')}
      source={result.value.text}
    />
  );
}

function DiffContentView({
  content,
  ...props
}: {
  content: DiffContent;
  workspace: ReviewWorkspace;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
}) {
  const { preferences } = usePreferences();
  const presentation = diffPresentation(content);
  if (presentation.kind === 'notice')
    return (
      <View className="flex-1">
        <FileCommentAction {...props} />
        <Empty
          title={presentation.title}
          description={presentation.description}
        />
      </View>
    );
  if (presentation.kind === 'metadata')
    return (
      <View className="flex-1">
        <FileCommentAction {...props} />
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
  comparison,
  target,
  source,
  lines,
}: {
  workspace: ReviewWorkspace;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
  source?: string;
  lines?: Parameters<typeof DiffView>[0]['lines'];
}) {
  const { preferences } = usePreferences();
  const [selection, setSelection] = useState<ReviewRange>();
  const anchor = target
    ? selection
      ? rangeAnchor(target, {
          start: selection.startLine,
          end: selection.endLine,
          ...(selection.side ? { side: selection.side } : {}),
        })
      : { ...target, kind: 'file' as const }
    : undefined;
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 py-2">
        <CommentAction
          workspace={workspace}
          comparison={comparison}
          anchor={anchor ?? undefined}
          label={selection ? 'Comment on selected lines' : 'Comment on file'}
        />
        {selection ? (
          <Button
            label="Clear selection"
            variant="ghost"
            onPress={() => setSelection(undefined)}
          />
        ) : null}
      </View>
      {lines ? (
        <DiffView
          lines={lines}
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={target ? setSelection : undefined}
        />
      ) : (
        <CodeView
          source={source ?? ''}
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={target ? setSelection : undefined}
        />
      )}
    </View>
  );
}

function FileCommentAction({
  target,
  ...props
}: {
  workspace: ReviewWorkspace;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
}) {
  return (
    <View className="px-4 py-2">
      <CommentAction
        {...props}
        anchor={target ? { ...target, kind: 'file' } : undefined}
        label="Comment on file"
      />
    </View>
  );
}

function CommentAction({
  workspace,
  comparison,
  anchor,
  label,
}: {
  workspace: ReviewWorkspace;
  comparison: ReviewComparison;
  anchor?: CommentAnchor | undefined;
  label: string;
}) {
  const router = useRouter();
  return (
    <Button
      label={label}
      variant="outline"
      disabled={!anchor}
      onPress={() => {
        if (anchor)
          router.push({
            pathname: '/review-comments',
            params: {
              ...reviewParams(workspace.key, comparison),
              ...(anchor.kind === 'change' ? {} : { path: anchor.filePath }),
              anchor: JSON.stringify(anchor),
              compose: 'true',
            },
          });
      }}
    />
  );
}
