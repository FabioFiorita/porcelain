import { StateSpinner } from '@/shared/views/state-notice';
import { type ComponentProps, lazy, Suspense } from 'react';

const LoadedFileEditor = lazy(() => import('./file-editor'));

export function FileEditor(props: ComponentProps<typeof LoadedFileEditor>) {
  return (
    <Suspense fallback={<StateSpinner label="Opening the editor" />}>
      <LoadedFileEditor {...props} />
    </Suspense>
  );
}
