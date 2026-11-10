import {
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useKeyCommands } from '../shared/application/key-commands';
import { navigationExits } from '../shared/rules/navigation-exits';

export function useAppKeyCommands() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const root = useRootNavigationState();
  const exits = navigationExits(root);
  useKeyCommands([
    { binding: 'settings', run: () => router.navigate('/settings') },
    { binding: 'shortcuts', run: () => router.navigate('/keyboard-shortcuts') },
    ...(exits.back
      ? [
          { binding: 'back' as const, run: () => router.back() },
          { binding: 'backEscape' as const, run: () => router.back() },
        ]
      : []),
    ...(exits.close
      ? [
          {
            binding: 'close' as const,
            run: () =>
              navigation.dispatch({
                type: 'POP',
                payload: { count: 1 },
                target: root.key,
              }),
          },
        ]
      : []),
  ]);
}
