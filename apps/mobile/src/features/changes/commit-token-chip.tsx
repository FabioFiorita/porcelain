import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Sheet } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { type TokenKind, tokenChipLabel, tokenOptionLabel, tokenPicker } from './commit-tokens'

/**
 * A `type` / `scope` token chip and the picker behind it.
 *
 * Deliberately NOT a `components/` primitive: it speaks conventional commits — a kind that is
 * one of two, values that come from what the repository already writes, and an "add" row that
 * exists because a new scope is a normal thing to invent while committing. A generic combobox
 * would have to be told all of that at every call site, and there is one call site.
 *
 * The value is DERIVED from the message text, so editing the message by hand keeps the chips in
 * sync; choosing one rewrites only the leading prefix.
 *
 * `testIDPrefix` is required rather than defaulted: the chip is shared, so a default would let
 * whichever surface forgot to pass one publish another surface's ids.
 */
export function CommitTokenChip({
  disabled,
  kind,
  onChange,
  options,
  testIDPrefix,
  value,
}: {
  disabled: boolean
  kind: TokenKind
  onChange: (value: string | null) => void
  options: readonly string[]
  /** The owning card's commit id stem, e.g. `porcelain-git-commit`. */
  testIDPrefix: string
  value: string | null
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const picker = tokenPicker(options, query)

  const choose = (next: string | null): void => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Pressable
        accessibilityLabel={`Commit ${kind}${value === null ? '' : `, ${value}`}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={cn(
          'h-9 flex-1 flex-row items-center justify-between gap-1 rounded-lg border border-border bg-background px-2.5 active:bg-accent',
          disabled && 'opacity-50',
        )}
        disabled={disabled}
        testID={`${testIDPrefix}-${kind}`}
        onPress={() => {
          setOpen(true)
        }}
      >
        <Text
          className={cn(
            'min-w-0 flex-1 font-mono text-xs',
            value === null ? 'text-muted-foreground' : 'text-foreground',
          )}
          numberOfLines={1}
        >
          {tokenChipLabel(kind, value)}
        </Text>
        <ChromeGlyph name="chevron" size={11} />
      </Pressable>

      {/* The list is as long as the repository's history of scopes, so the sheet is given a
          rest height rather than measuring content it would have to scroll anyway. */}
      <Sheet
        description="Values this repository already uses — or add a new one."
        open={open}
        scrollable
        title={kind === 'type' ? 'Commit type' : 'Commit scope'}
        onClose={() => {
          setOpen(false)
          setQuery('')
        }}
      >
        <View className="px-5">
          <Input
            accessibilityLabel={`Filter ${kind}s`}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`Add ${kind}…`}
            testID={`${testIDPrefix}-${kind}-input`}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        {/* surface-gutter-allow: these rows are inside a sheet, not a surface. The sheet's own
            gutter is 20pt (`px-5` on the title above) and the option rows add `px-3` of their
            own, so 8pt here is what lands the labels on the title's left edge. `SURFACE_GUTTER`
            is the phone screen's 16pt line and there is no screen in here to line up with. */}
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-0.5 px-2 pb-2"
          keyboardShouldPersistTaps="handled"
        >
          {value === null ? null : (
            <TokenOption
              label={`Clear ${kind}`}
              testID={`${testIDPrefix}-${kind}-clear`}
              onPress={() => {
                choose(null)
              }}
            />
          )}
          {picker.matches.map((option) => (
            <TokenOption
              key={option}
              label={tokenOptionLabel(kind, option)}
              mono
              selected={option === value}
              testID={`${testIDPrefix}-${kind}-${option}`}
              onPress={() => {
                choose(option)
              }}
            />
          ))}
          {picker.addition === null ? null : (
            <TokenOption
              label={`Add “${picker.addition}”`}
              testID={`${testIDPrefix}-${kind}-add`}
              onPress={() => {
                choose(picker.addition)
              }}
            />
          )}
          {picker.empty ? (
            <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
              No {kind}s yet.
            </Text>
          ) : null}
        </ScrollView>
      </Sheet>
    </>
  )
}

function TokenOption({
  label,
  mono = false,
  onPress,
  selected = false,
  testID,
}: {
  label: string
  mono?: boolean
  onPress: () => void
  selected?: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-11 flex-row items-center justify-between rounded-xl px-3 py-2 active:bg-accent',
        selected && 'bg-muted/70',
      )}
      testID={testID}
      onPress={onPress}
    >
      <Text className={cn('text-sm text-foreground', mono && 'font-mono text-xs')}>{label}</Text>
      {selected ? <ChromeGlyph name="check" size={14} tone="primary" /> : null}
    </Pressable>
  )
}
