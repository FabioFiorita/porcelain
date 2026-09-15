import { toast } from '@/components/ui/toast';
import { reviewErrorMessage } from '../../query/review';

/** Confirm an action the reviewer cannot see where they clicked. */
export function notifySuccess(title: string, description?: string) {
  toast.add({ title, description, type: 'success' });
}

/** Report a failure that is not already visible in place. */
export function notifyFailure(title: string, error: unknown) {
  toast.add({
    title,
    description: reviewErrorMessage(error),
    type: 'error',
  });
}
