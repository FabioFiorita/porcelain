import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** "Look again" after a "changed since you looked" refusal: reads the list of changes again. */
export function LookAgainButton({
  onLook,
}: {
  onLook: () => Promise<unknown>;
}) {
  const [looking, setLooking] = useState(false);
  return (
    <Button
      size="xs"
      variant="outline"
      className="shrink-0"
      disabled={looking}
      onClick={() => {
        setLooking(true);
        void onLook().finally(() => setLooking(false));
      }}
    >
      {looking ? <Spinner className="size-3" /> : <RotateCcw />}
      Look again
    </Button>
  );
}
