import { platformApiLevel } from 'expo-device';
import { AccessibilityInfo } from 'react-native';
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';

const copyTitles = {
  brief: 'Copied brief',
  'worktree path': 'Copied worktree path',
};

export const clipboardNotice = Atom.make<string | null>(null);

export const showClipboardNotice = Atom.fn(
  (target: keyof typeof copyTitles, get) =>
    Effect.gen(function* () {
      if ((platformApiLevel ?? 0) >= 33) return;
      const title = copyTitles[target];
      get.set(clipboardNotice, title);
      AccessibilityInfo.announceForAccessibility(title);
      yield* Effect.sleep('5 seconds');
      get.set(clipboardNotice, null);
    }),
).pipe(Atom.keepAlive);
