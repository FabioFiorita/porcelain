import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet'
import { useRef } from 'react'
import { Text, View } from 'react-native'

import { cn } from '@/lib/utils'

/**
 * The platform's own sheet, holding ordinary React Native content.
 *
 * This replaces `ShellModal`: a transparent RN `Modal` centring a rounded `View`, with a
 * `KeyboardAvoidingView` around it, a hand-drawn close button, a hand-computed width and max
 * height from live window metrics, and a module-level counter that logged a warning when two
 * were presented at once because nested RN modals break iOS keyboard avoidance.
 *
 * Underneath this is a SwiftUI sheet with presentation detents on iOS and a Material 3
 * `ModalBottomSheet` on Android, hosting our views through `RNHostView`. Detents, the grabber,
 * drag-to-dismiss, the backdrop, and keyboard behaviour all come from the platform, which is
 * why none of the machinery above survives. The CONTENT is still NativeWind and the shared
 * primitives — only the presentation changed hands.
 *
 * Sheets that are a destination rather than a control — quick open, the surface companion —
 * are `formSheet` ROUTES instead (see `app/(hub)/_layout.tsx`). This is for the ones that
 * belong to a component: a row's action list, a rename field, a token picker.
 */
export function NativeSheet({
  children,
  description,
  onClose,
  open,
  snapPoints,
  testID,
  title,
}: {
  children: React.ReactNode
  description?: string
  onClose: () => void
  open: boolean
  /**
   * Rest heights, as fractions or point values. Omit to let the sheet size itself to its
   * content, which is the right answer for a short action list or a one-field form; give one
   * when the body scrolls, because a scrolling child has no intrinsic height to measure.
   */
  snapPoints?: (string | number)[]
  testID?: string
  title?: string
}): React.JSX.Element {
  // The sheet reports a close for BOTH a user dismissal and our own `index: -1`. Only the
  // first is news: the second means the owner already set `open` to false, and telling it
  // again is how a close handler that navigates fires twice.
  const wasOpen = useRef(open)
  wasOpen.current = open
  const sized = snapPoints !== undefined && snapPoints.length > 0

  return (
    <BottomSheet
      enablePanDownToClose
      index={open ? 0 : -1}
      snapPoints={snapPoints}
      onClose={() => {
        if (wasOpen.current) onClose()
      }}
    >
      <BottomSheetView style={sized ? { flex: 1 } : undefined}>
        <View className={cn('gap-3 pb-8', sized && 'flex-1')} testID={testID}>
          {title === undefined ? null : (
            <View className="gap-1 px-5">
              <Text className="text-lg font-semibold text-foreground">{title}</Text>
              {description === undefined ? null : (
                <Text className="text-sm text-muted-foreground">{description}</Text>
              )}
            </View>
          )}
          {children}
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}
