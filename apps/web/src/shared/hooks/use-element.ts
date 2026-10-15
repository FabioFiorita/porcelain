import { useState, type RefCallback } from 'react';

export type ElementTarget<A extends Element> = {
  readonly element: A | null;
  readonly attach: RefCallback<A>;
};

export function useElement<A extends Element>(): ElementTarget<A> {
  const [element, setElement] = useState<A | null>(null);
  return { element, attach: setElement };
}
