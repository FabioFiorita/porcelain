import { Button, Host, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers'

import { useAccentColor } from '@/theme/colors'

/**
 * A locked or empty surface with the one action that unlocks it. Distinct from
 * `PlaceholderScreen`, which describes a tab that is not built yet — this one describes a tab
 * that would work if something were connected.
 */
export function EmptyState({
  action,
  body,
  onAction,
  secondaryAction,
  onSecondaryAction,
  title,
}: {
  action: string
  body: string
  onAction: () => void
  secondaryAction?: string
  onSecondaryAction?: () => void
  title: string
}): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
      <VStack modifiers={[padding({ all: 24 })]} spacing={12}>
        <Spacer />
        <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{title}</Text>
        <Text
          modifiers={[
            font({ textStyle: 'subheadline' }),
            foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
            multilineTextAlignment('center'),
          ]}
        >
          {body}
        </Text>
        <Spacer modifiers={[frame({ height: 8 })]} />
        <Button label={action} modifiers={[buttonStyle('glassProminent')]} onPress={onAction} />
        {secondaryAction === undefined || onSecondaryAction === undefined ? null : (
          <Button
            label={secondaryAction}
            modifiers={[buttonStyle('plain')]}
            onPress={onSecondaryAction}
          />
        )}
        <Spacer />
      </VStack>
    </Host>
  )
}
