import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';
import { headerIcon } from '../../shared/icons/header-icon';
import type { ChromeButtonProps } from './chrome-button-props';

export function ChromeButton({ icon, label, onPress }: ChromeButtonProps) {
  return (
    <Host matchContents>
      <Button
        label={label}
        systemImage={headerIcon(icon)}
        onPress={onPress}
        modifiers={[
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          controlSize('large'),
          labelStyle('iconOnly'),
        ]}
      />
    </Host>
  );
}
