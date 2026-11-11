import { useState, type ComponentRef } from 'react';
import {
  Keyboard,
  type EventSubscription,
  type ScrollView,
  type View,
} from 'react-native';

export type KeyboardScroller = ComponentRef<typeof ScrollView> | null;
type Scroller = NonNullable<KeyboardScroller>;
type Field = ComponentRef<typeof View>;

const KEYBOARD_MARGIN = 12;

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
  let waiting: EventSubscription | undefined;
  const stop = () => {
    waiting?.remove();
    waiting = undefined;
  };
  return {
    attach: (node: Field | null) => {
      field = node;
    },
    stop,
    start: (scroller: KeyboardScroller) => {
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

export function useKeyboardReveal(scroller: KeyboardScroller) {
  const [field] = useState(keyboardReveal);
  return {
    field: { ref: field.attach, collapsable: false },
    input: { onFocus: () => field.start(scroller), onBlur: field.stop },
  };
}
