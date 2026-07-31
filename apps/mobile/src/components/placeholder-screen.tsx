import { Host, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, frame, padding } from '@expo/ui/swift-ui/modifiers'

import { colors } from '@/theme/colors'

export function PlaceholderScreen({
  description,
  details,
  title,
}: {
  description: string
  details: readonly string[]
  title: string
}) {
  return (
    <Host seedColor={colors.tint} style={{ flex: 1 }} useViewportSizeMeasurement>
      <ScrollView>
        {/*
          `Spacer` fills available space in a SwiftUI stack, so a fixed gap is a
          `frame` height on it — not a size prop.
        */}
        <VStack alignment="leading" modifiers={[padding({ all: 24 })]} spacing={12}>
          <Spacer modifiers={[frame({ height: 8 })]} />
          <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>{title}</Text>
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
