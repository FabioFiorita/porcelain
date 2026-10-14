import { Button } from './button';
import type { ChromeButtonProps } from './chrome-button-props';

export function ChromeButton({ label, onPress }: ChromeButtonProps) {
  return <Button label={label} variant="ghost" onPress={onPress} />;
}
