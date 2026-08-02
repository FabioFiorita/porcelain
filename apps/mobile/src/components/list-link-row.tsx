import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, contentShape, font, frame, shapes } from '@expo/ui/swift-ui/modifiers'

import { secondary } from '@/theme/modifiers'

type LinkIcon =
  | 'chevron.right'
  | 'desktopcomputer'
  | 'folder'
  | 'laptopcomputer'
  | 'shippingbox'
  | 'terminal'
  | 'text.alignleft'
  | 'checkmark.seal'

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
}: {
  detail?: string
  icon?: Exclude<LinkIcon, 'chevron.right'>
  iconColor?: string
  label: string
  onPress: () => void
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
        {icon === undefined ? null : <Image color={iconColor} size={18} systemName={icon} />}
        <VStack alignment="leading" spacing={2}>
          <Text>{label}</Text>
          {detail === undefined ? null : (
            <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{detail}</Text>
          )}
        </VStack>
        <Spacer />
        <Image modifiers={[secondary]} size={12} systemName="chevron.right" />
      </HStack>
    </Button>
  )
}
