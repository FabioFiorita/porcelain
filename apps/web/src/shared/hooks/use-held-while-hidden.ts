import { useState } from 'react';

export function useHeldWhileHidden<T>(value: T, hidden: boolean): T {
  const [held, setHeld] = useState(value);
  if (!hidden && held !== value) setHeld(value);
  return hidden ? held : value;
}
