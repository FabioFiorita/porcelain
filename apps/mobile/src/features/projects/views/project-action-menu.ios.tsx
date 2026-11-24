import { Button } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { ProjectActionMenuProps } from './project-action-menu-props';

const images = {
  copy: 'document.on.clipboard',
  rename: 'pencil',
  remove: 'folder.badge.minus',
} as const;

export function ProjectActionMenu({ label, actions }: ProjectActionMenuProps) {
  return (
    <ContentMenu label={label} icon="more">
      {actions.map((action) => (
        <Button
          key={action.id}
          label={action.label}
          systemImage={images[action.id]}
          role={action.destructive ? 'destructive' : 'default'}
          modifiers={action.disabled ? [disabled(true)] : []}
          onPress={action.onPress}
        />
      ))}
    </ContentMenu>
  );
}
