import { Button, ConfirmationDialog, HStack, Image, Section, Text, VStack } from '@expo/ui/swift-ui'
import { disabled, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'
import { useState } from 'react'

import type { ChangesMutations } from '@/features/changes/data/mutations'
import type { GitSuggestion } from '@/lib/daemon/procedures/changes'
import { QUICK_COMMANDS, type QuickCommandId } from '@/lib/daemon/procedures/changes'
import { monospace, secondary } from '@/theme/modifiers'

const COMMAND_ICONS: Record<
  QuickCommandId,
  | 'info.circle'
  | 'arrow.down.circle'
  | 'arrow.up.circle'
  | 'arrow.clockwise'
  | 'archivebox'
  | 'archivebox.fill'
> = {
  status: 'info.circle',
  pull: 'arrow.down.circle',
  push: 'arrow.up.circle',
  fetch: 'arrow.clockwise',
  stash: 'archivebox',
  'stash-pop': 'archivebox.fill',
}

const errorStyle = foregroundStyle({ color: '#FF3B30', type: 'color' })

type CommandResult = {
  failed: boolean
  output: string
}

/** The full Changes-side command set from the desktop companion, adapted to a list sheet. */
export function QuickCommandsSection({
  mutations,
  suggestions,
}: {
  mutations: ChangesMutations
  suggestions: readonly GitSuggestion[]
}): React.JSX.Element {
  const [running, setRunning] = useState<QuickCommandId | null>(null)
  const [result, setResult] = useState<CommandResult | null>(null)
  const [pushPresented, setPushPresented] = useState(false)

  function isQuickCommandId(command: string): command is QuickCommandId {
    return QUICK_COMMANDS.some((candidate) => candidate === command)
  }

  const knownSuggestions = suggestions.filter(
    (suggestion): suggestion is GitSuggestion & { command: QuickCommandId } =>
      isQuickCommandId(suggestion.command),
  )

  async function run(command: QuickCommandId): Promise<void> {
    if (running !== null) return
    setRunning(command)
    try {
      const output = await mutations.quickCommand.run(command)
      setResult({ failed: false, output: output === '' ? '(no output)' : output })
    } catch (cause) {
      setResult({
        failed: true,
        output: cause instanceof Error ? cause.message : 'The command could not be completed.',
      })
    } finally {
      setRunning(null)
    }
  }

  function requestRun(command: QuickCommandId): void {
    if (command === 'push') setPushPresented(true)
    else run(command)
  }

  return (
    <>
      {knownSuggestions.length === 0 ? null : (
        <Section title="Suggested">
          {knownSuggestions.map((suggestion) => (
            <CommandButton
              detail={suggestion.reason}
              disabled={running !== null}
              id={suggestion.command}
              key={suggestion.command}
              label={`git ${suggestion.command === 'stash-pop' ? 'stash pop' : suggestion.command}`}
              onPress={(): void => requestRun(suggestion.command)}
              suggested
            />
          ))}
        </Section>
      )}
      <Section title="Commands">
        {QUICK_COMMANDS.map((command) => (
          <CommandButton
            disabled={running !== null}
            id={command}
            key={command}
            label={`git ${command === 'stash-pop' ? 'stash pop' : command}`}
            onPress={(): void => requestRun(command)}
          />
        ))}
        {result === null ? null : (
          <HStack spacing={8}>
            <Image
              color={result.failed ? '#FF3B30' : '#34C759'}
              size={15}
              systemName={result.failed ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
            />
            <Text modifiers={[monospace, result.failed ? errorStyle : secondary]}>
              {result.output}
            </Text>
          </HStack>
        )}
      </Section>
      <ConfirmationDialog
        isPresented={pushPresented}
        onIsPresentedChange={setPushPresented}
        title="Push changes?"
      >
        <ConfirmationDialog.Message>
          <Text>Send the current branch to its upstream.</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button
            label="Push"
            onPress={(): void => {
              setPushPresented(false)
              run('push')
            }}
          />
          <Button label="Cancel" onPress={(): void => setPushPresented(false)} role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </>
  )
}

function CommandButton({
  detail,
  disabled: isDisabled,
  id,
  label,
  onPress,
  suggested = false,
}: {
  detail?: string
  disabled: boolean
  id: QuickCommandId
  label: string
  onPress: () => void
  suggested?: boolean
}): React.JSX.Element {
  return (
    <Button modifiers={[disabled(isDisabled)]} onPress={onPress}>
      <HStack spacing={10}>
        <Image modifiers={[secondary]} size={17} systemName={COMMAND_ICONS[id]} />
        <CommandCopy detail={detail} label={label} suggested={suggested} />
      </HStack>
    </Button>
  )
}

function CommandCopy({
  detail,
  label,
  suggested,
}: {
  detail?: string
  label: string
  suggested: boolean
}): React.JSX.Element {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text>{label}</Text>
      {detail === undefined ? null : (
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>
          {suggested ? detail : `· ${detail}`}
        </Text>
      )}
    </VStack>
  )
}
