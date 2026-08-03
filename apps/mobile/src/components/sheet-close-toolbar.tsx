import { router, Stack } from 'expo-router'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { toolbarIcon } from '@/components/toolbar-icon'

/**
 * Dismiss control every sheet wears, top right. An `xmark` rather than a "Done" label:
 * these sheets are read, not filled in, so there is nothing to confirm — and an icon
 * matches the round header buttons the sheet was raised from.
 *
 * `Stack.Toolbar.*` elements have to be created inside the component that renders
 * `Stack.Toolbar`, so a sheet needing extra buttons declares its own instead of this.
 *
 * Guarded: the iPad SplitView inspector (and any host outside a native-stack composition)
 * has no RouterCompositionOptionsProvider — Stack.Toolbar throws there.
 */
export function SheetCloseToolbar(): React.JSX.Element {
  return (
    <StackToolbarGuard>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Close"
          icon={toolbarIcon('close')}
          onPress={(): void => router.back()}
        />
      </Stack.Toolbar>
    </StackToolbarGuard>
  )
}

/** Swallows the composition-context throw so inspector / bare hosts stay mounted. */
class StackToolbarGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally empty — missing composition context is expected outside Stack hosts.
  }

  render(): ReactNode {
    if (this.state.failed) return null
    return this.props.children
  }
}
