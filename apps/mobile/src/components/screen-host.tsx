import { Host } from '@expo/ui/swift-ui'
import type { ReactNode } from 'react'

import { useAccentColor } from '@/theme/use-accent-color'

/**
 * The root every full-screen SwiftUI tree sits in. `useViewportSizeMeasurement` is what lets a
 * `List` or `Form` fill the screen instead of collapsing to its content height, so it is part of
 * the contract, not a per-screen choice — a screen that hosts its own `Host` will silently
 * disagree with the rest of the app about seed colour and sizing.
 */
export function ScreenHost({ children }: { children: ReactNode }): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
      {children}
    </Host>
  )
}
