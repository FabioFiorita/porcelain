import { requireNativeView } from 'expo';
import { useWindowDimensions, type NativeSyntheticEvent } from 'react-native';
import { externalLink } from '@porcelain/client/links/rules';

const NativeHtml = requireNativeView<{
  html: string;
  textScale: number;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  onError: (event: NativeSyntheticEvent<{ message: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'HtmlSurface');

export function HtmlSurface({
  html,
  onLink,
  onError,
}: {
  html: string;
  onLink: ((url: string) => void) | undefined;
  onError: (message: string) => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <NativeHtml
      html={html}
      textScale={fontScale}
      onLink={(event) => {
        if (externalLink(event.nativeEvent.url))
          onLink?.(event.nativeEvent.url);
      }}
      onError={(event) => onError(event.nativeEvent.message)}
      style={{ flex: 1 }}
    />
  );
}
