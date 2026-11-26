import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { AppState } from 'react-native';
import type { PageActivity } from '@porcelain/client/projects';

function screenActivity() {
  let focused = false;
  const listeners = new Set<() => void>();
  const port: PageActivity = {
    isActive: () => focused && AppState.currentState === 'active',
    subscribe: (changed) => {
      listeners.add(changed);
      const app = AppState.addEventListener('change', changed);
      return () => {
        listeners.delete(changed);
        app.remove();
      };
    },
  };
  return {
    port,
    focus: (value: boolean) => {
      focused = value;
      for (const changed of [...listeners]) changed();
    },
  };
}

export function useScreenActivity(): PageActivity {
  const [activity] = useState(screenActivity);
  useFocusEffect(() => {
    activity.focus(true);
    return () => activity.focus(false);
  });
  return activity.port;
}
