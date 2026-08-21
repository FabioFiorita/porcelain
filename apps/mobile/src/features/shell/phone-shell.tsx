import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { themeVarsFor } from '@/features/settings/theme-vars'

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
 */
export function PhoneShell(): React.JSX.Element {
  // Tab tint follows the shared `primary` token, not a hardcoded system blue.
  const tintColor = themeVarsFor(useResolvedColorScheme()).primary ?? '#171717'

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      minimizeBehavior="onScrollDown"
      tintColor={tintColor}
    >
      <NativeTabs.Trigger name="(hub)">
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" md="layers" />
        <NativeTabs.Trigger.Label>Worktrees</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="terminals">
        <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
        <NativeTabs.Trigger.Label>Terminals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
