import { useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

const PrimitivePreview = __DEV__
  ? lazy(() =>
      import('../../features/development-catalog').then((catalog) => ({
        default: catalog.PrimitivePreview,
      })),
    )
  : () => null;
export default function ComponentPreviewRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return (
    <Suspense fallback={null}>
      <PrimitivePreview name={name} />
    </Suspense>
  );
}
