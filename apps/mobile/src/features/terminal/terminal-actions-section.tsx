import { Button, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { disabled } from '@expo/ui/swift-ui/modifiers'

import type { TerminalAction } from '@/lib/daemon/procedures/terminal'
import { monospace, secondary } from '@/theme/modifiers'

export function TerminalActionsSection({
  actions,
  onRun,
  runningId,
}: {
  actions: readonly TerminalAction[]
  onRun: (action: TerminalAction) => void
  runningId: string | null
}): React.JSX.Element {
  return (
    <Section title="Actions">
      {actions.length === 0 ? (
        <Text modifiers={[secondary]}>No saved Actions for this repo.</Text>
      ) : (
        actions.map((action) => {
          const local = action.where === 'local'
          const disabledAction = local || runningId !== null
          return (
            <Button
              key={action.id}
              modifiers={[disabled(disabledAction)]}
              onPress={(): void => onRun(action)}
            >
              <HStack spacing={10}>
                <Image modifiers={[secondary]} size={17} systemName="play.circle" />
                <VStack alignment="leading" spacing={2}>
                  <Text>{action.title}</Text>
                  <Text modifiers={[monospace, secondary]}>
                    {local ? 'Runs on the desktop app’s machine' : action.command}
                  </Text>
                </VStack>
                <Spacer />
              </HStack>
            </Button>
          )
        })
      )}
    </Section>
  )
}
