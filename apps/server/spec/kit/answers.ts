import type { ApiErrorCode } from '@porcelain/contracts/shared';

export function apiError(
  statusCode: number,
  error: string,
  message: string,
  code?: ApiErrorCode,
) {
  return { statusCode, error, message, ...(code ? { code } : {}) };
}

export const invalidRequest = apiError(400, 'Bad Request', 'Invalid request');

export const unauthenticated = apiError(
  401,
  'Unauthorized',
  'Authentication required',
);

export const worktreeNotFound = apiError(
  404,
  'Not Found',
  'Worktree not found',
);

export const unreadablePath = apiError(
  422,
  'Unprocessable Entity',
  'Path could not be read',
);

export const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';
export const unknownWorktreeId = '0'.repeat(32);
export const unknownOid = '0'.repeat(40);
export const unknownFingerprint = '0'.repeat(64);

export const CREDENTIAL_LINK = '../credential.json';

export function literally(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function issued(form: string) {
  return `${form}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[A-Za-z0-9_-]{43}`;
}

export const credentialForm = new RegExp(`^${issued('pcd')}$`);

export const liveTicketForm = new RegExp(`^${issued('pct')}$`);

export const deviceCookieForm = new RegExp(
  `^porcelain_device=[^;]+; ${literally('Path=/api; HttpOnly; SameSite=Strict; Max-Age=7776000')}$`,
);

export function pairingLinkForm(address: string, environmentId: string) {
  return new RegExp(
    `^${literally(address)}/pair#c=${issued('pcp')}&e=${literally(environmentId)}$`,
  );
}

export function upgradeHeaders(address: string): Record<string, string> {
  return {
    connection: 'Upgrade',
    upgrade: 'websocket',
    'sec-websocket-version': '13',
    'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    origin: new URL(address).origin,
  };
}
