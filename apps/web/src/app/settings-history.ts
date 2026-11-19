import type { RouterHistory } from '@tanstack/react-router';
import { Option, Schema } from 'effect';

const sessionSchema = Schema.Struct({
  start: Schema.Number,
  workspace: Schema.Boolean,
  list: Schema.optional(Schema.Number),
  retired: Schema.optional(Schema.Boolean),
  navigator: Schema.optional(Schema.Boolean),
});

export type SettingsSession = typeof sessionSchema.Type;

const readState = Schema.decodeUnknownOption(
  Schema.Struct({ settings: sessionSchema }),
);

type History = RouterHistory;

export function settingsEntry(history: History) {
  const { state, pathname } = history.location;
  return {
    index: state.__TSR_index,
    pathname,
    session: Option.getOrUndefined(
      Option.map(readState(state), (read) => read.settings),
    ),
  };
}

export function recordSettingsSession(
  history: History,
  session: SettingsSession,
) {
  const { state, href } = history.location;
  history.replace(href, { ...state, settings: session });
}

export function goThen(history: History, steps: number, then: () => void) {
  if (steps === 0) {
    then();
    return;
  }
  const stop = history.subscribe(() => {
    stop();
    then();
  });
  history.go(steps);
}
