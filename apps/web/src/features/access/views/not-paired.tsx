import { TruncatedText } from '@/shared/views/truncated-text';
import { PendingSpinner } from '@/shared/views/state-notice';
import { CheckIcon, CopyIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { copyText } from '@/shared/workspace/copy';
import { cn } from '@/shared/lib/utils';
import { devPairing } from '@/shared/shell';
import { desktopLiveAddress } from '@/shared/adapters/desktop';

function pairingAddress() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3000';
  const address = desktopLiveAddress();
  const local = address ? URL.parse(address) : null;
  if (local && (local.protocol === 'ws:' || local.protocol === 'wss:')) {
    local.protocol = local.protocol.replace('ws', 'http');
    return local.origin;
  }
  return window.location.origin;
}

export function NotPaired({
  reason,
  pending = false,
}: {
  reason?: string | undefined;
  pending?: boolean;
}) {
  const command = `porcelain pair "This browser" --address ${pairingAddress()}`;
  let firstStep = 'On your computer, run this';
  if (reason) {
    firstStep = 'On your computer, run it again';
  }
  if (pending) {
    firstStep = 'Ran porcelain pair on your computer';
  }
  return (
    <section className="flex w-full min-w-0 flex-1 flex-col gap-8">
      {pending && (
        <p
          role="status"
          className="flex items-center gap-1 text-ui text-muted-foreground"
        >
          <PendingSpinner className="[&>svg]:size-3" />
          Checking the link with your computer
        </p>
      )}
      <h2 className="text-4xl font-semibold leading-none tracking-tighter md:text-6xl">
        This browser is not paired
      </h2>
      <ol aria-label="How pairing works" className="flex max-w-3xl flex-col">
        <PairingStep number={1} current={!pending} done={pending}>
          <h3 className="font-semibold">{firstStep}</h3>
          {!pending && (
            <>
              <div className="my-3 flex min-w-0 items-center gap-3 rounded-full border bg-muted py-1 pl-4 pr-1 text-ui">
                <span aria-hidden="true" className="text-muted-foreground">
                  $
                </span>
                <TruncatedText
                  text={command}
                  render={<code />}
                  className="flex-1"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copy the command"
                        onClick={() => copyText(command, 'the command')}
                      >
                        <CopyIcon />
                      </Button>
                    }
                  />
                  <TooltipContent>Copy the command</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-ui text-muted-foreground">
                {reason ? 'Same command, a new link. ' : ''}It prints a link
                that works once, for 15 minutes.
              </p>
            </>
          )}
        </PairingStep>
        <PairingStep number={2} current={pending} failed={Boolean(reason)}>
          <h3 className="font-semibold">
            {pending ? 'Checking the link' : 'Open the link it prints, here'}
          </h3>
          <p
            role={reason ? 'alert' : undefined}
            className={cn(
              'mt-1 text-ui leading-relaxed [overflow-wrap:anywhere]',
              reason ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {reason ??
              (pending
                ? 'Checking that the link belongs to this Porcelain installation.'
                : 'On a phone, scan the QR code printed with the link.')}
          </p>
        </PairingStep>
        <PairingStep number={3}>
          <h3 className="font-semibold">Read what your agents changed</h3>
          {!pending && (
            <p className="mt-1 text-ui text-muted-foreground">
              This browser stays paired until you revoke it.
            </p>
          )}
        </PairingStep>
      </ol>
      {devPairing && !pending && (
        <form
          method="post"
          action="/__porcelain/dev/pair"
          className="flex max-w-3xl flex-wrap items-center gap-3 rounded-md border border-dashed p-3"
        >
          <p className="min-w-0 flex-1 text-ui text-muted-foreground">
            This is a development server, so it can pair this browser directly.
          </p>
          <Button type="submit" size="sm">
            Pair this browser
          </Button>
        </form>
      )}
      <p className="mt-auto border-t pt-4 text-ui text-muted-foreground">
        Revoke this browser at any time with <code>porcelain devices</code> and{' '}
        <code>porcelain revoke</code>.
      </p>
    </section>
  );
}

function PairingStep({
  number,
  current = false,
  done = false,
  failed = false,
  children,
}: {
  number: 1 | 2 | 3;
  current?: boolean;
  done?: boolean;
  failed?: boolean;
  children: React.ReactNode;
}) {
  let state = '';
  let marker: React.ReactNode = number;
  if (failed) {
    state = ', failed';
    marker = <XIcon className="size-3" />;
  }
  if (done) {
    state = ', done';
    marker = <CheckIcon className="size-3" />;
  }
  if (current) state = ', current';
  return (
    <li className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-4 pb-8 last:pb-0">
      {number !== 3 && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-3 top-8 border-l"
        />
      )}
      <span
        aria-current={current ? 'step' : undefined}
        aria-label={`Step ${number}${state}`}
        className={cn(
          'relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs tabular-nums text-muted-foreground',
          current && 'border-brand text-brand ring-4 ring-brand-soft',
          done && 'border-brand bg-brand text-brand-foreground',
          failed && 'border-destructive text-destructive',
        )}
      >
        {marker}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
