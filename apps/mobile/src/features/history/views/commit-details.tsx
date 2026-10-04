import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import {
  commitFilePaths,
  commitFileLabel,
  type CommitFile,
} from '@porcelain/client/history/rules';
import { Button } from '../../../shared/ui/button';
import { FileDiff } from '../../../shared/diff/file-diff';
import { parseFilePatch } from '../../../shared/diff/parse-patch';
import { diffRows } from '../../../shared/rules/patch';
import { useCommit } from '../queries/commit';
import type { useHistory } from '../queries/history';
import { useCommitDiff } from '../queries/commit-diffs';
import { CommitMetadata } from './commit-metadata';
import { CommitFileRow } from './commit-file-row';

type HistoryWorkspace = Parameters<typeof useHistory>[0];

export function CommitDetails({
  workspace,
  oid,
  onBack,
}: {
  workspace: HistoryWorkspace;
  oid: string;
  onBack: () => void;
}) {
  const [parent, setParent] = useState(1);
  return (
    <CommitComparison
      key={parent}
      workspace={workspace}
      oid={oid}
      parent={parent}
      onParent={setParent}
      onBack={onBack}
    />
  );
}

function CommitComparison({
  workspace,
  oid,
  parent,
  onParent,
  onBack,
}: {
  workspace: HistoryWorkspace;
  oid: string;
  parent: number;
  onParent: (parent: number) => void;
  onBack: () => void;
}) {
  const commit = useCommit(workspace, oid, parent);
  const [selectedFile, setSelectedFile] = useState<CommitFile>();
  const surface = useResolveClassNames('min-h-0 flex-1 bg-background');
  const toolbar = useResolveClassNames(
    'shrink-0 flex-row flex-wrap items-center gap-3 border-b border-border px-4 py-2',
  );
  const heading = useResolveClassNames('min-w-0 flex-1 gap-0.5');
  const title = useResolveClassNames(
    'font-mono text-sm font-semibold text-foreground',
  );
  const caption = useResolveClassNames('text-xs text-muted-foreground');
  const header = useResolveClassNames('gap-3 pb-2');
  const message = useResolveClassNames(
    'px-4 py-4 text-sm text-muted-foreground',
  );
  const error = useResolveClassNames('px-4 py-4 text-sm text-destructive');
  const section = useResolveClassNames(
    'px-4 pt-4 text-xs font-semibold text-muted-foreground',
  );
  if (selectedFile)
    return (
      <CommitFileDiff
        workspace={workspace}
        oid={oid}
        parent={parent}
        file={selectedFile}
        onBack={() => setSelectedFile(undefined)}
      />
    );
  const data = commit.data;
  return (
    <View style={surface}>
      <View style={toolbar}>
        <Button
          label="Back to history"
          variant="ghost"
          size="sm"
          onPress={onBack}
        />
        <View style={heading}>
          <Text style={title}>{oid.slice(0, 7)}</Text>
          {data ? (
            <Text style={caption}>
              {data.files.length} file{data.files.length === 1 ? '' : 's'}{' '}
              changed
            </Text>
          ) : null}
        </View>
      </View>
      <FlatList
        style={surface}
        contentInsetAdjustmentBehavior="automatic"
        data={data?.files ?? []}
        keyExtractor={(file) => JSON.stringify(commitFilePaths(file))}
        ListHeaderComponent={
          <View style={header}>
            {commit.isPending ? (
              <Text accessibilityLiveRegion="polite" style={message}>
                Reading commit…
              </Text>
            ) : null}
            {commit.error ? (
              <>
                <Text accessibilityRole="alert" style={error}>
                  Could not read commit. {commit.error.message}
                </Text>
                <Button
                  label="Read commit again"
                  variant="outline"
                  onPress={commit.read}
                />
              </>
            ) : null}
            {data ? (
              <>
                <CommitMetadata
                  data={data}
                  parent={parent}
                  onParent={onParent}
                />
                <Text accessibilityRole="header" style={section}>
                  Changed files
                </Text>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CommitFileRow file={item} onOpen={() => setSelectedFile(item)} />
        )}
      />
    </View>
  );
}

function CommitFileDiff({
  workspace,
  oid,
  parent,
  file,
  onBack,
}: {
  workspace: HistoryWorkspace;
  oid: string;
  parent: number;
  file: CommitFile;
  onBack: () => void;
}) {
  const diff = useCommitDiff(workspace, oid, parent, file);
  const surface = useResolveClassNames('min-h-0 flex-1 bg-background');
  const toolbar = useResolveClassNames(
    'shrink-0 flex-row flex-wrap items-center gap-3 border-b border-border px-4 py-2',
  );
  const heading = useResolveClassNames('min-w-0 flex-1 gap-0.5');
  const title = useResolveClassNames(
    'font-mono text-sm font-semibold text-foreground',
  );
  const caption = useResolveClassNames('text-xs text-muted-foreground');
  const message = useResolveClassNames(
    'px-4 py-4 text-sm text-muted-foreground',
  );
  const error = useResolveClassNames('px-4 py-4 text-sm text-destructive');
  const path = commitFileLabel(file);
  const files =
    diff.content && 'patch' in diff.content
      ? parseFilePatch(diff.content.patch)
      : undefined;
  const rows = diff.content ? diffRows(diff.content, files, path) : [];
  return (
    <View style={surface}>
      <View style={toolbar}>
        <Button
          label="Back to commit"
          variant="ghost"
          size="sm"
          onPress={onBack}
        />
        <View style={heading}>
          <Text style={title}>{oid.slice(0, 7)}</Text>
          <Text style={caption}>{file.status}</Text>
        </View>
      </View>
      {diff.isPending ? (
        <Text accessibilityLiveRegion="polite" style={message}>
          Reading diff…
        </Text>
      ) : null}
      {diff.error ? (
        <>
          <Text accessibilityRole="alert" style={error}>
            Could not read diff. {diff.error.message}
          </Text>
          <Button
            label="Read diff again"
            variant="outline"
            onPress={diff.read}
          />
        </>
      ) : null}
      {diff.content ? <FileDiff rows={rows} path={path} /> : null}
    </View>
  );
}
