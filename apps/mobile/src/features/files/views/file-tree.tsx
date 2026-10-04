import { Button, Host } from '@expo/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { childFilePath } from '@porcelain/client/files/rules';
import { useDirectory } from '../queries/reads';
import { ReadState } from './read-state';

function Folder({
  context,
  path,
  name,
  onOpen,
}: {
  context: Parameters<typeof useDirectory>[0];
  path: string;
  name: string;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Host matchContents={{ vertical: true }}>
        <Button
          label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
          variant="text"
          onPress={() => setExpanded(!expanded)}
        />
      </Host>
      {expanded ? (
        <View className="ml-4 border-l border-border">
          <FileTree context={context} path={path} onOpen={onOpen} />
        </View>
      ) : null}
    </View>
  );
}

export function FileTree({
  context,
  path,
  onOpen,
}: {
  context: Parameters<typeof useDirectory>[0];
  path: string;
  onOpen: (path: string) => void;
}) {
  const query = useDirectory(context, path);
  if (query.isPending || query.isError)
    return (
      <ReadState
        pending={query.isPending}
        error={query.error}
        onRead={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <View>
      {query.data.entries.length === 0 ? (
        <Text className="px-4 py-3 text-sm text-muted-foreground">
          This folder is empty.
        </Text>
      ) : null}
      {query.data.entries.map((entry) => {
        const child = childFilePath(path, entry.name);
        return entry.kind === 'directory' ? (
          <Folder
            key={child}
            context={context}
            path={child}
            name={entry.name}
            onOpen={onOpen}
          />
        ) : (
          <Host key={child} matchContents={{ vertical: true }}>
            <Button
              label={entry.name}
              variant="text"
              disabled={entry.kind !== 'file'}
              onPress={() => onOpen(child)}
            />
          </Host>
        );
      })}
    </View>
  );
}
