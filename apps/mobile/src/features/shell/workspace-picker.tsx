import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { cn } from '@/lib/utils'

/**
 * The three workspace sheets' shared row vocabulary.
 *
 * Project, branch, and worktree pick different things but present the same shape — a titled
 * group of selectable rows, an empty note, an error note — so the shape lives here once rather
 * than being re-typed in each sheet with slightly different spacing.
 */

export type PickerBodyProps = {
  open: boolean
}

/**
 * A picker that can create. `creating` lives in the sheet host, not here: the create form is a
 * mode of the SAME `ShellModal` (its title swaps with it), because stacking a second native
 * modal on the picker is what broke iOS keyboard avoidance for these two forms.
 */
export type CreatingPickerBodyProps = PickerBodyProps & {
  creating: boolean
  onCreatingChange: (creating: boolean) => void
}

export function PickerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
      <View className="gap-1">{children}</View>
    </View>
  )
}

export function WorkspaceRow({
  accessibilityLabel,
  detail,
  disabled = false,
  glyph,
  label,
  onPress,
  selected = false,
  testID,
}: {
  accessibilityLabel?: string
  detail?: string
  disabled?: boolean
  glyph?: 'branch' | 'folder'
  label: string
  onPress: () => void
  selected?: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      className={cn(
        'min-h-12 flex-row items-center gap-3 rounded-xl border border-transparent px-3 py-2 active:bg-accent',
        selected && 'border-border bg-muted/70',
        disabled && 'opacity-50',
      )}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
    >
      {glyph ? <ChromeGlyph name={glyph} size={16} tone={selected ? 'primary' : 'muted'} /> : null}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <ChromeGlyph name="check" size={15} tone="primary" /> : null}
    </Pressable>
  )
}

export function EmptyPickerState({
  body,
  testID,
  title,
}: {
  body: string
  testID: string
  title: string
}): React.JSX.Element {
  return (
    <View
      className="gap-1 rounded-xl border border-dashed border-border bg-muted/30 p-3"
      testID={testID}
    >
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="text-xs leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}

export function ErrorState({
  message,
  testID,
}: {
  message: string
  testID: string
}): React.JSX.Element {
  return (
    <View className="rounded-xl border border-destructive/40 bg-destructive/5 p-3" testID={testID}>
      <Text className="text-xs leading-5 text-destructive">{message}</Text>
    </View>
  )
}
