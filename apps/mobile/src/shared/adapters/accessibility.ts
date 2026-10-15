import { AccessibilityInfo } from 'react-native';
import { Atom } from 'effect/reactivity';

export const reducedMotion = Atom.make((get) => {
  let active = true;
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    (value) => get.setSelf(value),
  );
  void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
    if (active) get.setSelf(value);
  });
  get.addFinalizer(() => {
    active = false;
    subscription.remove();
  });
  return false;
});
