import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyNote, ScreenHeader } from '@/components/surface-chrome'
import { useTabBarInset } from '@/features/shell/tab-bar-inset'

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
  // Pushed inside the tab, so the floating tab bar stays on screen over this pane. Without the
  // reservation the grid is fitted to the full height and the PTY writes its last rows — the
  // prompt, a build's final verdict — underneath the bar, unreachable and unscrollable.
  const bottomInset = useTabBarInset()
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
      <ScreenHeader
        actions={
          session?.status === 'exited' ? (
            <Text className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              exited
            </Text>
          ) : (
            <View className="mr-2 size-2 rounded-full bg-success" />
          )
        }
        back={{
          accessibilityLabel: 'Back to terminals',
          onPress: () => {
            router.back()
          },
          testID: 'porcelain-terminal-session-back',
        }}
        title={session?.name ?? 'Terminal'}
        topInset={0}
      />

      {session === undefined ? (
        <EmptyNote
          body="It was killed here or from another client. Start a new one from the list."
          testID="porcelain-terminal-session-missing"
          title="This terminal is gone"
        />
      ) : (
        <TerminalView bottomInset={bottomInset} sessionId={sessionId} />
      )}
    </View>
  )
}
