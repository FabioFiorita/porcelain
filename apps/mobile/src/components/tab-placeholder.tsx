import { Column, Host, ScrollView, Spacer, Text } from '@expo/ui'

export function TabPlaceholder({
  detail,
  eyebrow,
  title,
}: {
  detail: string
  eyebrow: string
  title: string
}) {
  return (
    <Host seedColor="#0ea5e9" style={{ flex: 1 }} useViewportSizeMeasurement>
      <ScrollView>
        <Column alignment="start" spacing={8} style={{ padding: 24 }}>
          <Spacer size={24} />
          <Text textStyle={{ fontSize: 13, fontWeight: '600' }}>{eyebrow}</Text>
          <Text textStyle={{ fontSize: 34, fontWeight: '700' }}>{title}</Text>
          <Text textStyle={{ fontSize: 17, lineHeight: 24 }}>{detail}</Text>
        </Column>
      </ScrollView>
    </Host>
  )
}
