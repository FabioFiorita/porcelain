import { PendingButton } from '@/shared/views/pending-button';

export function NoWalkthroughWriters({
  checking,
  onCheck,
}: {
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <div
      role="alert"
      className="grid justify-items-start gap-1 text-xs/relaxed"
    >
      <p className="font-medium text-foreground">No writers available</p>
      <p className="text-muted-foreground">
        Install Claude Code or Codex on the connected computer, then sign in
        with <code className="font-mono">claude auth login</code> or{' '}
        <code className="font-mono">codex login</code>.
      </p>
      <PendingButton
        pending={checking}
        type="button"
        className="mt-1"
        variant="outline"
        size="sm"
        onClick={onCheck}
      >
        Check writers again
      </PendingButton>
    </div>
  );
}
