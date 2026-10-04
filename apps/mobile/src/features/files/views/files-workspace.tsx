import type { useDirectory } from '../queries/reads';
import { Button, Host, TextInput, useNativeState } from '@expo/ui';
import { useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { FileTree } from './file-tree';
import { FileSearch } from './file-search';
import { FileView } from './file-view';
import { useReloadFiles } from '../commands/reload';

export function FilesWorkspace({
  context,
}: {
  context: Parameters<typeof useDirectory>[0];
}) {
  const [path, setPath] = useState<string>();
  const [search, setSearch] = useState('');
  const searchValue = useNativeState('');
  const reload = useReloadFiles(context);
  const inputStyle = useResolveClassNames(
    'rounded-lg border border-border bg-card px-3 py-2',
  );
  const textStyle = useResolveClassNames('text-sm text-foreground');
  const open = (file: string) => {
    Keyboard.dismiss();
    setPath(file);
  };
  return (
    <View className="flex-1 bg-background">
      <View className={path === undefined ? 'flex-1' : 'hidden'}>
        <View className="gap-3 px-4 py-3">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-foreground"
          >
            Files
          </Text>
          <Host matchContents={{ vertical: true }}>
            <TextInput
              testID="files-search"
              placeholder="Find a file"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearch}
              value={searchValue}
              style={inputStyle}
              textStyle={{
                ...(textStyle.fontSize === undefined
                  ? {}
                  : { fontSize: textStyle.fontSize }),
                ...(typeof textStyle.color === 'string'
                  ? { color: textStyle.color }
                  : {}),
              }}
            />
          </Host>
          {search ? (
            <Host matchContents={{ vertical: true }}>
              <Button
                label="Clear search"
                variant="text"
                onPress={() => {
                  searchValue.value = '';
                  setSearch('');
                }}
              />
            </Host>
          ) : null}
        </View>
        <Host matchContents={{ vertical: true }}>
          <Button
            label="Reload files"
            variant="text"
            disabled={reload.isPending}
            onPress={() => reload.read()}
          />
        </Host>
        {search.trim() ? (
          <FileSearch context={context} search={search} onOpen={open} />
        ) : (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            <FileTree context={context} path="" onOpen={open} />
          </ScrollView>
        )}
      </View>
      {path !== undefined ? (
        <FileView
          key={path}
          context={context}
          path={path}
          onBack={() => setPath(undefined)}
        />
      ) : null}
    </View>
  );
}
