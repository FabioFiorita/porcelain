import { lazy, Suspense } from 'react';
import { PairEnvironmentFields } from './pair-environment-fields';

const DevelopmentPairEnvironmentForm = __DEV__
  ? lazy(() => import('./development-pair-environment-form'))
  : () => null;

export function PairEnvironmentForm(props: {
  onClose: () => void;
  environmentId?: string;
}) {
  if (!__DEV__) return <PairEnvironmentFields {...props} />;
  return (
    <Suspense fallback={null}>
      <DevelopmentPairEnvironmentForm {...props} />
    </Suspense>
  );
}
