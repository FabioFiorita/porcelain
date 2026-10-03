import { type ComponentProps, lazy, Suspense } from 'react';

const LoadedFileEditor = lazy(() => import('./file-editor'));

export function FileEditor(props: ComponentProps<typeof LoadedFileEditor>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-3.5 text-xs text-muted-foreground">
          Loading editor…
        </p>
      }
    >
      <LoadedFileEditor {...props} />
    </Suspense>
  );
}
