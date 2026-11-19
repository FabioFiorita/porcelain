import { StateSpinner } from '@/shared/views/state-notice';

export function WorkspacePending() {
  return (
    <div className="flex min-h-svh w-full gap-2 bg-muted p-2">
      <div className="hidden w-66 shrink-0 rounded-xl bg-sidebar md:block" />
      <div className="flex min-w-0 flex-1 rounded-paper border bg-background">
        <StateSpinner label="Opening Porcelain" />
      </div>
    </div>
  );
}
