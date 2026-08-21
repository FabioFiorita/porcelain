import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'

import { PorcelainTabBar, TabBarItem } from './tab-bar'

/**
 * The app's four tabs.
 *
 * Worktrees is the Hub — every Worktree of every Environment in one list — and a surface is
 * reached THROUGH the Worktree that owns it, inside that tab's stack. Surfaces used to be the
 * tabs themselves, which meant five surfaces sharing four slots via a dual-face hack, and a
 * project / branch / worktree switcher in every header to say which checkout you were looking
 * at. Both are gone with this shell.
 *
 * Terminals and Tasks are daemon-wide, not per-Worktree, which is why they are tabs rather than
 * surfaces. Terminals is the ONE terminal surface — a Worktree no longer has a Terminal row of
 * its own, because a shell that outlives the checkout you were standing in has to be reachable
 * from somewhere that is not inside it.
 *
 * **The navigator is `expo-router/ui`, not `NativeTabs`.** `PorcelainTabBar` explains why the
 * bar is drawn rather than adopted. What matters here is what the swap does NOT cost: `TabSlot`
 * renders every tab that has been visited and hides the ones that are not focused
 * (`activityState: 0`, `display: none`) rather than unmounting them, so a Terminals session
 * survives a trip to Settings exactly as it did under the native navigator. A tab mounts lazily
 * on its first visit and is never torn down after.
 */
export function PhoneShell(): React.JSX.Element {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <PorcelainTabBar>
          <TabTrigger asChild href="/" name="hub">
            <TabBarItem glyph="layers" label="Worktrees" />
          </TabTrigger>
          <TabTrigger asChild href="/terminals" name="terminals">
            <TabBarItem glyph="terminal" label="Terminals" />
          </TabTrigger>
          <TabTrigger asChild href="/tasks" name="tasks">
            <TabBarItem glyph="checklist" label="Tasks" />
          </TabTrigger>
          <TabTrigger asChild href="/settings" name="settings">
            <TabBarItem glyph="settings" label="Settings" />
          </TabTrigger>
        </PorcelainTabBar>
      </TabList>
    </Tabs>
  )
}
