import type { SubmitEvent } from 'react';

export function discardRejection(promise: Promise<unknown>) {
  void promise.catch(() => undefined);
}

export function submitForm(
  event: SubmitEvent<HTMLFormElement>,
  submit: () => Promise<unknown>,
) {
  event.preventDefault();
  discardRejection(submit());
}
