import { Link, usePathname } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { SplitView } from 'expo-router/unstable-split-view'
import { createContext, useContext, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeAreaView } from 'react-native-screens/experimental'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import {
  POC_ITEMS,
  POC_SURFACES,
  type PocSurface,
  type PocSurfaceId,
  surfaceForPath,
} from './poc-data'
import { PocGlyph } from './poc-glyph'

type PocInspectorContextValue = {
  visible: boolean
  toggle: () => void
}

const PocInspectorContext = createContext<PocInspectorContextValue | null>(null)

export function usePocInspector(): PocInspectorContextValue | null {
  return useContext(PocInspectorContext)
}

export function PocIPhoneEntryPoint(): React.JSX.Element {
  return (
    <NativeTabs disableTransparentOnScrollEdge minimizeBehavior="onScrollDown" tintColor="#0A84FF">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="changes">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" md="account_tree" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge>3</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf="checkmark.bubble.fill" md="rate_review" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="terminal">
        <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

export function PocIPadEntryPoint(): React.JSX.Element {
  const [visible, setVisible] = useState(true)
  const [primaryCollapsed, setPrimaryCollapsed] = useState(false)
  const toggle = (): void => {
    setVisible((current) => !current)
  }

  return (
    <PocInspectorContext.Provider value={{ toggle, visible }}>
      <View className="flex-1 bg-background">
        <PocIPadHeader />
        <View className="min-h-0 flex-1">
          <SplitView
            columnMetrics={{
              preferredInspectorColumnWidthOrFraction: 0.24,
              preferredPrimaryColumnWidthOrFraction: 0.22,
              preferredSecondaryColumnWidthOrFraction: 0.36,
              preferredSupplementaryColumnWidthOrFraction: 0.22,
            }}
            preferredDisplayMode="twoBesideSecondary"
            preferredSplitBehavior="tile"
            onDisplayModeWillChange={(event) => {
              setPrimaryCollapsed(event.nativeEvent.nextDisplayMode === 'oneBesideSecondary')
            }}
            primaryBackgroundStyle="none"
            showInspector={visible}
            topColumnForCollapsing="primary"
          >
            <SplitView.Column>
              <PocPrimaryColumn inspectorVisible={visible} onToggleInspector={toggle} />
            </SplitView.Column>
            <SplitView.Column>
              <PocSupplementaryColumn primaryCollapsed={primaryCollapsed} />
            </SplitView.Column>
            <SplitView.Inspector>
              <PocInspector onToggle={toggle} />
            </SplitView.Inspector>
          </SplitView>
        </View>
      </View>
    </PocInspectorContext.Provider>
  )
}

function PocIPadHeader(): React.JSX.Element {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="bg-background"
      style={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top }}
    >
      <View className="flex-row items-center justify-between gap-4 border-b border-border px-5 pb-3 pt-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="size-9 items-center justify-center rounded-xl bg-primary">
            <Text className="text-sm font-black text-primary-foreground">P</Text>
          </View>
          <View className="gap-0.5">
            <Text className="font-semibold text-foreground">Porcelain</Text>
            <Text className="text-xs text-muted-foreground">Navigation POC</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="items-end gap-0.5">
            <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace
            </Text>
            <Text className="text-sm text-foreground">porcelain · main · current worktree</Text>
          </View>
          <Badge variant="outline">
            <UiText>iPad</UiText>
          </Badge>
        </View>
      </View>
    </View>
  )
}

function PocPrimaryColumn({
  inspectorVisible,
  onToggleInspector,
}: {
  inspectorVisible: boolean
  onToggleInspector: () => void
}): React.JSX.Element {
  const pathname = usePathname()
  const activeSurface = surfaceForPath(pathname)

  return (
    <SafeAreaView
      className="flex-1 bg-sidebar"
      edges={{ bottom: true, left: true }}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow gap-5 px-3 pb-5 pt-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Text className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Destinations
          </Text>
          <View className="gap-1">
            {POC_SURFACES.map((surface) => (
              <SurfaceLink
                key={surface.id}
                active={surface.id === activeSurface.id}
                surface={surface}
              />
            ))}
          </View>
        </View>

        <View className="mt-auto gap-3">
          <Separator />
          <Button onPress={onToggleInspector} size="sm" variant="outline">
            <PocGlyph size={16} symbol="▤" tone="foreground" />
            <UiText>{inspectorVisible ? 'Hide inspector' : 'Show inspector'}</UiText>
          </Button>
          <Text className="px-2 text-xs leading-4 text-muted-foreground">
            The OS owns column sizing and collapse behavior.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function PocSupplementaryColumn({
  primaryCollapsed,
}: {
  primaryCollapsed: boolean
}): React.JSX.Element {
  const pathname = usePathname()
  const activeSurface = surfaceForPath(pathname)
  const items = POC_ITEMS[activeSurface.id]
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '')
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0]

  return (
    <SafeAreaView
      className="flex-1 bg-card"
      edges={{ bottom: true, left: true, right: true }}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          gap: 20,
          paddingBottom: 24,
          paddingHorizontal: 16,
          paddingTop: primaryCollapsed ? 64 : 20,
        }}
      >
        <View className="gap-1 px-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Supplementary
          </Text>
          <Text className="text-2xl font-bold text-foreground">{activeSurface.label}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            A list can stay visible while the detail surface changes.
          </Text>
        </View>

        <Separator />

        <View className="gap-1">
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === selectedItem?.id }}
              className={cn(
                'flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent',
                item.id === selectedItem?.id && 'bg-muted/60',
              )}
              onPress={() => {
                setSelectedItemId(item.id)
              }}
            >
              <View className="size-9 items-center justify-center rounded-lg bg-muted">
                <Text className="text-sm font-semibold text-muted-foreground">{index + 1}</Text>
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-medium text-foreground">{item.label}</Text>
                <Text className="text-xs leading-4 text-muted-foreground">{item.detail}</Text>
              </View>
              <PocGlyph size={15} symbol="›" tone="muted" />
            </Pressable>
          ))}
        </View>

        <View className="gap-3 rounded-xl border border-dashed border-border p-3">
          <View className="flex-row items-center gap-2">
            <PocGlyph size={16} symbol="+" tone="muted" />
            <Text className="text-sm font-medium text-foreground">List placeholder</Text>
          </View>
          <Text className="text-xs leading-4 text-muted-foreground">
            This column is intentionally sample-only. It demonstrates the persistent iPad list role.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

function PocInspector({ onToggle }: { onToggle: () => void }): React.JSX.Element {
  return (
    <SafeAreaView
      className="flex-1 bg-muted/20"
      edges={{ bottom: true, right: true }}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-6 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inspector
          </Text>
          <Text className="text-2xl font-bold text-foreground">Companion</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            An optional trailing surface for context, actions, or metadata.
          </Text>
        </View>

        <View className="gap-4 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-primary/10">
              <PocGlyph size={20} symbol="▤" tone="primary" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold text-foreground">Inspector is visible</Text>
              <Text className="text-sm text-muted-foreground">iOS 26 native column</Text>
            </View>
          </View>
          <Separator />
          <InspectorRow label="Role" value="Companion" />
          <InspectorRow label="Placement" value="Trailing" />
          <InspectorRow label="Toggle" value="Supported" />
        </View>

        <Button onPress={onToggle} size="sm" variant="outline">
          <PocGlyph size={16} symbol="▤" tone="foreground" />
          <UiText>Hide inspector</UiText>
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}

function InspectorRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  )
}

function SurfaceLink({
  active,
  surface,
}: {
  active: boolean
  surface: PocSurface
}): React.JSX.Element {
  return (
    <Link href={surface.path} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={cn(
          'flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent',
          active && 'bg-accent',
        )}
      >
        <SurfaceIcon active={active} surface={surface.id} />
        <Text
          className={cn(
            'flex-1 font-medium',
            active ? 'text-accent-foreground' : 'text-foreground',
          )}
        >
          {surface.label}
        </Text>
        {active ? <View className="size-1.5 rounded-full bg-primary" /> : null}
      </Pressable>
    </Link>
  )
}

function SurfaceIcon({
  active,
  surface,
}: {
  active: boolean
  surface: PocSurfaceId
}): React.JSX.Element {
  const symbol =
    surface === 'files' ? '▤' : surface === 'changes' ? '⑂' : surface === 'review' ? '✓' : '>_'

  return <PocGlyph size={18} symbol={symbol} tone={active ? 'primary' : 'muted'} />
}
