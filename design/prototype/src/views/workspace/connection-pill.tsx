import { Spinner } from '@/components/ui/spinner';
import { useConnectionState } from '../../query/connection';

/**
 * A small note while the live channel is down (laptop sleep, Wi-Fi, a server
 * restart). Everything on screen stays usable; it only means changes made
 * elsewhere show up once the channel is back. It disappears on reconnect.
 * The live region is always mounted so screen readers hear it appear.
 */
export function ConnectionPill() {
  const { live } = useConnectionState();
  return (
    <span role="status" aria-live="polite" className="contents">
      {live === 'reconnecting' && (
        <span
          title="Changes made elsewhere show up once Porcelain is connected again."
          className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 text-[11px] whitespace-nowrap text-muted-foreground"
        >
          <Spinner className="size-3" />
          Reconnecting…
        </span>
      )}
    </span>
  );
}
