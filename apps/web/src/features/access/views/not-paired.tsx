import { CheckIcon, CopyIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { copyText } from '@/shared/workspace/copy';
import { cn } from '@/shared/lib/utils';
import { devPairing } from '@/shared/shell';

function pairingAddress() {
  return typeof window === 'undefined'
    ? 'http://127.0.0.1:3000'
    : window.location.origin;
}

export function NotPaired({
  reason,
  pending = false,
}: {
  reason?: string | undefined;
  pending?: boolean;
}) {
  const command = `porcelain pair "This browser" --address ${pairingAddress()}`;
  return (
    <section className="flex w-full min-w-0 flex-1 flex-col gap-8">
      <p
        role="status"
        className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border bg-background p-1 pr-3 text-ui text-muted-foreground"
      >
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
            pending
              ? 'bg-[var(--brand-soft,var(--accent))] text-[color:var(--brand,var(--foreground))]'
              : 'bg-foreground text-background',
          )}
        >
          {pending && <Spinner className="size-3" />}
          {pending ? 'Pairing' : 'Not paired'}
        </span>
        {pending
          ? 'Checking the link with your computer'
          : reason
            ? 'That link did not let this browser in'
            : 'This browser cannot open your worktrees yet'}
      </p>
      <div className="flex flex-col gap-6">
        <div className="text-4xl font-semibold leading-none tracking-tighter md:text-6xl">
          <h2
            aria-label="This browser is not paired"
            className="text-muted-foreground"
          >
            This browser is not paired.
          </h2>
          <p>Pair it from your computer.</p>
        </div>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Porcelain runs on the computer where your agents work, and this
          browser reads from it. That computer prints a link to let it in.
        </p>
      </div>
      <ol aria-label="How pairing works" className="flex max-w-3xl flex-col">
        <PairingStep number={1} current={!pending} done={pending}>
          <h3 className="font-semibold">
            {pending
              ? 'Ran porcelain pair on your computer'
              : reason
                ? 'On your computer, run it again'
                : 'On your computer, run this'}
          </h3>
          {!pending && (
            <>
              <div className="my-3 flex min-w-0 items-center gap-3 rounded-full border bg-muted py-1 pl-4 pr-1 text-ui">
                <span aria-hidden="true" className="text-muted-foreground">
                  $
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <code
                        className="min-w-0 flex-1 truncate"
                        tabIndex={0}
                        aria-label={command}
                      >
                        {command}
                      </code>
                    }
                  />
                  <TooltipContent className="max-w-sm break-all">
                    {command}
                  </TooltipContent>
                </Tooltip>
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
              (pending ? (
                'Checking that the link belongs to this Porcelain installation.'
              ) : (
                <>
                  It starts with <code>{pairingAddress()}/pair#</code>. On a
                  phone, scan the QR code it prints.
                </>
              ))}
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
  number: number;
  current?: boolean;
  done?: boolean;
  failed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-4 pb-8 last:pb-0">
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-3 top-8 border-l last:hidden in-last:hidden"
      />
      <span
        aria-current={current ? 'step' : undefined}
        aria-label={`Step ${number}${current ? ', current' : done ? ', done' : failed ? ', failed' : ''}`}
        className={cn(
          'relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs tabular-nums text-muted-foreground',
          current &&
            'border-[color:var(--brand,var(--ring))] text-[color:var(--brand,var(--foreground))] ring-4 ring-[color:var(--brand-soft,var(--accent))]',
          done &&
            'border-[color:var(--brand,var(--primary))] bg-[var(--brand,var(--primary))] text-[color:var(--brand-foreground,var(--primary-foreground))]',
          failed && 'border-destructive text-destructive',
        )}
      >
        {done ? (
          <CheckIcon className="size-3" />
        ) : failed ? (
          <XIcon className="size-3" />
        ) : (
          number
        )}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
