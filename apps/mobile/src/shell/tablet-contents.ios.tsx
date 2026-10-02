import { Host, Label, List, Section, Text } from '@expo/ui/swift-ui';
import { listStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';

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
    <SafeAreaView edges={{ top: true }} style={{ flex: 1 }}>
      <Host style={{ flex: 1 }}>
        {pathname === '/settings' ? (
          <List
            selection={['environments']}
            onSelectionChange={() => router.replace('/settings')}
            modifiers={[listStyle('sidebar')]}
          >
            <Section title="Settings">
              <Label title="Environments" modifiers={[tag('environments')]} />
            </Section>
          </List>
        ) : (
          <List modifiers={[listStyle('plain')]}>
            <Section title={title}>
              <Text>No worktree selected.</Text>
            </Section>
          </List>
        )}
      </Host>
    </SafeAreaView>
  );
}
