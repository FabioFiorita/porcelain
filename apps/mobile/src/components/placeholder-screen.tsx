import { Column, Host, ScrollView, Spacer, Text } from '@expo/ui'

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
        <Column alignment="start" spacing={12} style={{ padding: 24 }}>
          <Spacer size={8} />
          <Text textStyle={{ fontSize: 28, fontWeight: '700' }}>{title}</Text>
          <Text textStyle={{ fontSize: 17, lineHeight: 24 }}>{description}</Text>
          <Spacer size={8} />
          {details.map((detail) => (
            <Text key={detail} textStyle={{ fontSize: 15, lineHeight: 22 }}>{`• ${detail}`}</Text>
          ))}
        </Column>
      </ScrollView>
    </Host>
  )
}
