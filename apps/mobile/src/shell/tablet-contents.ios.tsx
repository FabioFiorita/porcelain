import { Text } from '../components/ui/text';
import { Label, List, RNHostView, Section, VStack } from '@expo/ui/swift-ui';
import { listStyle, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';
import { View } from 'react-native';

export function TabletContents() {
  const pathname = usePathname();
  const router = useRouter();
  const title =
    pathname === '/files'
      ? 'Files'
      : pathname === '/history'
        ? 'History'
        : 'Changes';

  return (
    <>
      {pathname === '/settings' || pathname.startsWith('/component-') ? (
        <List
          selection={['environments']}
          onSelectionChange={() => router.replace('/settings')}
          modifiers={[listStyle('sidebar'), navigationTitle('Settings')]}
        >
          <Section>
            <Label title="Environments" modifiers={[tag('environments')]} />
          </Section>
        </List>
      ) : (
        <VStack modifiers={[navigationTitle(title)]}>
          <RNHostView>
            <View className="flex-1 bg-background px-6 py-8">
              <Text variant="ui" tone="muted">
                No worktree selected.
              </Text>
            </View>
          </RNHostView>
        </VStack>
      )}
    </>
  );
}
