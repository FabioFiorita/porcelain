import type { createAgent } from '@ui-sdk/react/agent';

type PageAgent = ReturnType<typeof createAgent>;

declare global {
  interface Window {
    porcelainAgent?: PageAgent;
  }
}

async function startAgentBridge() {
  if (!import.meta.env.DEV) return;
  const { createAgent: create } = await import('@ui-sdk/react/agent');
  window.porcelainAgent = create();
}

export { startAgentBridge };
