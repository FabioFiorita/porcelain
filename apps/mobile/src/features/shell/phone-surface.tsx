import { useIsFocused } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { PANEL_CARD } from '@/components/surface-layout'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import {
  COMPANION,
  LIST_ITEMS,
  type ListItem,
  type SurfaceId,
  surfaceById,
  VIEWER_PLACEHOLDERS,
} from './mock-data'
import { PhoneHeader } from './phone-header'
import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import type { DualTabSlot } from './tab-faces'
import { useTabFaces } from './tab-faces'
import { useTabRootFocusRegistration } from './tab-root-focus'

/**
 * Phone tab body for a dual-face slot or a fixed surface (Terminal).
 * Title + list + selected preview — mock outer layer only.
 */
export function PhoneSurface({
  slot,
  surface,
}: {
  /** Dual slot for re-tap registration; omit for fixed surfaces (terminal). */
  slot?: DualTabSlot
  /** Primary surface when not dual-face, or when face is primary. */
  surface: SurfaceId
}): React.JSX.Element {
  if (slot !== undefined) {
    return <DualFacePhoneSurface slot={slot} primary={surface} />
  }
  return <PhoneSurfaceBody surfaceId={surface} />
}

function DualFacePhoneSurface({
  slot,
  primary,
}: {
  slot: DualTabSlot
  primary: SurfaceId
}): React.JSX.Element {
  useTabRootFocusRegistration(slot)
  const face = useTabFaces((state) => {
    if (slot === 'files') return state.files
    if (slot === 'changes') return state.changes
    return state.review
  })

  const surfaceId: SurfaceId =
    slot === 'files'
      ? face === 'search'
        ? 'search'
        : primary
      : slot === 'changes'
        ? face === 'history'
          ? 'history'
          : primary
        : face === 'board'
          ? 'board'
          : primary

  return <PhoneSurfaceBody surfaceId={surfaceId} />
}

function PhoneSurfaceBody({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const focused = useIsFocused()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const surface = surfaceById(surfaceId)
  const items = LIST_ITEMS[surfaceId]
  const selectedId = useShellStore((state) => state.selectedIds[surfaceId])
  const selectItem = useShellStore((state) => state.selectItem)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const placeholder = VIEWER_PLACEHOLDERS[surface.viewerKind]
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (focused) {
      setActiveSurface(surfaceId)
    }
  }, [focused, setActiveSurface, surfaceId])

  // A real surface owns its whole tab body — header, list, and detail view. The mock body
  // below stays for the tabs that have not landed yet.
  const slots = surfaceSlots(surfaceId)
  if (slots !== undefined) return <slots.phone />

  const query = searchQuery.trim()
  const filtered =
    surfaceId === 'search' && query !== ''
      ? items.filter(
          (item) =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.detail.toLowerCase().includes(query.toLowerCase()),
        )
      : items

  return (
    <View className="flex-1 bg-background" testID={`porcelain-phone-surface-${surfaceId}`}>
      <PhoneHeader companionSurface={surfaceId} title={surface.label} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm leading-5 text-muted-foreground">{surface.listHint}</Text>

        {surfaceId === 'search' ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
            <ChromeGlyph name="search" size={16} />
            <Input
              className="native:h-11 flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
              onChangeText={setSearchQuery}
              placeholder="Search the workspace…"
              returnKeyType="search"
              testID="porcelain-phone-search-input"
              value={searchQuery}
            />
          </View>
        ) : null}

        <View className="gap-1">
          <Text className="px-1 text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
            {surface.listTitle}
          </Text>
          {filtered.map((item) => (
            <PhoneListRow
              key={item.id}
              item={item}
              selected={item.id === selected?.id}
              onPress={() => {
                selectItem(surfaceId, item.id)
              }}
            />
          ))}
          {filtered.length === 0 ? (
            <Text className="px-1 py-6 text-center text-sm text-muted-foreground">
              No results{query ? ` for “${query}”` : ''}.
            </Text>
          ) : null}
        </View>

        <Separator />

        <View className="gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
            Viewer · {surface.label}
          </Text>
          <Text className="text-lg font-bold text-foreground">
            {selected?.label ?? placeholder.title}
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {selected?.detail ?? placeholder.body}
          </Text>
          <View className="flex-row flex-wrap gap-2 pt-1">
            <Badge variant="secondary">
              <UiText>Mock shell</UiText>
            </Badge>
            <Badge variant="outline">
              <UiText>{surface.viewerKind}</UiText>
            </Badge>
          </View>
        </View>

        <View className={cn('gap-2 p-4', PANEL_CARD)}>
          <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
            Companion preview
          </Text>
          {COMPANION[surfaceId].slice(0, 1).map((section) => (
            <View key={section.id} className="gap-1.5">
              {section.rows.slice(0, 3).map((row) => (
                <View key={row.id} className="gap-0.5">
                  <Text className="text-sm font-medium text-foreground">{row.label}</Text>
                  {row.detail ? (
                    <Text className="text-xs text-muted-foreground">{row.detail}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          <Text className="text-xs text-muted-foreground">
            Full companion opens from the bolt — same content as the tablet inspector.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function PhoneListRow({
  item,
  selected,
  onPress,
}: {
  item: ListItem
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 active:bg-accent',
        selected && 'border-border bg-muted/70',
      )}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-medium text-foreground" numberOfLines={1}>
          {item.label}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {item.detail}
        </Text>
      </View>
      {item.badge ? (
        <Badge variant="outline">
          <UiText>{item.badge}</UiText>
        </Badge>
      ) : null}
      {item.state === 'attention' && !item.badge ? (
        <View className="size-2 rounded-full bg-primary" />
      ) : null}
    </Pressable>
  )
}
