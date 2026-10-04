import type { useDirectory } from '../queries/reads';
import { FlatList, Text } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { matchingFilePaths } from '@porcelain/client/files/rules';
import { Button } from '../../../shared/ui/button';
import { useFilePaths } from '../queries/reads';
import { ReadState } from './read-state';
import { FileRow } from './file-row';

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
  const list = useResolveClassNames('flex-1');
  const empty = useResolveClassNames(
    'px-4 py-4 text-sm leading-6 text-muted-foreground',
  );
  if (query.isPending || query.isError) return <ReadState query={query} />;
  return (
    <FlatList
      style={list}
      data={matchingFilePaths(query.data.paths, search)}
      keyExtractor={(path) => path}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={empty}>No matching files.</Text>}
      renderItem={({ item }) => (
        <Button
          label={item}
          variant="ghost"
          size="row"
          onPress={() => onOpen(item)}
        >
          <FileRow name={item.split('/').at(-1) ?? item} detail={item} />
        </Button>
      )}
    />
  );
}
