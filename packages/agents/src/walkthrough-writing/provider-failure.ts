import { Effect } from 'effect';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';

export const providerFailure = (
  provider: 'codex' | 'claude',
  detail: string,
  stopped?: string,
) => {
  const name = provider === 'codex' ? 'Codex' : 'Claude';
  const reason =
    /invalid_json_schema|invalid schema|invalid.*(?:output|response).*format/i.test(
      detail,
    )
      ? 'invalid output format'
      : /invalid_request_error|invalid request|HTTP 400/i.test(detail)
        ? 'invalid request'
        : /rate_limit|rate limit|too many requests/i.test(detail)
          ? 'rate limit reached'
          : /quota|usage limit/i.test(detail)
            ? 'usage limit reached'
            : undefined;
  return new WalkthroughFailedError({
    kind: 'other',
    message:
      reason === undefined
        ? (stopped ?? `${name} stopped before completing the request.`)
        : `${name} rejected the request: ${reason}.`,
  });
};

export const failure = (
  kind: WalkthroughFailedError['kind'],
  message: string,
) => new WalkthroughFailedError({ kind, message });

export const unavailableWriter = (writer: {
  provider: string;
  model: string;
}) =>
  failure(
    'other',
    `The walkthrough model ${writer.provider}/${writer.model} is unavailable. Install the CLI and sign in, or choose another model in walkthrough settings.`,
  );

const modelRefused = (detail: string) =>
  /model.*(?:not.*(?:available|exist|found|support)|unavailable|no access)|no access.*model/i.test(
    detail,
  );

const signedOut =
  /not logged in|not signed in|sign in again|please (?:re-?)?run .*login|authentication_error|oauth|token.*expired|unauthorized/i;

export const classifyProviderFailure = (
  turn: {
    readonly provider: 'codex' | 'claude';
    readonly model: string;
    readonly stopped: string;
  },
  detail: string,
  fallback: WalkthroughFailedError = providerFailure(
    turn.provider,
    detail,
    turn.stopped,
  ),
) => {
  if (/invalid_request_error|invalid_json_schema|invalid schema/i.test(detail))
    return providerFailure(turn.provider, detail, turn.stopped);
  if (signedOut.test(detail))
    return failure(
      'signed_out',
      'Sign in again to the selected agent CLI, then try again.',
    );
  if (modelRefused(detail)) return unavailableWriter(turn);
  return fallback;
};

export const logProviderFailure = (
  error: WalkthroughFailedError,
  detail = '',
) =>
  Effect.logWarning('Walkthrough provider failed', {
    kind: error.kind,
    reason: error.message,
    codes: [
      'invalid_json_schema',
      'invalid_request_error',
      'rate_limit_exceeded',
      'insufficient_quota',
    ].filter((code) => detail.includes(code)),
  });
