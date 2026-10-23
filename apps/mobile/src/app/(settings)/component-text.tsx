import { lazy, Suspense } from 'react';

const TextPreview = __DEV__
  ? lazy(() =>
      import('../../features/development-catalog').then((catalog) => ({
        default: catalog.TextPreview,
      })),
    )
  : () => null;

export default function ComponentTextRoute() {
  return (
    <Suspense fallback={null}>
      <TextPreview />
    </Suspense>
  );
}
