import { Text, useWindowDimensions, View } from 'react-native'
import { ShellModal } from '@/components/shell-modal'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { QuickOpenSheet } from '@/features/quick-open/quick-open-sheet'
import { cn } from '@/lib/utils'
import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'

function useSheetMetrics(): {
  sheetMaxW: number
  sheetMaxH: number
  searchMaxW: number
} {
  // Live dimensions — module-level Dimensions.get freezes portrait metrics on a
  // landscape iPad and starves the Settings dialog of width for segmented controls.
  const { width, height } = useWindowDimensions()
  const isPhoneWidth = width < 768
  return {
    sheetMaxW: isPhoneWidth ? Math.min(width - 24, 400) : Math.min(width * 0.55, 440),
    sheetMaxH: isPhoneWidth ? Math.min(height * 0.78, 640) : Math.min(height * 0.72, 520),
    searchMaxW: isPhoneWidth ? Math.min(width - 24, 400) : Math.min(width * 0.55, 500),
  }
}

/** Quick open and the surface Companion. Settings is a tab, so its sheet is gone with the
 * tablet shell that was the only thing opening it. */
export function ShellSheets(): React.JSX.Element {
  const sheet = useShellStore((state) => state.sheet)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const { sheetMaxW, sheetMaxH, searchMaxW } = useSheetMetrics()
  return (
    <>
      <QuickOpenSheet open={sheet === 'search'} onClose={closeSheet} maxWidth={searchMaxW} />

      <ShellModal
        open={sheet === 'companion'}
        onClose={closeSheet}
        title={undefined}
        hideHeader
        bare
        contentStyle={{ width: sheetMaxW, maxHeight: sheetMaxH }}
      >
        <CompanionSheetBody />
      </ShellModal>
    </>
  )
}

function CompanionSheetBody(): React.JSX.Element {
  const surfaceId = useShellStore((state) => state.activeSurface)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const { sheetMaxH } = useSheetMetrics()
  const slots = surfaceSlots(surfaceId)

  return (
    <View className="gap-3 py-5" testID="porcelain-companion-sheet">
      {/* Horizontal padding lives here, not on the outer View: the companion below already
          carries its own `SURFACE_GUTTER`, the same one every other screen uses — wrapping it
          in a second, wider gutter doubled the inset from the sheet edge to the actual
          content, which is what read as "too much padding" next to Files. */}
      <View className={cn('gap-1 pr-8', SURFACE_GUTTER)}>
        <Text className="text-lg font-semibold text-foreground">Companion</Text>
      </View>
      {/* nativewind-allow-style: the height is derived from live window metrics, not a class. */}
      <View style={{ height: sheetMaxH - 170 }}>
        <slots.companion active />
      </View>
      <View className={SURFACE_GUTTER}>
        <Button onPress={closeSheet} variant="outline">
          <UiText>Done</UiText>
        </Button>
      </View>
    </View>
  )
}
