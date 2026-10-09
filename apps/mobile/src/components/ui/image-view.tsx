import { useState } from 'react';
import { requireNativeView } from 'expo';
import { View, type NativeSyntheticEvent } from 'react-native';
import { Loading } from './loading';
import { ErrorState } from './error-state';

const NativeImage = requireNativeView<{
  data: string;
  onLoad: (event: NativeSyntheticEvent<{ success: boolean }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'ImageSurface');
export function ImageView({ data, label }: { data: string; label: string }) {
  return <ImageContent key={data} data={data} label={label} />;
}
function ImageContent({ data, label }: { data: string; label: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  return (
    <View className="flex-1 bg-background" accessibilityLabel={label}>
      {status === 'error' ? (
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
      {status === 'loading' ? (
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <Loading label="Loading image…" />
        </View>
      ) : null}
    </View>
  );
}
