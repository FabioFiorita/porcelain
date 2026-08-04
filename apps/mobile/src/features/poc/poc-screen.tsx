import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import { POC_ITEMS, type PocItem, type PocSurfaceId, surfaceById } from './poc-data'
import { PocGlyph } from './poc-glyph'
import { usePocInspector } from './poc-shell'

type PocSurfaceScreenProps = {
  surface: PocSurfaceId
}

export function PocSurfaceScreen({ surface }: PocSurfaceScreenProps): React.JSX.Element {
  const definition = surfaceById(surface)
  const inspector = usePocInspector()
  const items = POC_ITEMS[surface]
  const [selectedItem, setSelectedItem] = useState(items[0]?.id ?? '')
  const selected = items.find((item) => item.id === selectedItem) ?? items[0]

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-7 px-6 pb-12 pt-6 sm:px-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-muted-foreground">
            {definition.eyebrow}
          </Text>
          <Badge variant="secondary">
            <UiText>POC</UiText>
          </Badge>
        </View>
        <Text className="text-4xl font-extrabold tracking-tight text-foreground">
          {definition.label}
        </Text>
        <Text className="max-w-xl text-base leading-6 text-muted-foreground">
          {definition.description}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
          <PocGlyph size={15} symbol="▤" tone="muted" />
          <Text className="text-xs font-medium text-muted-foreground">
            {inspector === null ? 'Native tabs entry' : 'SplitView secondary'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
          <PocGlyph size={15} symbol=">_" tone="muted" />
          <Text className="text-xs font-medium text-muted-foreground">Local sample data only</Text>
        </View>
      </View>

      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1.5">
              <CardTitle>Secondary column</CardTitle>
              <CardDescription>
                This is the shared content surface that both entry points can host.
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
              Selected preview
            </Text>
            <Text className="text-lg font-semibold text-foreground">{selected?.label}</Text>
            <Text className="text-sm leading-5 text-muted-foreground">{selected?.detail}</Text>
          </View>
          <Separator />
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Sample list</Text>
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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Entry-point experiment</CardTitle>
          <CardDescription>
            The route content stays shared; only the native shell changes by form factor.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <AnatomyRow label="iPhone" value="NativeTabs · four primary destinations" />
          <AnatomyRow label="iPad" value="SplitView · primary / supplementary / secondary" />
          <AnatomyRow
            label="Inspector"
            value={
              inspector === null
                ? 'iPad-only companion column'
                : inspector.visible
                  ? 'Visible'
                  : 'Hidden'
            }
          />
          {inspector !== null ? (
            <Button
              className="mt-2 self-start"
              onPress={inspector.toggle}
              size="sm"
              variant="outline"
            >
              <PocGlyph size={15} symbol="▤" tone="foreground" />
              <UiText>{inspector.visible ? 'Hide inspector' : 'Show inspector'}</UiText>
            </Button>
          ) : null}
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

function AnatomyRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm leading-5 text-muted-foreground">{value}</Text>
    </View>
  )
}
