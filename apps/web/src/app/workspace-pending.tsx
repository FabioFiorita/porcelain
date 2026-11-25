import { StateSpinner } from '@/shared/views/state-notice';
import { useReviewPanelOpen } from '@/features/workspace/index';

export function WorkspacePending() {
  const { open } = useReviewPanelOpen();
  return (
    <div className="flex h-svh w-full bg-frame p-2">
      <div aria-hidden="true" className="hidden w-64 shrink-0 md:block" />
      <div className="flex min-w-0 flex-1 rounded-paper border bg-card">
        <StateSpinner label="Opening Porcelain" />
      </div>
      {open && (
        <div
          aria-hidden="true"
          className="ml-2 hidden w-80 shrink-0 rounded-paper bg-card shadow-paper xl:block"
        />
      )}
      <div aria-hidden="true" className="hidden w-11 shrink-0 xl:block" />
    </div>
  );
}
