import { useEffect, useState } from 'react';
import {
  type ReviewGuide,
  selectedGuideStep,
} from '../../domain/guided-review';

/** Store only a stable step ID, never source, credentials or review approval. */
function readPosition(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value && value.length <= 36 ? value : null;
  } catch {
    return null;
  }
}

export function useGuidePosition(key: string, guide: ReviewGuide) {
  const [saved, setSaved] = useState(() => ({ key, id: readPosition(key) }));
  if (saved.key !== key) setSaved({ key, id: readPosition(key) });
  const currentId = saved.key === key ? saved.id : readPosition(key);
  const step = selectedGuideStep(guide, currentId);
  const stepId = step?.id;
  useEffect(() => {
    if (!stepId) return;
    try {
      localStorage.setItem(key, stepId);
    } catch {
      // Review remains usable when storage is unavailable or full.
    }
  }, [key, stepId]);
  return {
    step,
    select: (id: string) => setSaved({ key, id }),
  };
}
