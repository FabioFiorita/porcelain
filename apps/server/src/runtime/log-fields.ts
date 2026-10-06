import { Redacted } from 'effect';
import type { FailureReport } from '../ports/logger.ts';

export function failureFields(input: FailureReport) {
  const { error, ...fields } = input;
  const failure =
    error instanceof Error
      ? {
          name: error.name,
          details: Redacted.make({
            message: error.message,
            stack: error.stack,
          }),
        }
      : { name: typeof error, details: Redacted.make(error) };
  return {
    ...fields,
    ...(input.kind === 'request' ? { url: Redacted.make(input.url) } : {}),
    error: failure,
  };
}

const sensitiveField =
  /^(?:authorization|cookie|set-cookie|credential|password|secret|token|code|ticket|cause|url)$/i;
const credentialToken = /\bpc[ptd]_[A-Za-z0-9_-]+/g;

export function redactedLogValue(
  value: unknown,
  ancestors: WeakSet<object> = new WeakSet(),
): unknown {
  if (Redacted.isRedacted(value)) return '<redacted>';
  if (typeof value === 'string')
    return value.replace(credentialToken, '<redacted>');
  if (value !== null && typeof value === 'object') {
    if (ancestors.has(value)) return '[Circular]';
    ancestors.add(value);
    try {
      return Array.isArray(value)
        ? value.map((field) => redactedLogValue(field, ancestors))
        : Object.fromEntries(
            Object.entries(value).map(([key, field]) => [
              key,
              sensitiveField.test(key) && field !== undefined && field !== null
                ? '<redacted>'
                : redactedLogValue(field, ancestors),
            ]),
          );
    } finally {
      ancestors.delete(value);
    }
  }
  return value;
}
