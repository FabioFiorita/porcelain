import { useEffect, useRef } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { NativeSheet } from '@/components/native/native-sheet'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { Input } from '@/components/ui/input'
import { useShellLeading, useShellTrailing, useTopChrome } from '@/features/shell/window-chrome'
import { cn } from '@/lib/utils'

/**
 * Shared chrome for daemon-backed mobile surfaces: section captions, icon actions, result,
 * empty, and error notes, plus the touch stand-ins for desktop menus and confirmation dialogs.
 * Changes, History, Files, diffs, and Terminal all use this vocabulary.
 */

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
        'text-3xs font-semibold uppercase tracking-widest text-muted-foreground',
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
 * The bar at the top of EVERY screen: back, what you are looking at, and its actions.
 *
 * One component because there were five hand-rolled copies of it — the file viewer, the diff,
 * a commit, the continuous read, and a terminal session — and they had drifted onto their own
 * 8pt gutter while every surface behind them moved to 16pt. Backing out of a file therefore
 * shifted the whole screen sideways.
 *
 * It is now the app's only header. The tab roots and the pushed surfaces wore
 * `UINavigationBar` — large titles, system back chevron, a scroll edge effect — and that bar
 * cannot be themed: it draws the system's type, its blur and its tint over a product whose
 * every other pixel comes from `@porcelain/ui` tokens. The web client's header is a 48pt band
 * with a hairline under it, a small semibold title and a cluster of quiet glyph buttons, and
 * that is what this draws, on phone and in every tablet column.
 *
 * The icon clusters hang half a button outside the gutter: a 36pt box around a 17pt glyph puts
 * the mark 9pt inside its own edge, and it is the mark the eye lines up.
 */
export function ScreenHeader({
  actions,
  back,
  mono = false,
  subtitle,
  /** Head-truncate the subtitle — the tail of a path is what identifies it. */
  subtitleFromEnd = false,
  title,
  testID,
}: {
  actions?: React.ReactNode
  back?: { accessibilityLabel: string; testID: string; onPress: () => void }
  mono?: boolean
  subtitle?: string
  subtitleFromEnd?: boolean
  title: string
  testID?: string
}): React.JSX.Element {
  // Read, never passed: the shell knows whether this screen is at the top of the window, and
  // threading the number was how the old bars ended up disagreeing with each other.
  const topInset = useTopChrome()
  // The shell's own control — the tablet's panel toggle — sits ahead of the back chevron, the
  // same order the web client's viewer header puts them in.
  const leading = useShellLeading()
  const trailing = useShellTrailing()

  return (
    <View
      className={cn(SURFACE_GUTTER, 'flex-row items-center gap-1 border-b border-border py-1.5')}
      /* nativewind-allow-style: the bar clears the live status-bar inset. */
      style={{ paddingTop: topInset + 6 }}
      testID={testID}
    >
      {leading === null ? null : <View className="-ml-2 flex-row items-center">{leading}</View>}
      {back === undefined ? null : (
        <View className={cn(leading === null && '-ml-2')}>
          <IconAction
            accessibilityLabel={back.accessibilityLabel}
            glyph="chevronLeft"
            testID={back.testID}
            tone="foreground"
            onPress={back.onPress}
          />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'text-sm font-semibold text-foreground',
            mono && 'font-mono text-xs font-medium',
          )}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text
            className="font-mono text-3xs text-muted-foreground"
            ellipsizeMode={subtitleFromEnd ? 'head' : 'tail'}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {actions === undefined && trailing === null ? null : (
        <View className="-mr-2 flex-row items-center">
          {actions}
          {trailing}
        </View>
      )}
    </View>
  )
}

/**
 * A filter field in a surface's toolbar band.
 *
 * The boards used to declare `headerSearchBarOptions` and get `UISearchController` — a system
 * field that appears under a large title, in the system's type, with the system's cancel button
 * and its own show/hide-on-scroll behaviour that nothing in this app could match. The web client
 * puts a bordered field with a leading glyph in the panel itself, and so does this.
 */
export function SearchField({
  onChangeText,
  placeholder,
  testID,
  value,
}: {
  onChangeText: (value: string) => void
  placeholder: string
  testID: string
  value: string
}): React.JSX.Element {
  return (
    <View className="relative justify-center">
      <View className="absolute left-3 z-10" pointerEvents="none">
        <ChromeGlyph name="search" size={14} tone="muted" />
      </View>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        className="h-9 pl-8 text-sm"
        clearButtonMode="while-editing"
        placeholder={placeholder}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
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
      className={cn('font-mono text-2xs leading-4', failed ? 'text-destructive' : 'text-success')}
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
 *
 * The sheet sizes itself to its actions rather than to a fraction of the window. The version
 * this replaces capped its panel at 78% of the window height and scrolled inside it, because a
 * centred `Modal` has to be given a size before it knows what is in it; a native sheet measures
 * its content, and an action list is three or four rows.
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
  return (
    <NativeSheet open={open} onClose={onClose}>
      <View className="gap-1 border-b border-border px-5 pb-3" testID={testID}>
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text className="font-mono text-xs text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      <View className="gap-0.5 px-2" testID={`${testID}-actions`}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent"
            testID={`${testID}-${action.id}`}
            onPress={() => {
              // Close first: the action may open a second sheet (composer, confirm), and a
              // native sheet cannot present another one while it is still on screen.
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
      </View>
    </NativeSheet>
  )
}

/**
 * Confirmation for the writes that cannot be undone (discard, clear closed comments).
 *
 * A `UIAlertController` / Material `AlertDialog`, not a sheet. A confirm is the one dialog the
 * platform already owns outright: it renders above everything else including a presented sheet,
 * it dismisses on the Android hardware back button, VoiceOver and TalkBack announce it as an
 * alert, and iOS paints the destructive verb red from the button role. The version this
 * replaces drew two `Button`s in a rounded `View` inside an RN `Modal` and got none of that.
 *
 * Nothing is rendered into the tree, so this component has no `testID`: an alert is not a view.
 */
export function ConfirmDialog({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  body: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
}): null {
  // The alert is fired once, when `open` turns true. The handlers ride a ref so a parent that
  // rebuilds them every render cannot re-present an alert that is already on screen.
  const handlers = useRef({ onCancel, onConfirm })
  handlers.current = { onCancel, onConfirm }

  useEffect(() => {
    if (!open) return
    Alert.alert(
      title,
      body,
      [
        {
          onPress: () => {
            handlers.current.onCancel()
          },
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => {
            handlers.current.onConfirm()
          },
          style: 'destructive',
          text: confirmLabel,
        },
      ],
      {
        cancelable: true,
        // Android dismisses on a tap outside or the back button without choosing an action;
        // the owner still has to learn the dialog is gone or its `open` flag stays true.
        onDismiss: () => {
          handlers.current.onCancel()
        },
      },
    )
  }, [body, confirmLabel, open, title])

  return null
}
