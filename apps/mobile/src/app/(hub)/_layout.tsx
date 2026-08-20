import { Stack } from 'expo-router/stack'

import { HeaderActions, HeaderDoneButton } from '@/features/shell/header-actions'

/**
 * The Hub tab is one native stack: the Worktree list pushes a Worktree, and a Worktree pushes
 * its surfaces and their detail screens. Three nested stacks (Files, Changes, Terminal) used to
 * do this job because each surface was its own tab; one stack replaces them now that a surface
 * is a screen rather than a tab.
 *
 * Detail routes stay direct children of this group so their URLs are unchanged — `/file/…`,
 * `/folder/…`, `/changes/file/…` — and every `router.push` in the feature panels keeps working.
 *
 * **The header is the platform's.** Every screen here used to paint a `PhoneHeader`: a `View`
 * with a hand-drawn chevron, a 28pt title and two bordered chips, under a stack with
 * `headerShown: false`. It re-implemented the back button, the safe-area inset, the title
 * truncation and the action cluster, and it got none of the behaviour that makes a native bar
 * feel native — the title/back crossfade during a push, the large-title collapse, the scroll
 * edge effect, or the system's own back-gesture affordance. Titles and toolbars are declared
 * here as screen options instead, and `UINavigationBar` / the Material app bar draw them.
 *
 * `DETAIL` is the one group that stays opted out, and it is a scope decision rather than a
 * preference: those screens render `ScreenHeader` from `panel-chrome`, whose actions are bound
 * to state living inside the viewer component (pin, comment, reviewed, split/unified) and whose
 * subtitle is a head-truncated monospace path the native title slot has no shape for. Moving
 * them is its own pass. Two bars on one screen is the failure mode this constant prevents.
 */
const DETAIL = { headerShown: false } as const

/**
 * A presented sheet, not a pushed screen: the quick-open palette and the surface companion.
 *
 * `formSheet` is `UISheetPresentationController` on iOS and a Material bottom sheet on Android,
 * which is what the app used to approximate with a transparent `Modal` holding a rounded `View`
 * — no detents, no grabber, no drag-to-dismiss, and a keyboard-avoidance workaround per sheet.
 */
const SHEET = {
  presentation: 'formSheet' as const,
  // Half height to start — enough list to read without covering the screen it was opened from
  // — and near-full for when the answer is further down.
  sheetAllowedDetents: [0.6, 0.95],
  sheetCornerRadius: 20,
  sheetGrabberVisible: true,
}

export default function HubLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        // A pushed screen shows the previous screen's title next to the chevron by default,
        // which on a stack this deep (Worktrees → Worktree → Files → folder → file) spends the
        // whole bar on where you came from. The glyph alone says the same thing.
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* The Worktrees list is a tab root: nothing is behind it, so it carries the large title
          and no back button. */}
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Worktrees' }} />

      {/* `worktree`, `git` and the Canvas screens set their own titles from what they are
          showing — a project name, a document name — so their options live in the screen. */}

      <Stack.Screen
        name="files"
        options={{ headerRight: () => <HeaderActions companionSurface="files" />, title: 'Files' }}
      />
      <Stack.Screen
        name="changes/index"
        options={{
          headerRight: () => <HeaderActions companionSurface="changes" />,
          title: 'Changes',
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          headerRight: () => <HeaderActions companionSurface="history" />,
          title: 'History',
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          // The bolt opens Search's own companion — recent queries, not Files' pins and notes.
          headerRight: () => <HeaderActions companionSurface="search" />,
          title: 'Search',
        }}
      />
      {/* No Terminal screen here. Shells are daemon-wide and live in the Terminals tab
          (`app/terminals/`) — a Worktree's own sessions were a second terminal home, and the
          long-lived one was always the one you were not standing in. */}

      <Stack.Screen
        name="quick-open"
        options={{
          ...SHEET,
          headerRight: () => <HeaderDoneButton testID="porcelain-quick-open-done" />,
          title: 'Quick open',
        }}
      />
      <Stack.Screen
        name="companion"
        options={{
          ...SHEET,
          headerRight: () => <HeaderDoneButton testID="porcelain-companion-done" />,
          title: 'Companion',
        }}
      />

      <Stack.Screen name="file/[...path]" options={DETAIL} />
      <Stack.Screen name="folder/[...path]" options={DETAIL} />
      <Stack.Screen name="changes/read-all" options={DETAIL} />
      <Stack.Screen name="changes/file/[...path]" options={DETAIL} />
      <Stack.Screen name="changes/commit/[hash]/index" options={DETAIL} />
      <Stack.Screen name="changes/commit/[hash]/read-all" options={DETAIL} />
      <Stack.Screen name="changes/commit/[hash]/file/[...path]" options={DETAIL} />
    </Stack>
  )
}
