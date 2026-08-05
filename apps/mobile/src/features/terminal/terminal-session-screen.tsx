import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote } from '@/components/surface-chrome'

import { useTerminalStore } from './terminal-store'
import { TerminalView } from './terminal-view'

/**
 * One session, full screen, pushed from the roster.
 *
 * The native header is hidden because the terminal needs every row it can get and the bar
 * would eat two of them; the compact bar below carries the back affordance and the session
 * name instead. The pop gesture still works with the bar hidden.
 *
 * Leaving this screen deliberately does NOT detach: the PTY keeps streaming into its emulator,
 * so coming back shows what happened while you were away rather than a gap.
 */
export function TerminalSessionScreen({ sessionId }: { sessionId: string }): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const session = useTerminalStore((state) =>
    state.sessions.find((candidate) => candidate.id === sessionId),
  )

  return (
    <View
      className="flex-1 bg-background"
      /* nativewind-allow-style: the bar clears the live status-bar inset. */
      style={{ paddingTop: insets.top }}
      testID="porcelain-terminal-session"
    >
      <View className="flex-row items-center gap-1 border-b border-border px-1 py-1">
        <Pressable
          accessibilityLabel="Back to terminals"
          accessibilityRole="button"
          className="size-10 items-center justify-center rounded-lg active:bg-accent"
          testID="porcelain-terminal-session-back"
          onPress={() => {
            router.back()
          }}
        >
          <ChromeGlyph name="chevronLeft" size={18} tone="foreground" />
        </Pressable>
        <Text
          className="min-w-0 flex-1 text-sm font-semibold text-foreground"
          numberOfLines={1}
          testID="porcelain-terminal-session-title"
        >
          {session?.name ?? 'Terminal'}
        </Text>
        {session?.status === 'exited' ? (
          <Text className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            exited
          </Text>
        ) : (
          <View className="mr-3 size-2 rounded-full bg-success" />
        )}
      </View>

      {session === undefined ? (
        <EmptyNote
          body="It was killed here or from another client. Start a new one from the list."
          testID="porcelain-terminal-session-missing"
          title="This terminal is gone"
        />
      ) : (
        <TerminalView sessionId={sessionId} />
      )}
    </View>
  )
}
