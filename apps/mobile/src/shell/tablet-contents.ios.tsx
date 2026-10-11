import { Box } from '../components/ui/box';
import { destinationForPath } from './destinations';
import { useSelectedWorktree } from '../features/projects';
import { Text } from '../components/ui/text';
import { Label, List, RNHostView, Section, VStack } from '@expo/ui/swift-ui';
import { listStyle, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';

export function TabletContents() {
  const pathname = usePathname();
  const router = useRouter();
  const destination = destinationForPath(pathname);
  const selected = useSelectedWorktree();

  return (
    <>
      {destination.path === '/settings' ? (
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
        <VStack modifiers={[navigationTitle(destination.title)]}>
          <RNHostView>
            <Box
              className="flex-1"
              surface="background"
              paddingX={6}
              paddingY={8}
            >
              <Text variant="ui" tone="muted">
                {selected
                  ? (selected.worktree.branch ?? selected.worktree.path)
                  : 'No worktree selected.'}
              </Text>
            </Box>
          </RNHostView>
        </VStack>
      )}
    </>
  );
}
