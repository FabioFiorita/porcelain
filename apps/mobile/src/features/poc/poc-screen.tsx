import { useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { POC_ITEMS, type PocItem, type PocSurfaceId, surfaceById } from './poc-data'
import { PocGlyph } from './poc-glyph'

type PocSurfaceScreenProps = {
  surface: PocSurfaceId
}

/** Phone tab body until a dedicated phone chrome pass. Tablet uses `shell/ViewerCanvas`. */
export function PocSurfaceScreen({ surface }: PocSurfaceScreenProps): React.JSX.Element {
  const definition = surfaceById(surface)
  const insets = useSafeAreaInsets()
  const items = POC_ITEMS[surface]
  const [selectedItem, setSelectedItem] = useState(items[0]?.id ?? '')
  const selected = items.find((item) => item.id === selectedItem) ?? items[0]

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-7 px-6 pb-12 sm:px-8"
      contentContainerStyle={{
        paddingTop: Platform.OS === 'android' ? insets.top + 24 : 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-muted-foreground">
            {definition.eyebrow}
          </Text>
          <Badge variant="secondary">
            <UiText>Phone</UiText>
          </Badge>
        </View>
        <Text className="text-4xl font-extrabold tracking-tight text-foreground">
          {definition.label}
        </Text>
        <Text className="max-w-xl text-base leading-6 text-muted-foreground">
          {definition.description}
        </Text>
      </View>

      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1.5">
              <CardTitle>{definition.label}</CardTitle>
              <CardDescription>
                Phone tab content. Tablet chrome is the outer shell in features/shell.
              </CardDescription>
            </View>
            <View className="size-10 items-center justify-center rounded-full bg-primary/10">
              <PocGlyph size={19} symbol="▤" tone="primary" />
            </View>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2 rounded-xl border border-border bg-muted/40 p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Selected
            </Text>
            <Text className="text-lg font-semibold text-foreground">{selected?.label}</Text>
            <Text className="text-sm leading-5 text-muted-foreground">{selected?.detail}</Text>
          </View>
          <Separator />
          <View className="gap-2">
            {items.map((item) => (
              <SampleItem
                key={item.id}
                item={item}
                selected={item.id === selectedItem}
                onPress={() => {
                  setSelectedItem(item.id)
                }}
              />
            ))}
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  )
}

function SampleItem({
  item,
  onPress,
  selected,
}: {
  item: PocItem
  onPress: () => void
  selected: boolean
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-transparent px-3 py-3 active:bg-accent',
        selected && 'border-border bg-muted/50',
      )}
      onPress={onPress}
    >
      <View
        className={cn(
          'size-8 items-center justify-center rounded-full bg-muted',
          selected && 'bg-primary/10',
        )}
      >
        <PocGlyph size={15} symbol={selected ? '✓' : '•'} tone={selected ? 'primary' : 'muted'} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-medium text-foreground">{item.label}</Text>
        <Text className="text-sm text-muted-foreground">{item.detail}</Text>
      </View>
      {item.state === 'attention' ? (
        <Badge variant="outline">
          <UiText>Review</UiText>
        </Badge>
      ) : null}
    </Pressable>
  )
}
