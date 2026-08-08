import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { PanelLabel } from '@/components/panel-chrome'
import { QUICK_COMMANDS, type QuickCommandId } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'
import { useGitSuggestions, useQuickCommand } from './use-commit'

/** Label + glyph for each whitelisted command; the ids come from the daemon's own list. */
const COMMAND_FACES: Record<QuickCommandId, { label: string; glyph: ChromeIconName }> = {
  fetch: { label: 'fetch', glyph: 'refresh' },
  pull: { label: 'pull', glyph: 'arrowDown' },
  push: { label: 'push', glyph: 'arrowUpFromLine' },
  status: { label: 'status', glyph: 'info' },
  stash: { label: 'stash', glyph: 'archive' },
  'stash-pop': { label: 'stash pop', glyph: 'archiveRestore' },
}

type CommandResult = { label: string; output: string; failed: boolean }

/**
 * Suggested + Commands: the contextual "one command worth running now" tile over the
 * whitelisted grid. The suggestion heuristic is the daemon's (behind / ahead / stash / dirty),
 * so the phone shows exactly what the desktop does.
 */
export function QuickCommandsCard({ active }: { active: boolean }): React.JSX.Element {
  const suggestions = useGitSuggestions(active)
  const { isRunning, runCommand } = useQuickCommand()
  const [running, setRunning] = useState<QuickCommandId | null>(null)
  const [result, setResult] = useState<CommandResult | null>(null)

  const handleRun = async (command: QuickCommandId): Promise<void> => {
    if (isRunning) return
    setRunning(command)
    setResult(null)
    try {
      const output = await runCommand(command)
      setResult({
        failed: false,
        label: COMMAND_FACES[command].label,
        output: output === '' ? '(no output)' : output,
      })
    } catch (cause) {
      setResult({
        failed: true,
        label: COMMAND_FACES[command].label,
        output: cause instanceof Error ? cause.message : String(cause),
      })
    } finally {
      setRunning(null)
    }
  }

  return (
    <>
      {suggestions.length === 0 ? null : (
        <View className="gap-2" testID="porcelain-changes-suggested">
          <PanelLabel>Suggested</PanelLabel>
          <View className="gap-0.5 rounded-2xl border border-border bg-card p-1">
            {suggestions.map((suggestion) => {
              const command = asQuickCommand(suggestion.command)
              if (command === null) return null
              const face = COMMAND_FACES[command]
              return (
                <Pressable
                  key={command}
                  accessibilityLabel={`Run git ${face.label} — ${suggestion.reason}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isRunning }}
                  className={cn(
                    'min-h-12 flex-row items-center gap-2.5 rounded-xl px-2.5 py-2 active:bg-accent',
                    isRunning && 'opacity-60',
                  )}
                  disabled={isRunning}
                  testID={`porcelain-changes-suggested-${command}`}
                  onPress={() => {
                    handleRun(command)
                  }}
                >
                  <ChromeGlyph name={running === command ? 'refresh' : 'sparkles'} size={15} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-mono text-xs text-foreground">git {face.label}</Text>
                    <Text className="text-2xs text-muted-foreground" numberOfLines={2}>
                      {suggestion.reason}
                    </Text>
                  </View>
                  <ChromeGlyph name="chevronRight" size={14} />
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      <View className="gap-2" testID="porcelain-changes-commands">
        <PanelLabel>Commands</PanelLabel>
        <View className="flex-row flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((command) => {
            const face = COMMAND_FACES[command]
            return (
              <Pressable
                key={command}
                accessibilityLabel={`git ${face.label}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isRunning }}
                className={cn(
                  'min-h-10 min-w-[8rem] flex-1 flex-row items-center gap-1.5 rounded-xl border border-border bg-secondary px-2.5 py-2 active:bg-accent',
                  isRunning && 'opacity-60',
                )}
                disabled={isRunning}
                testID={`porcelain-changes-command-${command}`}
                onPress={() => {
                  handleRun(command)
                }}
              >
                <ChromeGlyph name={running === command ? 'refresh' : face.glyph} size={14} />
                <Text className="font-mono text-xs text-secondary-foreground">{face.label}</Text>
              </Pressable>
            )
          })}
        </View>
        {result === null ? null : (
          <CommandResultCard
            result={result}
            onDismiss={() => {
              setResult(null)
            }}
          />
        )}
      </View>
    </>
  )
}

/** The daemon's suggestion carries a bare string; only the whitelisted ids are runnable. */
function asQuickCommand(command: string): QuickCommandId | null {
  return QUICK_COMMANDS.find((candidate) => candidate === command) ?? null
}

function CommandResultCard({
  onDismiss,
  result,
}: {
  onDismiss: () => void
  result: CommandResult
}): React.JSX.Element {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-card"
      testID="porcelain-changes-command-result"
    >
      <View className="flex-row items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        <ChromeGlyph
          name={result.failed ? 'circleX' : 'circleCheck'}
          size={14}
          tone={result.failed ? 'destructive' : 'success'}
        />
        <Text className="min-w-0 flex-1 font-mono text-xs text-foreground" numberOfLines={1}>
          git {result.label}
        </Text>
        <Pressable
          accessibilityLabel="Dismiss result"
          accessibilityRole="button"
          className="p-1"
          hitSlop={8}
          testID="porcelain-changes-command-result-dismiss"
          onPress={onDismiss}
        >
          <ChromeGlyph name="close" size={13} />
        </Pressable>
      </View>
      <ScrollView className="max-h-44" nestedScrollEnabled>
        <Text
          className={cn(
            'px-2.5 py-2 font-mono text-2xs leading-4',
            result.failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {result.output}
        </Text>
      </ScrollView>
    </View>
  )
}
