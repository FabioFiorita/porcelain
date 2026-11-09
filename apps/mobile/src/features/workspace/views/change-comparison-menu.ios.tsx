import { Toggle } from '@expo/ui/swift-ui';
import { ContentMenu } from '../../../components/ui/content-menu.ios';
import type { ChangeComparisonMenuProps } from './change-comparison-menu-props';

export function ChangeComparisonMenu({
  current,
  scopes,
  onScope,
}: ChangeComparisonMenuProps) {
  return (
    <ContentMenu label={`Comparison: ${current ?? 'None'}`} size="sm">
      {scopes.map((scope) => (
        <Toggle
          key={scope}
          label={scope}
          isOn={scope === current}
          onIsOnChange={() => onScope(scope)}
        />
      ))}
    </ContentMenu>
  );
}
