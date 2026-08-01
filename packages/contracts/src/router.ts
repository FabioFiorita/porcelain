// The daemon's tRPC router type — type-only, so no client bundles a byte of
// backend code. The relative hop out of the package is deliberate: the type is
// *generated* by src/backend/api.ts and can't be authored here without
// duplicating the router.
//
// Kept out of the package's default entry because resolving it drags the whole
// daemon type graph (node:child_process typings, the __PORCELAIN_VERSION__
// global) into whoever imports the barrel — which breaks `apps/mobile`, whose
// tsconfig is Expo's. Desktop consumers opt in via `@porcelain/contracts/router`;
// mobile can once its tsconfig carries Node types.
export type { AppRouter } from '../../../apps/desktop/src/backend/api'
