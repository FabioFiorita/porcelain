import { useRouter } from 'expo-router';
import { lazy, Suspense } from 'react';

const ComponentLibrary = __DEV__
  ? lazy(() =>
      import('../../features/development-catalog').then((catalog) => ({
        default: catalog.ComponentLibrary,
      })),
    )
  : () => null;

export default function ComponentLibraryRoute() {
  const router = useRouter();
  return (
    <Suspense fallback={null}>
      <ComponentLibrary
        onOpenText={() => router.push('/component-text')}
        onOpenButton={() => router.push('/component-button')}
        onOpenPrimitive={(name) =>
          router.push({ pathname: '/component-preview', params: { name } })
        }
      />
    </Suspense>
  );
}
