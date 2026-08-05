import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { ShellModal, ShellModalScroll, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/** Section caption shared by the list groups and every companion card. */
export function PanelLabel({
  children,
  className,
}: {
  children: string
  className?: string
}): React.JSX.Element {
  return (
    <Text
      className={cn(
        'text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
        className,
      )}
    >
      {children}
    </Text>
  )
}

/** Icon-only control sized for touch — the header actions and row affordances. */
export function IconAction({
  accessibilityLabel,
  disabled = false,
  glyph,
  onPress,
  selected,
  testID,
  tone = 'muted',
}: {
  accessibilityLabel: string
  disabled?: boolean
  glyph: ChromeIconName
  onPress: () => void
  selected?: boolean
  testID: string
  tone?: IconTone
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      className={cn(
        'size-9 items-center justify-center rounded-lg active:bg-accent',
        disabled && 'opacity-40',
      )}
      disabled={disabled}
      hitSlop={4}
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={glyph} size={17} tone={tone} />
    </Pressable>
  )
}

/**
 * The result line under an action — a generated message, a staging write, a failed command.
 * Failures are never swallowed: every mutation in this tab reports here or on a card.
 */
export function StatusNote({
  failed,
  testID,
  text,
}: {
  failed: boolean
  testID?: string
  text: string
}): React.JSX.Element {
  return (
    <Text
      className={cn(
        'font-mono text-[11px] leading-4',
        failed ? 'text-destructive' : 'text-success',
      )}
      testID={testID}
    >
      {text}
    </Text>
  )
}

export function EmptyNote({
  body,
  testID,
  title,
}: {
  body: string
  testID: string
  title: string
}): React.JSX.Element {
  return (
    <View className="items-center gap-1 px-6 py-10" testID={testID}>
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="max-w-[16rem] text-center text-xs leading-5 text-muted-foreground">
        {body}
      </Text>
    </View>
  )
}

export function ErrorNote({
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

export type SheetAction = {
  id: string
  label: string
  glyph: ChromeIconName
  tone?: IconTone
  destructive?: boolean
  onPress: () => void
}

/**
 * The touch stand-in for the web row's right-click menu. A long press opens it, so the row's
 * tap target stays the one thing it should do — open the diff.
 */
export function ActionSheet({
  actions,
  onClose,
  open,
  subtitle,
  testID,
  title,
}: {
  actions: readonly SheetAction[]
  onClose: () => void
  open: boolean
  subtitle?: string
  testID: string
  title: string
}): React.JSX.Element {
  const { maxHeight, width } = useShellModalSize()
  return (
    <ShellModal bare hideHeader open={open} onClose={onClose} contentStyle={{ maxHeight, width }}>
      <View className="gap-1 border-b border-border px-5 pb-3 pr-12 pt-5" testID={testID}>
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text className="font-mono text-xs text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      <ShellModalScroll
        className="max-h-96"
        contentContainerClassName="gap-0.5 px-2 py-2"
        testID={`${testID}-actions`}
      >
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent"
            testID={`${testID}-${action.id}`}
            onPress={() => {
              // Close first: the action may open a second sheet (composer, confirm), and two
              // RN modals racing on the same frame leaves the second one invisible on iOS.
              onClose()
              action.onPress()
            }}
          >
            <ChromeGlyph
              name={action.glyph}
              size={17}
              tone={action.destructive === true ? 'destructive' : (action.tone ?? 'foreground')}
            />
            <Text
              className={cn(
                'min-w-0 flex-1 text-sm font-medium',
                action.destructive === true ? 'text-destructive' : 'text-foreground',
              )}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ShellModalScroll>
    </ShellModal>
  )
}

/** Confirmation for the writes that cannot be undone (discard, clear closed comments). */
export function ConfirmDialog({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  testID,
  title,
}: {
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  testID: string
  title: string
}): React.JSX.Element {
  const { width } = useShellModalSize()
  return (
    <ShellModal open={open} onClose={onCancel} title={title} contentStyle={{ width }}>
      <View className="gap-4" testID={testID}>
        <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
        <View className="flex-row justify-end gap-2">
          <Button testID={`${testID}-cancel`} variant="ghost" onPress={onCancel}>
            <UiText>Cancel</UiText>
          </Button>
          <Button testID={`${testID}-confirm`} variant="destructive" onPress={onConfirm}>
            <UiText>{confirmLabel}</UiText>
          </Button>
        </View>
      </View>
    </ShellModal>
  )
}
