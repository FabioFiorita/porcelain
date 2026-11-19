import { useState } from 'react';
import { requireNativeView } from 'expo';
import { View, type NativeSyntheticEvent } from 'react-native';
import { Spinner } from './spinner';
import { ErrorState } from './error-state';

const NativeImage = requireNativeView<{
  data: string;
  onLoad: (event: NativeSyntheticEvent<{ success: boolean }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'ImageSurface');
type ImageViewProps = { data: string; label: string; quiet?: boolean };
export function ImageView(props: ImageViewProps) {
  return <ImageContent key={props.data} {...props} />;
}
function ImageContent({ data, label, quiet = false }: ImageViewProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  return (
    <View className="flex-1 bg-background" accessibilityLabel={label}>
      {status === 'error' && !quiet ? (
        <ErrorState message="This image could not be decoded." />
      ) : (
        <NativeImage
          data={data}
          onLoad={(event) =>
            setStatus(event.nativeEvent.success ? 'ready' : 'error')
          }
          style={{ flex: 1 }}
        />
      )}
      {status === 'loading' && !quiet ? (
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <Spinner />
        </View>
      ) : null}
    </View>
  );
}
