import * as DialogPrimitive from '@rn-primitives/dialog'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { IconAction } from '@/components/panel-chrome'
import { Text } from '@/components/ui/text'
import { useShellStore } from '@/features/shell/shell-store'

import { QuickOpenSheet } from './quick-open-sheet'

const SCRIM = {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
} as const

/** Tablet command palette, owned by the outer shell so it covers every column. */
export function QuickOpenDialog(): React.JSX.Element {
  const open = useShellStore((state) => state.quickOpenOpen)
  const close = useShellStore((state) => state.closeQuickOpen)
  const window = useWindowDimensions()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <Pressable
            className="items-center justify-center"
            style={SCRIM}
            testID="porcelain-quick-open-backdrop"
          >
            <DialogPrimitive.Content asChild>
              {/* panel-card-allow: the tablet dialog shell, not a content card. */}
              <View
                className="overflow-hidden rounded-xl border border-border bg-card"
                style={{
                  height: Math.min(620, window.height - 64),
                  width: Math.min(720, window.width - 64),
                }}
                testID="porcelain-quick-open-dialog"
                onTouchEnd={(event) => event.stopPropagation()}
              >
                <View className="flex-row items-center border-b border-border px-5 py-3">
                  <Text className="min-w-0 flex-1 text-base font-semibold text-foreground">
                    Quick open
                  </Text>
                  <IconAction
                    accessibilityLabel="Close Quick open"
                    glyph="close"
                    testID="porcelain-quick-open-close"
                    tone="foreground"
                    onPress={close}
                  />
                </View>
                <QuickOpenSheet onClose={close} />
              </View>
            </DialogPrimitive.Content>
          </Pressable>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
