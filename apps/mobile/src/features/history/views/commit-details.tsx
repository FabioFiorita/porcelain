import { Button, Host } from '@expo/ui';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import {
  commitFileLabel,
  commitFilePaths,
  type CommitFile,
} from '@porcelain/client/history';
import { FileDiff } from '../../../shared/diff/file-diff';
import { useCommit } from '../queries/commit';
import type { useHistory } from '../queries/history';
import { useCommitDiff } from '../queries/commit-diffs';

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
    <FlatList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      data={data?.files ?? []}
      keyExtractor={(file) => JSON.stringify(commitFilePaths(file))}
      ListHeaderComponent={
        <View className="gap-4 px-6 py-6">
          <Host matchContents={{ vertical: true }}>
            <Button label="Back to history" variant="text" onPress={onBack} />
          </Host>
          {commit.isPending ? (
            <Text className="text-sm text-muted-foreground">
              Reading commit…
            </Text>
          ) : null}
          {commit.error ? (
            <>
              <Text className="text-sm text-destructive">
                Could not read commit. {commit.error.message}
              </Text>
              <Host matchContents={{ vertical: true }}>
                <Button
                  label="Read commit again"
                  variant="text"
                  onPress={commit.read}
                />
              </Host>
            </>
          ) : null}
          {data ? (
            <>
              <Text
                accessibilityRole="header"
                className="text-xl font-semibold text-foreground"
              >
                {data.commit.subject}
              </Text>
              {data.commit.body ? (
                <Text className="text-sm leading-6 text-foreground">
                  {data.commit.body}
                </Text>
              ) : null}
              {data.commit.subjectTruncated || data.commit.bodyTruncated ? (
                <Text className="text-sm text-muted-foreground">
                  Commit message truncated
                </Text>
              ) : null}
              <Text className="text-sm text-muted-foreground">
                {data.commit.author.name} · {data.commit.author.timestamp}
              </Text>
              <Text
                selectable
                className="font-mono text-xs text-muted-foreground"
              >
                {oid}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {data.comparison.kind === 'empty-tree'
                  ? 'Root commit'
                  : `Against parent ${data.comparison.parentNumber} · ${data.comparison.baseOid.slice(0, 7)}`}
              </Text>
              {data.commit.parentOids.length > 1 ? (
                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="text-sm font-medium text-foreground"
                  >
                    Compare with parent
                  </Text>
                  {data.commit.parentOids.map((parentOid, index) => (
                    <Host key={parentOid} matchContents={{ vertical: true }}>
                      <Button
                        label={`Parent ${index + 1} · ${parentOid.slice(0, 7)}${parent === index + 1 ? ' (selected)' : ''}`}
                        variant="text"
                        onPress={() => onParent(index + 1)}
                      />
                    </Host>
                  ))}
                </View>
              ) : null}
              <Text
                accessibilityRole="header"
                className="text-base font-semibold text-foreground"
              >
                Changed files
              </Text>
              {data.files.length === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  No files changed in this commit.
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      }
      renderItem={({ item: file }) => (
        <View className="mx-6 gap-1 border-b border-border py-3">
          <Host matchContents={{ vertical: true }}>
            <Button
              label={commitFileLabel(file)}
              variant="text"
              onPress={() => setSelectedFile(file)}
            />
          </Host>
          <Text className="text-xs text-muted-foreground">{file.status}</Text>
        </View>
      )}
    />
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
  return (
    <View className="flex-1 bg-background">
      <View className="gap-4 px-6 py-6">
        <Host matchContents={{ vertical: true }}>
          <Button label="Back to commit" variant="text" onPress={onBack} />
        </Host>
        <Text
          accessibilityRole="header"
          className="text-base font-semibold text-foreground"
        >
          {commitFileLabel(file)}
        </Text>
        {diff.isPending ? (
          <Text className="text-sm text-muted-foreground">Reading diff…</Text>
        ) : null}
        {diff.error ? (
          <>
            <Text className="text-sm text-destructive">
              Could not read diff. {diff.error.message}
            </Text>
            <Host matchContents={{ vertical: true }}>
              <Button
                label="Read diff again"
                variant="text"
                onPress={diff.read}
              />
            </Host>
          </>
        ) : null}
      </View>
      {diff.content ? <FileDiff content={diff.content} /> : null}
    </View>
  );
}
