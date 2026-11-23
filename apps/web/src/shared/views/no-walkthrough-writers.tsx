import { PendingButton } from '@/shared/views/pending-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function NoWalkthroughWriters({
  checking,
  onCheck,
}: {
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <Alert>
      <AlertTitle>No writers available</AlertTitle>
      <AlertDescription>
        <p>
          Install Claude Code or Codex on the connected computer, then sign in
          with <code>claude auth login</code> or <code>codex login</code>.
        </p>
        <PendingButton
          pending={checking}
          type="button"
          className="mt-2"
          variant="outline"
          size="sm"
          onClick={onCheck}
        >
          Check writers again
        </PendingButton>
      </AlertDescription>
    </Alert>
  );
}
