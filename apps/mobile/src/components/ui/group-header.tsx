import { ButtonSurface } from './button-surface';
import { Icon } from './icon';
import { Text } from './text';

export function GroupHeader({
  label,
  count,
  expanded,
  onPress,
}: {
  label: string;
  count?: number | undefined;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <ButtonSurface
      variant="ghost"
      size="sm"
      expanded={expanded}
      className="justify-start"
      accessibilityLabel={`${label}${count === undefined ? '' : ` · ${count}`}, ${expanded ? 'expanded' : 'collapsed'}`}
      onPress={onPress}
    >
      <Icon name={expanded ? 'down' : 'chevron'} tone="muted" size="small" />
      <Text variant="subheading" tone="muted" className="flex-1">
        {label}
      </Text>
      {count === undefined ? null : (
        <Text variant="subheading" tone="muted">
          {count}
        </Text>
      )}
    </ButtonSurface>
  );
}
