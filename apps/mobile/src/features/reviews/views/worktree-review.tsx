import { BottomSheet } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { useReview } from '../queries/review';
import { CommentsSheet } from './comments-sheet';
import { PublishedReview } from './published-review';
import { SelectedDiff } from './selected-diff';

export function WorktreeReview({
  scope,
  connection,
}: {
  scope: Parameters<typeof useReview>[0];
  connection: Parameters<typeof useReview>[1];
}) {
  const [range, setRange] = useState<'worktree' | 'branch'>('worktree');
  const [path, setPath] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  const review = useReview(scope, connection, range);
  const file = review.files.find((candidate) => candidate.path === path);
  const surface = useResolveClassNames('min-h-0 flex-1 bg-background');
  const toolbar = useResolveClassNames(
    'gap-2 border-b border-border px-4 py-2',
  );
  const actions = useResolveClassNames('flex-row flex-wrap items-center gap-2');
  const title = useResolveClassNames(
    'flex-1 text-lg font-semibold text-foreground',
  );
  const heading = useResolveClassNames('text-sm font-medium text-foreground');
  const text = useResolveClassNames('text-sm leading-6 text-muted-foreground');
  const alert = useResolveClassNames('px-4 py-3 text-sm text-destructive');
  const notice = useResolveClassNames(
    'px-4 py-3 text-sm text-muted-foreground',
  );
  const contents = useResolveClassNames('gap-4 px-4 py-4');
  const section = useResolveClassNames('gap-2');
  const rows = useResolveClassNames(
    'overflow-hidden rounded-lg border border-border bg-card',
  );
  const row = useResolveClassNames('min-w-0 flex-1 gap-1');
  const metadata = useResolveClassNames(
    'text-xs leading-5 text-muted-foreground',
  );
  return (
    <View style={surface}>
      <View style={toolbar}>
        <View style={actions}>
          <Text accessibilityRole="header" style={title}>
            Review
          </Text>
          <Button
            label="Comments"
            variant="outline"
            size="sm"
            onPress={() => setComments(true)}
          />
          <Button
            label="Refresh review"
            variant="ghost"
            size="sm"
            onPress={review.read}
          />
        </View>
        <Button
          label={
            range === 'worktree'
              ? 'Show branch changes'
              : 'Show uncommitted changes'
          }
          variant="secondary"
          size="sm"
          onPress={() => {
            setPath(null);
            setRange(range === 'worktree' ? 'branch' : 'worktree');
          }}
        />
      </View>
      {review.error ? (
        <Text accessibilityRole="alert" style={alert}>
          Could not read review. Refresh review to try again.
        </Text>
      ) : null}
      {review.marksUnavailable ? (
        <Text style={notice}>
          Reviewed marks are unavailable because this branch has no base.
        </Text>
      ) : null}
      {review.isPending ? (
        <Text style={notice}>Reading changes…</Text>
      ) : file ? (
        <>
          <View style={toolbar}>
            <Button
              label="Back to changed files"
              variant="ghost"
              size="sm"
              onPress={() => setPath(null)}
            />
            <Text selectable style={heading}>
              {file.path}
            </Text>
            <View style={actions}>
              <Badge label={file.note} variant="outline" />
              {file.reviewed ? (
                <Badge label={file.reviewed} variant="secondary" />
              ) : null}
            </View>
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
          style={surface}
          contentContainerStyle={contents}
          contentInsetAdjustmentBehavior="automatic"
        >
          {range === 'worktree' && review.published ? (
            <PublishedReview review={review.published} />
          ) : null}
          <View style={section}>
            <View style={actions}>
              <Text accessibilityRole="header" style={heading}>
                {range === 'worktree'
                  ? 'Uncommitted changes'
                  : 'Branch changes'}
              </Text>
              <Badge label={`${review.files.length} files`} variant="outline" />
            </View>
            {range === 'branch' ? (
              <Text style={text}>
                {review.branch?.base
                  ? `${review.branch.head.branch ?? 'Detached HEAD'} · ${review.branch.commits} commits since ${review.branch.base.ref}`
                  : 'No default branch to compare.'}
              </Text>
            ) : null}
            {!review.error && review.files.length === 0 ? (
              <Text style={text}>No changed files.</Text>
            ) : null}
            {review.files.length ? (
              <View style={rows}>
                {review.files.map((item) => (
                  <Button
                    key={item.path}
                    label={item.path}
                    accessibilityLabel={`${item.path} · ${item.note}${item.reviewed ? ` · ${item.reviewed}` : ''}`}
                    variant="ghost"
                    size="row"
                    onPress={() => setPath(item.path)}
                  >
                    <View style={row}>
                      <Text numberOfLines={2} style={heading}>
                        {item.path}
                      </Text>
                      <Text style={metadata}>
                        {item.note}
                        {item.reviewed ? ` · ${item.reviewed}` : null}
                      </Text>
                    </View>
                  </Button>
                ))}
              </View>
            ) : null}
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
