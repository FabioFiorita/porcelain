import { useRecoverChangedDiffs } from '../commands/recover-changed-diffs';
import { BottomSheet, Button, Host } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FileDiff } from '../../../shared/diff/file-diff';
import { useReview, useFileDiffs } from '../queries/review';
import { CommentsSheet } from './comments-sheet';

type Props = {
  scope: Parameters<typeof useReview>[0];
  connection: Parameters<typeof useReview>[1];
};

export function WorktreeReview({ scope, connection }: Props) {
  const [range, setRange] = useState<'worktree' | 'branch'>('worktree');
  const [path, setPath] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  const review = useReview(scope, connection, range);
  const file = review.files.find((candidate) => candidate.path === path);
  return (
    <View className="flex-1 bg-background">
      <View className="gap-2 border-b border-border px-4 py-3">
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-foreground"
        >
          Review
        </Text>
        <Host matchContents={{ vertical: true }}>
          <Button
            label={
              range === 'worktree'
                ? 'Show branch changes'
                : 'Show uncommitted changes'
            }
            onPress={() => {
              setPath(null);
              setRange(range === 'worktree' ? 'branch' : 'worktree');
            }}
          />
        </Host>
        <Host matchContents={{ vertical: true }}>
          <Button label="Comments" onPress={() => setComments(true)} />
        </Host>
        <Host matchContents={{ vertical: true }}>
          <Button label="Refresh review" onPress={review.read} />
        </Host>
      </View>
      {review.error ? (
        <Text
          accessibilityRole="alert"
          className="px-4 py-3 text-sm text-destructive"
        >
          Could not read review. Refresh review to try again.
        </Text>
      ) : null}
      {review.marksUnavailable ? (
        <Text className="px-4 py-3 text-sm text-muted-foreground">
          Reviewed marks are unavailable because this branch has no base.
        </Text>
      ) : null}
      {review.isPending ? (
        <Text className="p-6 text-sm text-muted-foreground">
          Reading changes…
        </Text>
      ) : file ? (
        <>
          <View className="gap-2 px-4 py-3">
            <Host matchContents={{ vertical: true }}>
              <Button
                label="Back to changed files"
                onPress={() => setPath(null)}
              />
            </Host>
            <Text selectable className="text-sm font-medium text-foreground">
              {file.path}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {file.note}
              {file.reviewed ? ` · ${file.reviewed}` : null}
            </Text>
          </View>
          <SelectedDiff
            key={`${range}:${path}:${review.changes?.statusToken}:${review.branch?.head.oid}`}
            scope={scope}
            connection={connection}
            review={review}
            range={range}
            path={file.path}
          />
        </>
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
        >
          <View className="gap-4 px-4 py-4">
            <Text
              accessibilityRole="header"
              className="text-sm font-medium text-foreground"
            >
              {range === 'worktree' ? 'Uncommitted changes' : 'Branch changes'}
            </Text>
            {range === 'branch' ? (
              <Text className="text-sm text-muted-foreground">
                {review.branch?.base
                  ? `${review.branch.head.branch ?? 'Detached HEAD'} · ${review.branch.commits} commits since ${review.branch.base.ref}`
                  : 'No default branch to compare.'}
              </Text>
            ) : null}
            {range === 'worktree' && review.published ? (
              <View className="gap-3">
                <Text
                  accessibilityRole="header"
                  className="text-sm font-medium text-foreground"
                >
                  Published review
                </Text>
                {review.published.layers.map((layer) => (
                  <View
                    key={layer.id}
                    className="gap-2 rounded-lg border border-border p-3"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {layer.title}
                    </Text>
                    <Text
                      selectable
                      className="text-sm leading-6 text-foreground"
                    >
                      {layer.summary}
                    </Text>
                    {layer.steps.map((step) => (
                      <View key={step.id} className="gap-1">
                        <Text className="text-sm font-medium text-foreground">
                          {step.title}
                        </Text>
                        <Text
                          selectable
                          className="text-sm leading-6 text-foreground"
                        >
                          {step.text}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {step.pointer.path} · {step.pointer.startLine}–
                          {step.pointer.endLine}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
            {!review.error && review.files.length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                No changed files.
              </Text>
            ) : null}
            {review.files.map((item) => (
              <View
                key={item.path}
                className="gap-1 rounded-lg border border-border p-3"
              >
                <Host matchContents={{ vertical: true }}>
                  <Button
                    label={item.path}
                    onPress={() => setPath(item.path)}
                  />
                </Host>
                <Text className="text-xs text-muted-foreground">
                  {item.note}
                  {item.reviewed ? ` · ${item.reviewed}` : null}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <BottomSheet
        isPresented={comments}
        onDismiss={() => setComments(false)}
        contentPadding={0}
        snapPoints={['half', 'full']}
      >
        {comments ? (
          <CommentsSheet
            scope={scope}
            connection={connection}
            onClose={() => setComments(false)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function SelectedDiff({
  scope,
  connection,
  review,
  range,
  path,
}: Props & {
  review: ReturnType<typeof useReview>;
  range: 'worktree' | 'branch';
  path: string;
}) {
  const recover = useRecoverChangedDiffs(scope, connection);
  const diffs = useFileDiffs(
    scope,
    connection,
    review.changes,
    review.branch,
    range,
    path,
    recover,
  );
  const [comparison, setComparison] = useState(0);
  const selected = diffs.diffs[comparison] ?? diffs.diffs[0];
  if (diffs.error)
    return (
      <View className="gap-3 p-6">
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          Could not read diff. Refresh review to read the latest changes.
        </Text>
        <Host matchContents={{ vertical: true }}>
          <Button label="Read diff again" onPress={diffs.read} />
        </Host>
      </View>
    );
  if (diffs.isPending)
    return (
      <Text className="p-6 text-sm text-muted-foreground">Reading diff…</Text>
    );
  if (!selected)
    return (
      <Text className="p-6 text-sm text-muted-foreground">
        {diffs.unavailable ?? 'Diff unavailable for this comparison.'}
      </Text>
    );
  return (
    <View className="flex-1">
      {diffs.diffs.length > 1 ? (
        <Host matchContents={{ vertical: true }}>
          <Button
            label={`Showing ${selected.label} · Switch comparison`}
            onPress={() => setComparison((comparison + 1) % diffs.diffs.length)}
          />
        </Host>
      ) : (
        <Text className="px-4 py-2 text-xs text-muted-foreground">
          {selected.label}
        </Text>
      )}
      <FileDiff content={selected.content} />
    </View>
  );
}
