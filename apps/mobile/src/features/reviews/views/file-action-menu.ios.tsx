import { Button } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { FileActionMenuProps } from './file-action-menu-props';

const images = {
  diff: 'plus.forwardslash.minus',
  files: 'folder',
  history: 'clock.arrow.circlepath',
} as const;

export function FileActionMenu({ label, actions }: FileActionMenuProps) {
  return (
    <ContentMenu label={label} icon="more" size="sm">
      {actions.map((action) => (
        <Button
          key={action.id}
          label={action.label}
          systemImage={images[action.id]}
          onPress={action.onPress}
        />
      ))}
    </ContentMenu>
  );
}
