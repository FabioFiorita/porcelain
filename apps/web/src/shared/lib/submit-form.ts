import type { FormEvent } from 'react';

export function discardRejection(promise: Promise<unknown>) {
  void promise.catch(() => undefined);
}

export function submitForm(
  event: FormEvent<HTMLFormElement>,
  submit: () => Promise<unknown>,
) {
  event.preventDefault();
  discardRejection(submit());
}
