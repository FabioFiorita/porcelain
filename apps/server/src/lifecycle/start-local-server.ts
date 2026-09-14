// Keep the historical server-internal import stable for the raw `main.ts`
// contract and existing development callers.  The installed launcher owns the
// implementation under `cli/` so it can bundle one reusable runtime.
export { startLocalServer } from '../cli/start-local-server.ts';
