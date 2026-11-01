import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { diffSelection } from '@porcelain/client/changes/rules';
import { commitPaths } from '@porcelain/client/history/rules';
import { Box } from '../../../components/ui/box';
import { usePreferences } from '../../preferences';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useAtom, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import {
  readChangeDiffWindow,
  readBranchDiffs,
} from '@porcelain/client/changes';
import { readTextFile } from '@porcelain/client/files';
import { selectionKey, type Change } from '@porcelain/client/changes/rules';
import {
  type CommentAnchor,
  type CommentTarget,
  commentIsStale,
  matchesCommentTarget,
} from '@porcelain/client/reviews/rules';
import {
  DocumentComments,
  type DocumentCodeSelection,
} from './document-comments';
import { documentCommentAnchor } from '../rules/document-comment';
import { Empty } from '../../../components/ui/empty';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { DiffView } from '../../../components/ui/diff-view';
import { CodeView } from '../../../components/ui/code-view';
import { FileHeader } from '../../../components/ui/file-header';
import { ChangeComparisonMenu } from './change-comparison-menu';
import type { ReviewRange } from '../../../components/ui/review-annotation';
import { WorkspaceGate, type Workspace } from '../../projects';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  commentTarget,
  documentReviewTarget,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { diffPresentation } from '../rules/diff-presentation';
import { ReviewReadState } from './read-state';
import { ReviewedAction } from './review-actions';
import type { DiffContent } from '@porcelain/client/changes/rules';
import { useDocumentReadingLine } from '../../../shared/application/document-reading';
import { documentTab } from '../../../shared/rules/workspace-documents';
import { documentSelectionState, reviewFileScope } from '../store';

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
  return (
    <>
      <Stack.Screen
        options={{ title: path?.split('/').at(-1) ?? 'Changed file' }}
      />
      <WorkspaceGate
        title="Review"
        expectedWorkspace={workspaceKey ?? ''}
        changed={changed}
      >
        {(workspace) =>
          path ? (
            <ReviewFileContent
              key={`${workspace.key}:${path}:${JSON.stringify(comparison)}`}
              workspace={workspace}
              path={path}
              comparison={comparison}
            />
          ) : (
            changed
          )
        }
      </WorkspaceGate>
    </>
  );
}

type ReviewFileContentProps = {
  workspace: Workspace;
  path: string;
  comparison: ReviewComparison;
  inlineComments?: boolean | undefined;
  leaveScope?: string | undefined;
};

export function ReviewFileContent(props: ReviewFileContentProps) {
  const focused = useIsFocused();
  return focused ? <FocusedReviewFileContent {...props} /> : null;
}

function FocusedReviewFileContent({
  workspace,
  path,
  comparison,
  inlineComments = false,
  leaveScope,
}: ReviewFileContentProps) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  const [comparisonScope, setComparisonScope] = useAtom(
    reviewFileScope(
      JSON.stringify([
        workspace.key,
        documentTab({ kind: 'review-file', path, comparison }).key,
      ]),
    ),
  );
  const target = documentReviewTarget(
    AsyncResult.isSuccess(result) ? result.value : undefined,
    path,
    comparisonScope,
  );
  const content = (codeSelection?: DocumentCodeSelection) => (
    <Box className="flex-1" surface="background">
      {AsyncResult.isSuccess(result) ? (
        <ReviewedFile
          workspace={workspace}
          snapshot={result.value}
          path={path}
          comparison={comparison}
          inlineComments={inlineComments}
          codeSelection={codeSelection}
          comparisonScope={comparisonScope}
          onComparisonScopeChange={setComparisonScope}
        />
      ) : (
        <ReviewReadState result={result} refresh={refresh} />
      )}
    </Box>
  );
  return inlineComments ? (
    <DocumentComments
      workspace={workspace}
      path={path}
      document={documentTab({ kind: 'review-file', path, comparison }).key}
      target={target}
      leaveScope={leaveScope}
    >
      {(codeSelection) => content(codeSelection)}
    </DocumentComments>
  ) : (
    content()
  );
}

function ReviewedFile({
  workspace,
  snapshot,
  path,
  comparison,
  inlineComments,
  codeSelection,
  comparisonScope,
  onComparisonScopeChange,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  path: string;
  comparison: ReviewComparison;
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
  comparisonScope?: string | undefined;
  onComparisonScopeChange: (scope: string) => void;
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
        documentToolbar={inlineComments}
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
          workspace={workspace}
          snapshot={snapshot}
          file={file}
          comparison={comparison}
          inlineComments={inlineComments}
          codeSelection={codeSelection}
          comparisonScope={comparisonScope}
          onComparisonScopeChange={onComparisonScopeChange}
        />
      ) : (
        <BranchFile
          workspace={workspace}
          snapshot={snapshot}
          file={file}
          comparison={comparison}
          inlineComments={inlineComments}
          codeSelection={codeSelection}
          comparisonScope={comparisonScope}
          onComparisonScopeChange={onComparisonScopeChange}
        />
      )}
    </View>
  );
}

type FileProps = {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  file: ReviewFile;
  comparison: ReviewComparison;
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
  comparisonScope?: string | undefined;
  onComparisonScopeChange?: ((scope: string) => void) | undefined;
};

function WorktreeFile(
  props: FileProps & {
    snapshot: Extract<ReviewSnapshot, { kind: 'worktree' }>;
  },
) {
  const changes =
    props.snapshot.answer.changes.find((file) => file.path === props.file.path)
      ?.comparisons ?? [];
  const change =
    changes.find((entry) => entry.scope === props.comparisonScope) ??
    changes[0];
  return (
    <View className="flex-1">
      {changes.length > 1 ? (
        <ChangeComparisonMenu
          current={change?.scope}
          scopes={changes.map((entry) => entry.scope)}
          onScope={(scope) => props.onComparisonScopeChange?.(scope)}
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
  inlineComments,
  codeSelection,
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
      path={file.path}
      workspace={workspace}
      comparison={comparison}
      inlineComments={inlineComments}
      codeSelection={codeSelection}
      target={commentTarget(snapshot, file, selection?.scope)}
    />
  ) : (
    <Empty
      title="Diff unavailable"
      description="This comparison did not return a diff. Return to Review and choose the current change."
    />
  );
}

function BranchFile({
  workspace,
  snapshot,
  file,
  comparison,
  inlineComments,
  codeSelection,
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
      inlineComments={inlineComments}
      codeSelection={codeSelection}
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
  inlineComments,
  codeSelection,
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
      path={file.path}
      workspace={workspace}
      comparison={comparison}
      inlineComments={inlineComments}
      codeSelection={codeSelection}
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
  inlineComments,
  codeSelection,
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
          inlineComments={inlineComments}
          target={commentTarget(snapshot, file, 'untracked')}
        />
        <Empty title="File unavailable" description={result.value.reason} />
      </View>
    );
  return (
    <SelectableContent
      path={file.path}
      workspace={workspace}
      comparison={comparison}
      inlineComments={inlineComments}
      codeSelection={codeSelection}
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
  path: string;
  workspace: Workspace;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
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
  inlineComments,
  codeSelection,
  path,
}: {
  workspace: Workspace;
  path: string;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
  source?: string;
  lines?: Parameters<typeof DiffView>[0]['lines'];
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
}) {
  const { preferences } = usePreferences();
  const document = documentTab({ kind: 'review-file', path, comparison }).key;
  const reading = useDocumentReadingLine(
    workspace.key,
    JSON.stringify([document, target?.comparison]),
    target?.contentFingerprint ?? source ?? '',
  );
  const [selected, setSelected] = useAtom(
    documentSelectionState({
      environmentId: workspace.connection.environmentId,
      ...workspace.scope,
      document,
      comparison: target?.comparison,
    }),
  );
  const selection = selected?.range;
  const select = target
    ? (range: ReviewRange) => setSelected({ range, target })
    : undefined;
  const anchor = documentCommentAnchor(selected?.target ?? target, selection);
  const stale =
    anchor &&
    target &&
    (commentIsStale(anchor, target) || !matchesCommentTarget(anchor, target));
  if (inlineComments)
    return lines ? (
      <DiffView
        {...reading}
        lines={lines}
        wrap={preferences.lineOverflow === 'wrap'}
        {...codeSelection}
      />
    ) : (
      <CodeView
        {...reading}
        source={source ?? ''}
        wrap={preferences.lineOverflow === 'wrap'}
        {...codeSelection}
      />
    );
  return (
    <View className="flex-1">
      <Box className="flex-row items-center" gap={2} paddingX={4} paddingY={2}>
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
            onPress={() => setSelected(undefined)}
          />
        ) : null}
      </Box>
      {stale ? (
        <Box paddingX={4} paddingY={2}>
          <Text variant="caption" tone="muted">
            Code changed since selection. Clear it and select the current saved
            code to update the target.
          </Text>
        </Box>
      ) : null}
      {lines ? (
        <DiffView
          {...reading}
          lines={lines}
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={select}
        />
      ) : (
        <CodeView
          {...reading}
          source={source ?? ''}
          wrap={preferences.lineOverflow === 'wrap'}
          selection={selection}
          onSelect={select}
        />
      )}
    </View>
  );
}

function FileCommentAction({
  target,
  inlineComments,
  ...props
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  target?: CommentTarget | undefined;
  inlineComments?: boolean | undefined;
}) {
  if (inlineComments) return null;
  return (
    <Box paddingX={4} paddingY={2}>
      <CommentAction
        {...props}
        anchor={target ? { ...target, kind: 'file' } : undefined}
        label="Comment on file"
      />
    </Box>
  );
}

function CommentAction({
  workspace,
  comparison,
  anchor,
  label,
}: {
  workspace: Workspace;
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
