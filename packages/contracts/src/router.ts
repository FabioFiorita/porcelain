// TRANSITIONAL — architecture charter forbids contracts importing apps/*.
// This re-export remains until procedure I/O lives in this package and clients
// no longer need AppRouter from the daemon implementation graph.
//
// Type-only: no client bundles backend code. Kept off the default entry because
// resolving it drags the daemon type graph (Node typings, __PORCELAIN_VERSION__)
// into Expo's tsc. Desktop opts in via `@porcelain/contracts/router`.
export type { AppRouter } from '../../../apps/desktop/src/backend/api'
