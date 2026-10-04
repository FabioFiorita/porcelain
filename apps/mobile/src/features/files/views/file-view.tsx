import type { FilesContext } from '@porcelain/client/files';
import { Button, Host } from '@expo/ui';
import { Text, View } from 'react-native';
import { useFileText } from '../queries/reads';
import { ReadState } from './read-state';
import { CodeView } from './code-view';

export function FileView({
  context,
  path,
  onBack,
}: {
  context: FilesContext;
  path: string;
  onBack: () => void;
}) {
  const query = useFileText(context, path);
  return (
    <View className="flex-1 bg-background">
      <View className="gap-2 border-b border-border px-4 py-3">
        <View className="flex-row justify-between gap-3">
          <Host matchContents>
            <Button label="Back to files" variant="text" onPress={onBack} />
          </Host>
          <Host matchContents>
            <Button
              label="Reload file"
              variant="text"
              disabled={query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            />
          </Host>
        </View>
        <Text
          accessibilityRole="header"
          className="text-sm font-medium text-foreground"
        >
          {path}
        </Text>
        <Text className="text-xs text-muted-foreground">Read only</Text>
      </View>
      {query.isFetching || query.isPending || query.isError ? (
        <ReadState
          pending={query.isFetching || query.isPending}
          error={query.error}
          onRead={() => {
            void query.refetch();
          }}
        />
      ) : 'kind' in query.data ? (
        <Text className="p-4 text-sm text-muted-foreground">
          {query.data.reason}
        </Text>
      ) : query.data.text === '' ? (
        <Text className="p-4 text-sm text-muted-foreground">
          This file is empty.
        </Text>
      ) : (
        <CodeView text={query.data.text} />
      )}
    </View>
  );
}
