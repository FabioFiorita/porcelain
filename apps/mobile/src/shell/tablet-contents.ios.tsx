import { Label, List, Section, Text } from '@expo/ui/swift-ui';
import { listStyle, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';

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
      {pathname === '/settings' ? (
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
        <List modifiers={[listStyle('plain'), navigationTitle(title)]}>
          <Section>
            <Text>No worktree selected.</Text>
          </Section>
        </List>
      )}
    </>
  );
}
