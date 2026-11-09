import type { KeyboardEvent } from 'react';

export function commentKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  waiting: boolean,
  dismiss?: () => void,
) {
  if (event.nativeEvent.isComposing || waiting) return;
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
  if (event.key === 'Escape' && dismiss) {
    event.stopPropagation();
    dismiss();
  }
}
