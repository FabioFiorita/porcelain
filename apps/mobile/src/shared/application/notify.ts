import { platformApiLevel } from 'expo-device';
import { AccessibilityInfo, Keyboard } from 'react-native';
import { Atom } from 'effect/reactivity';
import { notifier } from './notice';

export const notify = notifier({
  platformShowsCopy: (platformApiLevel ?? 0) >= 33,
  announce: (title) => AccessibilityInfo.announceForAccessibility(title),
});

export const keyboardTop = Atom.make<number | undefined>((get) => {
  const shown = Keyboard.addListener('keyboardDidShow', (event) =>
    get.setSelf(event.endCoordinates.screenY),
  );
  const hidden = Keyboard.addListener('keyboardDidHide', () =>
    get.setSelf(undefined),
  );
  get.addFinalizer(() => {
    shown.remove();
    hidden.remove();
  });
  return Keyboard.isVisible() ? Keyboard.metrics()?.screenY : undefined;
});
