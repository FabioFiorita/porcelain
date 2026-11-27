import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function RetryAlert({
  message,
  waiting,
  onRetry,
  className,
}: {
  message: string;
  waiting: boolean;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button
          size="xs"
          variant="outline"
          disabled={waiting}
          onClick={onRetry}
        >
          Try again
        </Button>
      </AlertAction>
    </Alert>
  );
}
