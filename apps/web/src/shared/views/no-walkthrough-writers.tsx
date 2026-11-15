import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
        <Button
          type="button"
          className="mt-2"
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={onCheck}
        >
          {checking ? 'Checking writers…' : 'Check writers again'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
