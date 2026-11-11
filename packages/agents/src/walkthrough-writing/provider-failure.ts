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
