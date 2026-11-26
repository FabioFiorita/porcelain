import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';

const copyTitles = {
  brief: 'Copied brief',
  'worktree path': 'Copied worktree path',
  'log lines': 'Copied the log lines',
};

const gitTitles = {
  fetch: 'Fetched',
  pull: 'Pulled',
};

const pullRequestTitles = {
  merged: (number: number) => `Merged #${number}`,
  commented: (number: number) => `Commented on #${number}`,
};

export type NotifyEvent =
  | { kind: 'copy'; target: keyof typeof copyTitles }
  | { kind: 'git'; action: keyof typeof gitTitles }
  | {
      kind: 'pull-request';
      action: keyof typeof pullRequestTitles;
      number: number;
    };

function notificationTitle(event: NotifyEvent, platformShowsCopy: boolean) {
  if (event.kind === 'git') return gitTitles[event.action];
  if (event.kind === 'pull-request')
    return pullRequestTitles[event.action](event.number);
  return platformShowsCopy ? undefined : copyTitles[event.target];
}

export const notificationNotice = Atom.make<string | null>(null).pipe(
  Atom.keepAlive,
);

export function notifier({
  platformShowsCopy,
  announce,
  shownFor = () => Effect.sleep('5 seconds'),
}: {
  platformShowsCopy: boolean;
  announce: (title: string) => void;
  shownFor?: () => Effect.Effect<void>;
}) {
  const show = Atom.fn((title: string, get) =>
    Effect.gen(function* () {
      get.set(notificationNotice, title);
      announce(title);
      yield* shownFor();
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (get.registry.get(notificationNotice) === title)
            get.set(notificationNotice, null);
        }),
      ),
    ),
  ).pipe(Atom.keepAlive);
  return Atom.writable(
    (get) => {
      get(show);
    },
    (ctx, event: NotifyEvent) => {
      const title = notificationTitle(event, platformShowsCopy);
      if (title) ctx.set(show, title);
    },
  );
}
