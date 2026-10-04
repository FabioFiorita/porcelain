import type { useDirectory } from '../queries/reads';
import { Button, Host } from '@expo/ui';
import { FlatList, Text } from 'react-native';
import { matchingFilePaths } from '@porcelain/client/files/rules';
import { useFilePaths } from '../queries/reads';
import { ReadState } from './read-state';

export function FileSearch({
  context,
  search,
  onOpen,
}: {
  context: Parameters<typeof useDirectory>[0];
  search: string;
  onOpen: (path: string) => void;
}) {
  const query = useFilePaths(context);
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
    <FlatList
      className="flex-1"
      data={matchingFilePaths(query.data.paths, search)}
      keyExtractor={(path) => path}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text className="px-4 py-3 text-sm text-muted-foreground">
          No matching files.
        </Text>
      }
      renderItem={({ item }) => (
        <Host matchContents={{ vertical: true }}>
          <Button label={item} variant="text" onPress={() => onOpen(item)} />
        </Host>
      )}
    />
  );
}
