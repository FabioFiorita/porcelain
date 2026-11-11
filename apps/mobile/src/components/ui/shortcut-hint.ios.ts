import {
  keyBindings,
  keyLabel,
  type KeyBindingName,
} from '../../shared/rules/key-commands';

export function shortcutHint(binding: KeyBindingName): string | undefined {
  return keyLabel(keyBindings[binding]);
}
