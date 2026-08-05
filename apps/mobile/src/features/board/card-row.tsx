import { Pressable, Text } from 'react-native'

import type { BoardCard } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { STATUS_LABEL } from './use-board'

/**
 * One card, in every board panel: its title, a hint of the body, and whether it is the card
 * the Focus companion is showing.
 *
 * A card is an index entry, not an editor — the tap focuses it and the Focus rail owns edit,
 * move, and delete, so the same actions cannot drift into three different menus.
 */
export function CardRow({
  card,
  onPress,
  selected,
  testID,
}: {
  card: BoardCard
  onPress: () => void
  selected: boolean
  testID: string
}): React.JSX.Element {
  const body = card.body?.trim() ?? ''

  return (
    <Pressable
      accessibilityLabel={`${card.title}, ${STATUS_LABEL[card.status]}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'gap-1 rounded-2xl border border-border bg-card p-2.5 active:bg-accent',
        selected && 'border-primary bg-muted/70',
      )}
      testID={testID}
      onPress={onPress}
    >
      <Text className="text-[13px] font-medium leading-5 text-foreground" numberOfLines={2}>
        {card.title}
      </Text>
      {body === '' ? null : (
        <Text className="text-[11px] leading-4 text-muted-foreground" numberOfLines={2}>
          {body}
        </Text>
      )}
    </Pressable>
  )
}
