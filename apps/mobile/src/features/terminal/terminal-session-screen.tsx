import { settleBackground } from '@porcelain/shared/background'
import { Stack } from 'expo-router/stack'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { EmptyNote } from '@/components/surface-chrome'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { HeaderCloseButton } from '@/features/shell/header-actions'
import { useTerminalStream } from './terminal-roster'
import { useTerminalStore } from './terminal-store'
import { mobileTerminalAdapter } from './terminal-stream-adapter'
import { TerminalView } from './terminal-view'

/**
 * One session, full screen, pushed from the roster.
 *
 * The bar is the platform's, and deliberately the smallest one it will draw: the session name
 * as an inline title, no large title, a close item, and the live/exited marker. A terminal
 * wants every row the display has — but a modal is the root of its own presented stack, so the
 * bar draws no back button, and a full-screen presentation cannot be swiped away either. A bar
 * this screen can leave from is worth the two rows it costs.
 *
 * ATTACHING is this screen's job, not the roster's. The list is daemon-wide now — every PTY on
 * the machine, including a herd of agent shells nobody is looking at — and attaching all of them
 * would replay every scrollback into an emulator this phone is not showing. Opening one session
 * attaches one session, and the attach reply carries the scrollback that fills the view.
 *
 * Leaving this screen deliberately does NOT detach: the PTY keeps streaming into its emulator,
 * so coming back shows what happened while you were away rather than a gap.
 *
 * It declares no bottom chrome, because it is a `fullScreenModal` presented ABOVE the tab bar
 * (see the stack layout) — the grid gets every row the display has, which is the entire reason
 * the route is a modal rather than a push.
 */
export function TerminalSessionScreen({ sessionId }: { sessionId: string }): React.JSX.Element {
  useTerminalStream()
  const session = useTerminalStore((state) =>
    state.sessions.find((candidate) => candidate.id === sessionId),
  )

  useEffect(() => {
    const adapter = mobileTerminalAdapter()
    if (adapter.isTerminalAttached(sessionId)) return
    // A dropped socket leaves desired state awaiting reattach; the shared adapter owns retry.
    settleBackground(adapter.attachTerminal(sessionId), 'lifecycle')
  }, [sessionId])

  return (
    <ClearBottomChrome>
      <View className="flex-1 bg-background" testID="porcelain-terminal-session">
        {/* The session's name is minted by the daemon, so the screen sets the title, not the
            stack layout. */}
        <Stack.Screen
          options={{
            headerLeft: () => <HeaderCloseButton testID="porcelain-terminal-session-back" />,
            headerRight: () =>
              session?.status === 'exited' ? (
                <Text className="text-3xs uppercase tracking-widest text-muted-foreground">
                  exited
                </Text>
              ) : (
                <View className="size-2 rounded-full bg-success" />
              ),
            title: session?.name ?? 'Terminal',
          }}
        />

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
    </ClearBottomChrome>
  )
}
