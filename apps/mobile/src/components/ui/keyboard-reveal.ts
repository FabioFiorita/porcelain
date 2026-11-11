import { createContext, useContext, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  type EmitterSubscription,
  type ScrollView,
  type View,
} from 'react-native';

type Scroller = ComponentRef<typeof ScrollView>;
type Field = ComponentRef<typeof View>;

const KEYBOARD_MARGIN = 12;

const KeyboardRevealScroller = createContext<Scroller | null>(null);

export const KeyboardRevealScope = KeyboardRevealScroller.Provider;

function reveal(scroller: Scroller, field: Field, keyboardTop: number) {
  const content = scroller.getInnerViewRef();
  if (!content) return;
  field.measureInWindow((_, top, __, height) => {
    const hidden = top + height + KEYBOARD_MARGIN - keyboardTop;
    if (hidden <= 0) return;
    scroller.measureInWindow((___, frameTop) =>
      content.measureInWindow((____, contentTop) =>
        scroller.scrollTo({
          y: frameTop - contentTop + hidden,
          animated: true,
        }),
      ),
    );
  });
}

function keyboardReveal() {
  let field: Field | null = null;
  let waiting: EmitterSubscription | undefined;
  const stop = () => {
    waiting?.remove();
    waiting = undefined;
  };
  return {
    attach: (node: Field | null) => {
      field = node;
    },
    stop,
    start: (scroller: Scroller | null) => {
      stop();
      const target = field;
      if (!scroller || !target) return;
      const shown = Keyboard.metrics();
      if (Keyboard.isVisible() && shown) {
        reveal(scroller, target, shown.screenY);
        return;
      }
      waiting = Keyboard.addListener('keyboardDidShow', (event) => {
        stop();
        reveal(scroller, target, event.endCoordinates.screenY);
      });
    },
  };
}

export function useKeyboardReveal() {
  const scroller = useContext(KeyboardRevealScroller);
  const [field] = useState(keyboardReveal);
  return {
    field: { ref: field.attach, collapsable: false },
    input: { onFocus: () => field.start(scroller), onBlur: field.stop },
  };
}
