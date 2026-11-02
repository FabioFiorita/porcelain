import { useAtom } from '@effect/atom-react';
import {
  agentFeedbackControls,
  type AgentFeedbackInput,
} from '@porcelain/client/reviews';
import { Button } from '@/components/ui/button';

export function AgentFeedback(input: AgentFeedbackInput) {
  const [view, act] = useAtom(agentFeedbackControls(input));
  if (view.kind === 'loading') return null;
  if (view.kind === 'failure')
    return (
      <section aria-label="Agent feedback" className="flex flex-col gap-2">
        <p role="alert" className="text-xs text-destructive">
          {view.error}
        </p>
        <Button variant="outline" size="sm" onClick={() => act('refresh')}>
          Read agent connection again
        </Button>
      </section>
    );
  return (
    <section
      aria-label="Agent feedback"
      className="flex min-w-0 flex-col gap-2"
    >
      {view.session ? (
        <>
          <p className="text-xs break-all text-muted-foreground">
            Connected session: {view.session}
          </p>
          {input.writable ? (
            <p className="text-xs text-muted-foreground">
              Only saved feedback is sent. Sending keeps the review open.
            </p>
          ) : null}
        </>
      ) : null}
      {view.status ? (
        <p role="status" className="text-xs text-muted-foreground">
          {view.status}
        </p>
      ) : null}
      {view.reason ? (
        <p className="text-xs text-muted-foreground">{view.reason}</p>
      ) : null}
      {view.deliveryError ? (
        <p role="alert" className="text-xs text-destructive">
          {view.deliveryError}
        </p>
      ) : null}
      {view.showActions ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!view.canSend}
            onClick={() => act('send')}
          >
            {view.sending ? 'Sending feedback…' : 'Send feedback'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!view.canDisconnect}
            onClick={() => act('disconnect')}
          >
            Disconnect session
          </Button>
        </div>
      ) : null}
      {view.errors.map((error, index) => (
        <p key={index} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ))}
    </section>
  );
}
