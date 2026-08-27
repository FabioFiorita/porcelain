import * as DialogPrimitive from '@rn-primitives/dialog'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { IconAction } from '@/components/panel-chrome'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'
import { useIsTablet } from '@/features/shell/use-app-window'

const FILL = { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 } as const
const SCRIM = { ...FILL, backgroundColor: 'rgba(0, 0, 0, 0.5)' } as const

export function ResponsiveHubDialog({
  children,
  description,
  onClose,
  open,
  testID,
  title,
}: {
  children: React.ReactNode
  description?: string
  onClose: () => void
  open: boolean
  testID: string
  title: string
}): React.JSX.Element {
  const tablet = useIsTablet()
  const window = useWindowDimensions()

  if (!tablet) {
    return (
      <Sheet
        description={description}
        open={open}
        scrollable
        testID={testID}
        title={title}
        onClose={onClose}
      >
        {children}
      </Sheet>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <Pressable
            className="items-center justify-center"
            style={SCRIM}
            testID={`${testID}-backdrop`}
          >
            <DialogPrimitive.Content asChild>
              {/* panel-card-allow: this is the dialog shell, not a content card. Its tighter
                  radius matches the tablet's other modal windows. */}
              <View
                className="overflow-hidden rounded-xl border border-border bg-card"
                onTouchEnd={(event) => event.stopPropagation()}
                style={{
                  height: Math.min(620, window.height - 64),
                  width: Math.min(620, window.width - 64),
                }}
                testID={testID}
              >
                <View className="flex-row items-start gap-2 border-b border-border px-5 py-4">
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-base font-semibold text-foreground">{title}</Text>
                    {description === undefined ? null : (
                      <Text className="text-xs text-muted-foreground">{description}</Text>
                    )}
                  </View>
                  <IconAction
                    accessibilityLabel={`Close ${title}`}
                    glyph="close"
                    testID={`${testID}-close`}
                    tone="foreground"
                    onPress={onClose}
                  />
                </View>
                <View className="min-h-0 flex-1">{children}</View>
              </View>
            </DialogPrimitive.Content>
          </Pressable>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
