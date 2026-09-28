import { Debouncer } from '@tanstack/pacer';
import { REVIEW_DIAGRAM_FIT_WAIT_MS } from '@/config/limits';

export function diagramFitScheduler(fit: () => void) {
  return new Debouncer(fit, { wait: REVIEW_DIAGRAM_FIT_WAIT_MS });
}
