import { toast } from '@/components/ui/toast';
import { reviewErrorMessage } from '../../query/review';

/**
 * Toast rule: confirm what the reviewer cannot see where they clicked (copies,
 * bulk marks, git results, background answers) and every failure. Changes that
 * are visible in place (one tick, resolve, reply) only speak up when they fail.
 */
export function notifySuccess(title: string, description?: string) {
  toast.add({ title, description, type: 'success' });
}

export function notifyFailure(title: string, error: unknown) {
  toast.add({ title, description: reviewErrorMessage(error), type: 'error' });
}

/** Run a mutation from a click; report failure as a toast instead of an unhandled rejection. */
export function reportFailure(promise: Promise<unknown>, title: string) {
  promise.catch((error: unknown) => notifyFailure(title, error));
}
