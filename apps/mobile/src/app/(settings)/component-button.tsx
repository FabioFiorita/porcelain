import { lazy, Suspense } from 'react';

const ButtonPreview = __DEV__
  ? lazy(() =>
      import('../../features/development-catalog').then((catalog) => ({
        default: catalog.ButtonPreview,
      })),
    )
  : () => null;

export default function ComponentButtonRoute() {
  return (
    <Suspense fallback={null}>
      <ButtonPreview />
    </Suspense>
  );
}
