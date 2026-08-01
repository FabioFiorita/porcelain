import {
  Button,
  ContentUnavailableView,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui'
import { buttonStyle, font, foregroundStyle, listStyle } from '@expo/ui/swift-ui/modifiers'

import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { selectEnvironment, useEnvironments, useSelectedEnvironment } from '@/lib/environments'
import { useAccentColor } from '@/theme/colors'

const secondary = foregroundStyle({ style: 'secondary', type: 'hierarchical' })

/**
 * What the header's context line points at: which daemon, which repo, which worktree.
 *
 * The environment picker is real, because environments are the one thing this build has.
 * Project and worktree need a paired daemon before they have anything to list, so they sit
 * here as their eventual home. Keeping all three in one sheet is the point — a worktree
 * switcher hidden in one tab's header is how two tabs disagree about what you are looking at.
 */
export function WorkspaceScreen(): React.JSX.Element {
  const accentColor = useAccentColor()
  const environments = useEnvironments()
  const selected = useSelectedEnvironment()

  return (
    <>
      <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
        <List modifiers={[listStyle('insetGrouped')]}>
          {environments.length === 0 ? (
            <ContentUnavailableView
              description="Pair a daemon in Settings and its repos and worktrees become selectable here."
              systemImage="point.3.connected.trianglepath.dotted"
              title="Nothing to switch to"
            />
          ) : (
            <Section title="Environment">
              {environments.map((environment) => (
                <Button
                  key={environment.id}
                  modifiers={[buttonStyle('plain')]}
                  onPress={(): void => selectEnvironment(environment.id)}
                >
                  <HStack>
                    <Text>{environment.nickname}</Text>
                    <Spacer />
                    {environment.id === selected?.id ? (
                      <Image color={accentColor} size={13} systemName="checkmark" />
                    ) : null}
                  </HStack>
                </Button>
              ))}
            </Section>
          )}
          <Section title="Repository">
            <ContextRow label="Project" value="Needs an environment" />
            <ContextRow label="Worktree" value="Needs an environment" />
          </Section>
        </List>
      </Host>
      <SheetCloseToolbar />
    </>
  )
}

function ContextRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <HStack>
      <Text>{label}</Text>
      <Spacer />
      <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{value}</Text>
    </HStack>
  )
}
