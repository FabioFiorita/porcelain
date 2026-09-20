type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * One place that learns the server has stopped accepting this browser.
 *
 * Revocation can land between any two requests, so every view would otherwise
 * need its own answer to a 401 — and most would simply retry. The transport
 * raises this once, and the workspace ends the connection and clears private
 * state in a single place.
 */
export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportUnauthorized() {
  for (const listener of [...listeners]) listener();
}
