import { Box } from '../components/ui/box';
import { destinationForPath } from './destinations';
import { useWorkspace } from '../features/projects';
import { Text } from '../components/ui/text';
import { Label, List, RNHostView, Section, VStack } from '@expo/ui/swift-ui';
import { listStyle, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';

export function TabletContents() {
  const { state } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const destination = destinationForPath(pathname);

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
              {state.kind === 'selected' ? (
                <Text variant="ui" tone="muted">
                  {state.workspace.worktree.branch ??
                    state.workspace.worktree.path}
                </Text>
              ) : null}
            </Box>
          </RNHostView>
        </VStack>
      )}
    </>
  );
}
