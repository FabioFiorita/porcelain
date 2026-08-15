import type {
  DevServersChanged,
  DismissDevServerInput,
  StartDevServerInput,
  StopDevServerInput,
} from '@porcelain/contracts/terminal'
import { terminalProcedures } from '@porcelain/contracts/terminal'
import { type DevServersQuery, devServersQuery } from './dev-server-queries'

/**
 * Development-server mutation consequences and the notification that carries the same fact.
 *
 * Every one of these commands changes what is running for exactly one Worktree, so each
 * invalidates exactly that Worktree's roster row — never a blanket refresh. `stop` and
 * `dismiss` take only an id, so their affected row is not derivable from the input; the caller
 * supplies the target it already had in hand, which keeps the mapping honest rather than
 * inventing an "invalidate everything" escape.
 */

export type DevServerMutationDefinition<Input> = {
  readonly procedureName: 'startDevServer' | 'stopDevServer' | 'dismissDevServer'
  readonly affectedQueries: (input: Input) => readonly [DevServersQuery]
  readonly requiresAuthoritativeRefetch: true
}

type TargetedId<Input> = Input & { readonly projectId: string; readonly worktreeId: string }

export const devServerMutations = {
  start: {
    procedure: terminalProcedures.startDevServer,
    procedureName: 'startDevServer',
    affectedQueries: (input: StartDevServerInput) => [devServersQuery(input.target)] as const,
    requiresAuthoritativeRefetch: true,
  },
  stop: {
    procedure: terminalProcedures.stopDevServer,
    procedureName: 'stopDevServer',
    affectedQueries: (input: TargetedId<StopDevServerInput>) => [devServersQuery(input)] as const,
    requiresAuthoritativeRefetch: true,
  },
  dismiss: {
    procedure: terminalProcedures.dismissDevServer,
    procedureName: 'dismissDevServer',
    affectedQueries: (input: TargetedId<DismissDevServerInput>) =>
      [devServersQuery(input)] as const,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly start: DevServerMutationDefinition<StartDevServerInput> & { procedure: unknown }
  readonly stop: DevServerMutationDefinition<TargetedId<StopDevServerInput>> & {
    procedure: unknown
  }
  readonly dismiss: DevServerMutationDefinition<TargetedId<DismissDevServerInput>> & {
    procedure: unknown
  }
}

/** Map a validated development-server change notification to the affected query identity. */
export function devServersNotificationEffects(
  notification: DevServersChanged,
): readonly [DevServersQuery] {
  return [devServersQuery(notification)] as const
}
