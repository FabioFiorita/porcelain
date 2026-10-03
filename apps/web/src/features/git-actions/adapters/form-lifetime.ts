import { useEffect } from 'react';

export function useDraftCancellation(controllers: Set<AbortController>) {
  useEffect(
    () => () => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
    [controllers],
  );
}
