import { router, Stack } from 'expo-router'

import { toolbarIcon } from '@/components/toolbar-icon'

/**
 * Dismiss control every sheet wears, top right. An `xmark` rather than a "Done" label:
 * these sheets are read, not filled in, so there is nothing to confirm — and an icon
 * matches the round header buttons the sheet was raised from.
 *
 * `Stack.Toolbar.*` elements have to be created inside the component that renders
 * `Stack.Toolbar`, so a sheet needing extra buttons declares its own instead of this.
 */
export function SheetCloseToolbar(): React.JSX.Element {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel="Close"
        icon={toolbarIcon('close')}
        onPress={(): void => router.back()}
      />
    </Stack.Toolbar>
  )
}
