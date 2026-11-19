import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { DIFF_WINDOW_FILES } from '@/config/limits';

export function ReadMoreFiles({
  more,
  total,
  pending,
  onReadMore,
}: {
  more: number;
  total: number;
  pending: boolean;
  onReadMore: () => void;
}) {
  if (more <= 0) return null;
  return (
    <div className="border-t px-4 py-3 text-center">
      <Button
        variant="outline"
        size="sm"
        onClick={onReadMore}
        disabled={pending}
      >
        {pending && <Spinner aria-hidden="true" />}
        {`Read ${Math.min(more, DIFF_WINDOW_FILES)} more of ${total}`}
      </Button>
    </div>
  );
}
