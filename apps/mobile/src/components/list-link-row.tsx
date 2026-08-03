import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  font,
  frame,
  lineLimit,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import type { ReactNode } from 'react'

import { secondary } from '@/theme/modifiers'

/** SF Symbol names used as leading icons on list rows. Keep this open enough for shell chrome. */
type LinkIcon = string

/**
 * A list row that navigates somewhere, without making the destination look like a web link.
 * `buttonStyle('plain')` removes SwiftUI's default blue tint; `contentShape` keeps the whole
 * row—including the empty space between the copy and chevron—inside the hit target.
 */
export function ListLinkRow({
  detail,
  icon,
  iconColor,
  label,
  onPress,
  trailing,
}: {
  detail?: string
  icon?: Exclude<LinkIcon, 'chevron.right'>
  iconColor?: string
  label: string
  onPress: () => void
  trailing?: ReactNode
}): React.JSX.Element {
  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
      onPress={onPress}
    >
      <HStack
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
        spacing={12}
      >
        {icon === undefined ? null : (
          <Image
            color={iconColor}
            size={18}
            // SF Symbols typing is the Apple catalog; shell icons are valid names at runtime.
            systemName={icon as 'folder'}
          />
        )}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[lineLimit(1)]}>{label}</Text>
          {detail === undefined ? null : (
            <Text modifiers={[font({ textStyle: 'footnote' }), secondary, lineLimit(1)]}>
              {detail}
            </Text>
          )}
        </VStack>
        <Spacer />
        {trailing}
        <Image modifiers={[secondary]} size={12} systemName="chevron.right" />
      </HStack>
    </Button>
  )
}
