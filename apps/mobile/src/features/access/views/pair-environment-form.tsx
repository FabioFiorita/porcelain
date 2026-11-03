import { lazy, Suspense } from 'react';
import {
  PairEnvironmentFields,
  type PairEnvironmentFormProps,
} from './pair-environment-fields';

const DevelopmentPairEnvironmentForm = __DEV__
  ? lazy(() => import('./development-pair-environment-form'))
  : () => null;

export function PairEnvironmentForm(props: PairEnvironmentFormProps) {
  if (!__DEV__) return <PairEnvironmentFields {...props} />;
  return (
    <Suspense fallback={null}>
      <DevelopmentPairEnvironmentForm {...props} />
    </Suspense>
  );
}
