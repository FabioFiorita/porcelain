import type { BrowserFailure, ServerHit } from './protocol.ts';

type Declared =
  | { kind: 'console'; pattern: RegExp; seen: boolean }
  | { kind: 'response'; route: string; status: number; seen: boolean };

export function createFailures() {
  const declared: Declared[] = [];
  return {
    console(pattern: RegExp) {
      declared.push({ kind: 'console', pattern, seen: false });
    },
    response(route: string, status: number) {
      declared.push({ kind: 'response', route, status, seen: false });
    },
    unexpected(
      observed: readonly BrowserFailure[],
      hits: readonly ServerHit[],
    ): string[] {
      const found = [
        ...observed.flatMap((failure) => {
          const match = declared.find(
            (entry) =>
              entry.kind === 'console' &&
              failure.kind === 'console error' &&
              entry.pattern.test(failure.message),
          );
          if (match) match.seen = true;
          return match ? [] : [`${failure.kind}: ${failure.message}`];
        }),
        ...hits
          .filter((hit) => !hit.kit && (hit.status ?? 0) >= 500)
          .flatMap((hit) => {
            const route = `${hit.method} ${hit.route ?? hit.path}`;
            const match = declared.find(
              (entry) =>
                entry.kind === 'response' &&
                entry.route === route &&
                entry.status === hit.status,
            );
            if (match) match.seen = true;
            return match
              ? []
              : [`server answered ${route} with ${hit.status ?? 0}`];
          }),
      ];
      return [
        ...found,
        ...declared
          .filter((entry) => !entry.seen)
          .map((entry) =>
            entry.kind === 'console'
              ? `declared console error ${String(entry.pattern)} never happened`
              : `declared ${entry.status} from ${entry.route} never happened`,
          ),
      ];
    },
  };
}

export type Failures = ReturnType<typeof createFailures>;

export function failureMessage(test: string, unexpected: readonly string[]) {
  return `"${test}" met failures it did not declare through failures.console or failures.response: ${unexpected.join('; ')}`;
}
