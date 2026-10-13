import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  labelStyle,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import { Box } from '../components/ui/box';
import { Text } from '../components/ui/text';
import type { LeadingToolbarProps } from '../components/ui/leading-toolbar';

export function PaneHeading({
  title,
  sidebar,
}: {
  title: string;
  sidebar: LeadingToolbarProps['sidebar'];
}) {
  return (
    <Box
      className="flex-row items-center justify-between"
      paddingX={4}
      paddingY={4}
    >
      <Text variant="heading">{title}</Text>
      {sidebar ? (
        <Host matchContents>
          <Button
            label={sidebar.visible ? 'Hide sidebar' : 'Show sidebar'}
            systemImage="sidebar.left"
            onPress={sidebar.toggle}
            modifiers={[
              labelStyle('iconOnly'),
              buttonStyle('bordered'),
              foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            ]}
          />
        </Host>
      ) : null}
    </Box>
  );
}
