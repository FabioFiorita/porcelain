import type { useDirectory } from '../queries/reads';
import { Host, TextInput, useNativeState } from '@expo/ui';
import { useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { Button } from '../../../shared/ui/button';
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
  const surface = useResolveClassNames('flex-1 bg-background');
  const browser = useResolveClassNames(
    path === undefined ? 'flex-1' : 'hidden',
  );
  const toolbar = useResolveClassNames(
    'gap-3 border-b border-border px-4 py-3',
  );
  const heading = useResolveClassNames(
    'flex-row items-center justify-between gap-3',
  );
  const title = useResolveClassNames('text-base font-semibold text-foreground');
  const scroll = useResolveClassNames('flex-1');
  const tree = useResolveClassNames('px-3 py-2');
  const inputStyle = useResolveClassNames(
    'min-h-11 rounded-lg border border-input bg-card px-3 py-3',
  );
  const textStyle = useResolveClassNames('text-sm text-foreground');
  const open = (file: string) => {
    Keyboard.dismiss();
    setPath(file);
  };
  return (
    <View style={surface}>
      <View style={browser}>
        <View style={toolbar}>
          <View style={heading}>
            <Text accessibilityRole="header" style={title}>
              Files
            </Text>
            <Button
              label={reload.isPending ? 'Reloading files…' : 'Reload files'}
              size="sm"
              disabled={reload.isPending}
              onPress={() => reload.read()}
            />
          </View>
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
            <Button
              label="Clear search"
              variant="ghost"
              size="sm"
              onPress={() => {
                searchValue.value = '';
                setSearch('');
              }}
            />
          ) : null}
        </View>
        {search.trim() ? (
          <FileSearch context={context} search={search} onOpen={open} />
        ) : (
          <ScrollView
            style={scroll}
            contentContainerStyle={tree}
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
