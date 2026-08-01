import { Host, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, frame, padding } from '@expo/ui/swift-ui/modifiers'

import { useAccentColor } from '@/theme/colors'

/**
 * Scaffolding for a surface that is not built yet. It deliberately renders no title:
 * `ScreenHeader` owns that, and drawing one here too is what put "Files" on the screen
 * twice.
 */
export function PlaceholderScreen({
  description,
  details,
}: {
  description: string
  details: readonly string[]
}): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
      <ScrollView>
        {/*
          `Spacer` fills available space in a SwiftUI stack, so a fixed gap is a
          `frame` height on it — not a size prop.
        */}
        <VStack alignment="leading" modifiers={[padding({ all: 24 })]} spacing={12}>
          <Text modifiers={[font({ textStyle: 'body' })]}>{description}</Text>
          <Spacer modifiers={[frame({ height: 8 })]} />
          {details.map((detail) => (
            <Text
              key={detail}
              modifiers={[font({ textStyle: 'subheadline' })]}
            >{`• ${detail}`}</Text>
          ))}
        </VStack>
      </ScrollView>
    </Host>
  )
}
