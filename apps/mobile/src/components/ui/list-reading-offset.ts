import { useState } from 'react';
import { PixelRatio } from 'react-native';
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

export function useListReadingOffset(
  offset: number,
  ready: boolean,
  onOffset?: (offset: number) => void,
) {
  const [initialOffset] = useState(offset);
  const [restored, setRestored] = useState(offset === 0);
  const [contentHeight, setContentHeight] = useState(0);
  return {
    ref: (list: Pick<FlatList<unknown>, 'scrollToOffset'> | null) => {
      if (!list || !ready || restored || contentHeight === 0) return;
      list.scrollToOffset({ offset: initialOffset, animated: false });
    },
    onContentSizeChange: (_: number, height: number) => {
      if (ready && !restored) setContentHeight(height);
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const current = event.nativeEvent.contentOffset.y;
      if (
        restored ||
        PixelRatio.roundToNearestPixel(current) ===
          PixelRatio.roundToNearestPixel(initialOffset)
      ) {
        if (!restored) setRestored(true);
        onOffset?.(current);
      }
    },
    onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setRestored(true);
      onOffset?.(event.nativeEvent.contentOffset.y);
    },
    scrollEventThrottle: 100,
  };
}
