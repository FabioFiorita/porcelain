import { SegmentedControl as NativeSegmentedControl } from '@expo/ui/community/segmented-control'

import { useResolvedColorScheme } from '@/features/settings/theme-provider'

type Option<T extends string> = {
  value: T
  label: string
  /**
   * Kept from the hand-rolled control so the seven call sites did not have to change, and so
   * component tests can still address one segment. A native segment is drawn by UIKit /
   * Compose and is NOT individually addressable at runtime — only the control carries a
   * `testID`. Treat these as identifiers for mocked renders, not as runtime handles.
   */
  testID?: string
}

/**
 * The platform's own segmented control: `UISegmentedControl` on iOS (SwiftUI `Picker` under
 * `.pickerStyle(.segmented)`), a Material 3 `SingleChoiceSegmentedButtonRow` on Android.
 *
 * This replaces a `Pressable` row that painted its own pill, fill and shadow. That copy was
 * honest about being a copy — it existed because RN Reusables' `ToggleGroup` left blank chips
 * — but a switcher is navigation chrome, and chrome is the one thing this app takes from the
 * platform rather than redrawing.
 *
 * Selection travels by INDEX, not by label. The native controls hand back the segment position;
 * matching on the label would break the moment two options ever read the same.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  testID,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  /** Held while a write is in flight, so a second tap cannot race the first. */
  disabled?: boolean
  testID?: string
}): React.JSX.Element {
  // The control follows the APP's resolved scheme, not the device's. Someone who pins Porcelain
  // to dark on a light phone would otherwise get one bright system control on a dark screen.
  const appearance = useResolvedColorScheme()

  return (
    <NativeSegmentedControl
      appearance={appearance}
      enabled={!disabled}
      selectedIndex={Math.max(
        0,
        options.findIndex((option) => option.value === value),
      )}
      testID={testID}
      values={options.map((option) => option.label)}
      onChange={(event) => {
        const selected = options[event.nativeEvent.selectedSegmentIndex]
        if (selected !== undefined) onChange(selected.value)
      }}
    />
  )
}
