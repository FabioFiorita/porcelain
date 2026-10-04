import { useState } from 'react';
import { Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { FileDiff } from '../../../shared/diff/file-diff';
import { parseFilePatch } from '../../../shared/diff/parse-patch';
import { diffRows } from '../../../shared/rules/patch';
import { Button } from '../../../shared/ui/button';
import { useRecoverChangedDiffs } from '../commands/recover-changed-diffs';
import { useFileDiffs } from '../queries/review';
import type { useReview } from '../queries/review';

export function SelectedDiff({
  scope,
  connection,
  review,
  range,
  path,
}: {
  scope: Parameters<typeof useReview>[0];
  connection: Parameters<typeof useReview>[1];
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
  const surface = useResolveClassNames('min-h-0 flex-1');
  const status = useResolveClassNames('gap-3 p-4');
  const alert = useResolveClassNames('text-sm text-destructive');
  const text = useResolveClassNames('text-sm text-muted-foreground');
  const toolbar = useResolveClassNames('px-4 py-2');
  const metadata = useResolveClassNames('text-xs text-muted-foreground');
  if (diffs.error)
    return (
      <View style={status}>
        <Text accessibilityRole="alert" style={alert}>
          Could not read diff. Refresh review to read the latest changes.
        </Text>
        <Button
          label="Read diff again"
          variant="outline"
          onPress={diffs.read}
        />
      </View>
    );
  if (diffs.isPending)
    return (
      <View style={status}>
        <Text style={text}>Reading diff…</Text>
      </View>
    );
  if (!selected)
    return (
      <View style={status}>
        <Text style={text}>
          {diffs.unavailable ?? 'Diff unavailable for this comparison.'}
        </Text>
      </View>
    );
  const files =
    'patch' in selected.content
      ? parseFilePatch(selected.content.patch)
      : undefined;
  const rows = diffRows(selected.content, files, path);
  return (
    <View style={surface}>
      <View style={toolbar}>
        {diffs.diffs.length > 1 ? (
          <Button
            label={`Showing ${selected.label} · Switch comparison`}
            variant="ghost"
            size="sm"
            onPress={() => setComparison((comparison + 1) % diffs.diffs.length)}
          />
        ) : (
          <Text style={metadata}>{selected.label}</Text>
        )}
      </View>
      <FileDiff rows={rows} path={path} />
    </View>
  );
}
