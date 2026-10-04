import type { ReadChangeDiffsResponse } from '@porcelain/contracts/changes';
import { FlatList, Text, View } from 'react-native';

export function FileDiff({
  content,
}: {
  content: ReadChangeDiffsResponse['diffs'][number]['content'];
}) {
  if (content.kind === 'binary')
    return (
      <Text className="p-6 text-sm text-muted-foreground">
        Binary file. No text diff.
      </Text>
    );
  if (content.kind === 'omitted')
    return (
      <Text className="p-6 text-sm text-muted-foreground">
        {content.reason === 'size-limit'
          ? 'Diff omitted: file exceeds the size limit.'
          : content.reason === 'unsupported-encoding'
            ? 'Diff omitted: unsupported text encoding.'
            : 'Diff omitted: submodule content is unavailable.'}
      </Text>
    );
  return (
    <FlatList
      className="flex-1 bg-background"
      data={
        content.patch === '' ? [] : content.patch.replace(/\n$/, '').split('\n')
      }
      keyExtractor={(_line, index) => String(index)}
      ListEmptyComponent={
        <Text className="p-6 text-sm text-muted-foreground">
          No text changes.
        </Text>
      }
      renderItem={({ item }) => (
        <View
          className={
            item.startsWith('+') && !item.startsWith('+++ ')
              ? 'flex-row bg-graph-2/10 px-2 py-0.5'
              : item.startsWith('-') && !item.startsWith('--- ')
                ? 'flex-row bg-destructive/10 px-2 py-0.5'
                : 'flex-row px-2 py-0.5'
          }
        >
          <Text
            selectable
            className="flex-1 font-mono text-xs leading-5 text-foreground"
          >
            {item}
          </Text>
        </View>
      )}
    />
  );
}
